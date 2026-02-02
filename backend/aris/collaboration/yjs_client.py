"""
YDocClient: Backend Y.js WebSocket client with PostgreSQL persistence.

This client connects to the y-websocket server as a peer, manages Y.Doc
instances, and persists changes to the database with debouncing.
"""

import asyncio
import logging
from typing import Optional

from pycrdt import Doc, Text, TextEvent
from pycrdt_websocket import WebsocketProvider
from sqlalchemy import text as sql_text
from websockets import connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from aris.database import async_session_maker


# Collaboration-specific logger
logger = logging.getLogger("aris.collaboration")


class YDocClient:
    """
    Backend Y.js WebSocket client for a single file.

    Architecture:
    - Connects to multi-player y-websocket server as a client
    - Loads content from PostgreSQL on startup
    - Initializes Y.Doc with database content
    - Observes Y.Text changes and persists to database (debounced)
    - Auto-reconnects on WebSocket disconnection
    - Saves final state on graceful shutdown

    Usage:
        client = YDocClient(file_id=264, websocket_url="ws://localhost:1234/file-264")
        asyncio.create_task(client.run())
    """

    def __init__(
        self,
        file_id: int,
        websocket_url: str,
        debounce_ms: int = 500,
    ):
        """
        Initialize YDocClient.

        Args:
            file_id: Database file ID to manage
            websocket_url: WebSocket URL to connect to (e.g., "ws://collab:1234/file-264")
            debounce_ms: Milliseconds to wait before persisting changes (default: 500ms)
        """
        self.file_id = file_id
        self.websocket_url = websocket_url
        self.debounce_ms = debounce_ms

        # Y.js state
        self.doc: Optional[Doc] = None
        self.text: Optional[Text] = None
        self.provider: Optional[WebsocketProvider] = None

        # Persistence state
        self._save_task: Optional[asyncio.Task] = None
        self._shutdown = False

        # Reconnection state
        self._reconnect_attempt = 0
        self._max_reconnect_delay = 60  # Max 60 seconds between retries

        logger.info(f"YDocClient initialized for file {file_id}")

    async def run(self):
        """
        Main client loop with auto-reconnection.

        Connects to y-websocket server, loads content from database,
        and keeps connection alive. Automatically reconnects on failure
        with exponential backoff.
        """
        while not self._shutdown:
            try:
                await self._connect_and_run()
                # If we get here, connection closed gracefully
                if not self._shutdown:
                    logger.warning(
                        f"Connection closed for file {self.file_id}, reconnecting..."
                    )
                    await self._wait_before_reconnect()
            except (ConnectionClosed, WebSocketException) as e:
                if not self._shutdown:
                    logger.warning(
                        f"WebSocket error for file {self.file_id}: {e}, reconnecting..."
                    )
                    await self._wait_before_reconnect()
            except Exception as e:
                logger.error(
                    f"Unexpected error in YDocClient for file {self.file_id}: {e}",
                    exc_info=True,
                )
                if not self._shutdown:
                    await self._wait_before_reconnect()

        logger.info(f"YDocClient for file {self.file_id} shut down")

    async def _connect_and_run(self):
        """Connect to WebSocket server and run until disconnection."""
        logger.info(f"Connecting to {self.websocket_url} for file {self.file_id}")

        async with connect(self.websocket_url) as websocket:
            # Reset reconnect counter on successful connection
            self._reconnect_attempt = 0
            logger.info(f"WebSocket connected for file {self.file_id}")

            # Create Y.Doc
            self.doc = Doc()
            self.text = self.doc.get("text", type=Text)

            # Load content from database
            await self._load_from_db()

            # Setup observer for persistence
            self.text.observe(self._on_text_change)

            # Connect to y-websocket server
            async with WebsocketProvider(self.doc, websocket):
                logger.info(f"Y.js provider active for file {self.file_id}")

                # Keep connection alive until shutdown
                while not self._shutdown:
                    await asyncio.sleep(1)

                # Graceful shutdown: save final state
                logger.info(f"Shutting down, saving final state for file {self.file_id}")
                await self._save_to_db(force=True)

    async def _load_from_db(self):
        """Load file content from database and initialize Y.Text."""
        # Option A: Create own async session (independent lifecycle)
        async with async_session_maker() as session:
            try:
                result = await session.execute(
                    sql_text("SELECT source FROM files WHERE id = :file_id"),
                    {"file_id": self.file_id},
                )
                row = result.fetchone()

                if row and row[0]:
                    content = row[0]
                    logger.info(
                        f"Loaded {len(content)} chars from DB for file {self.file_id}"
                    )

                    # Initialize Y.Text with database content
                    with self.doc.transaction():
                        self.text += content

                    logger.info(f"Y.Text initialized for file {self.file_id}")
                else:
                    logger.warning(
                        f"No content found in DB for file {self.file_id}, starting empty"
                    )

            except Exception as e:
                logger.error(
                    f"Failed to load content from DB for file {self.file_id}: {e}",
                    exc_info=True,
                )
                raise

    def _on_text_change(self, event: TextEvent):
        """
        Observer callback for Y.Text changes.

        Debounces writes to database to avoid excessive I/O.
        """
        # Cancel pending save
        if self._save_task and not self._save_task.done():
            self._save_task.cancel()

        # Schedule new save after debounce period
        self._save_task = asyncio.create_task(self._debounced_save())

    async def _debounced_save(self):
        """Wait for debounce period, then save to database."""
        try:
            # Wait for debounce period
            await asyncio.sleep(self.debounce_ms / 1000.0)

            # Save to database
            await self._save_to_db()

        except asyncio.CancelledError:
            # Save was cancelled by newer change, this is expected
            pass

    async def _save_to_db(self, force: bool = False):
        """
        Persist current Y.Text content to database.

        Args:
            force: If True, save immediately (used for final shutdown save)
        """
        if not self.text:
            return

        try:
            content = str(self.text)

            # Option A: Create own async session for each save
            async with async_session_maker() as session:
                await session.execute(
                    sql_text("UPDATE files SET source = :content WHERE id = :file_id"),
                    {"content": content, "file_id": self.file_id},
                )
                await session.commit()

                action = "Final save" if force else "Saved"
                logger.debug(
                    f"{action}: {len(content)} chars to DB for file {self.file_id}"
                )

        except Exception as e:
            logger.error(
                f"Failed to save content to DB for file {self.file_id}: {e}",
                exc_info=True,
            )

    async def _wait_before_reconnect(self):
        """Wait before reconnecting with exponential backoff."""
        self._reconnect_attempt += 1

        # Exponential backoff: 1s, 2s, 4s, 8s, ..., up to max_reconnect_delay
        delay = min(2 ** (self._reconnect_attempt - 1), self._max_reconnect_delay)

        logger.info(
            f"Reconnecting to file {self.file_id} in {delay}s "
            f"(attempt {self._reconnect_attempt})"
        )

        await asyncio.sleep(delay)

    async def shutdown(self):
        """
        Gracefully shutdown the client.

        Signals the main loop to stop, saves final state, and cleans up resources.
        """
        logger.info(f"Shutdown requested for file {self.file_id}")
        self._shutdown = True

        # Cancel any pending save
        if self._save_task and not self._save_task.done():
            self._save_task.cancel()

        # Final save will happen in _connect_and_run when shutdown flag is detected
