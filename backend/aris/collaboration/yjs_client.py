"""
YDocClient: Backend Y.js WebSocket client with PostgreSQL persistence.

Implements y-websocket protocol manually using pycrdt sync utilities.
"""

import asyncio
import logging
import struct
from typing import Optional

from pycrdt import Doc, Text, TextEvent, create_sync_message, handle_sync_message
from sqlalchemy import text as sql_text
from websockets import connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from aris.deps import ArisSession


# Collaboration-specific logger
logger = logging.getLogger("aris.collaboration")


class YDocClient:
    """
    Backend Y.js WebSocket client for a single file.

    Implements y-websocket protocol manually to connect as a client.
    """

    def __init__(
        self,
        file_id: int,
        websocket_url: str,
        debounce_ms: int = 500,
    ):
        self.file_id = file_id
        self.websocket_url = websocket_url
        self.debounce_ms = debounce_ms

        # Y.js state
        self.doc: Optional[Doc] = None
        self.text: Optional[Text] = None

        # Persistence state
        self._save_task: Optional[asyncio.Task] = None
        self._shutdown = False

        # Reconnection state
        self._reconnect_attempt = 0
        self._max_reconnect_delay = 60

        logger.info(f"YDocClient initialized for file {file_id}")

    async def run(self):
        """Main client loop with auto-reconnection."""
        while not self._shutdown:
            try:
                await self._connect_and_run()
                if not self._shutdown:
                    logger.warning(f"Connection closed for file {self.file_id}, reconnecting...")
                    await self._wait_before_reconnect()
            except (ConnectionClosed, WebSocketException) as e:
                if not self._shutdown:
                    logger.warning(f"WebSocket error for file {self.file_id}: {e}, reconnecting...")
                    await self._wait_before_reconnect()
            except Exception as e:
                logger.error(f"Unexpected error in YDocClient for file {self.file_id}: {e}", exc_info=True)
                if not self._shutdown:
                    await self._wait_before_reconnect()

        logger.info(f"YDocClient for file {self.file_id} shut down")

    async def _connect_and_run(self):
        """Connect to WebSocket server and run until disconnection."""
        logger.info(f"Connecting to {self.websocket_url} for file {self.file_id}")

        async with connect(self.websocket_url) as websocket:
            self._reconnect_attempt = 0
            logger.info(f"WebSocket connected for file {self.file_id}")

            # Create Y.Doc
            self.doc = Doc()
            self.text = self.doc.get("text", type=Text)

            # Load content from database
            await self._load_from_db()

            # Setup observer for persistence
            self.text.observe(self._on_text_change)

            # Send initial sync (SyncStep1)
            await self._send_sync_step1(websocket)

            # Handle incoming messages
            await self._message_loop(websocket)

    async def _send_sync_step1(self, websocket):
        """Send SyncStep1 message to initiate sync."""
        assert self.doc is not None, "doc must be initialized before sending sync"
        sync_message = create_sync_message(self.doc)
        # y-websocket protocol: message type (0 = sync) + sync message
        message = struct.pack('!B', 0) + sync_message
        await websocket.send(message)
        logger.debug(f"Sent SyncStep1 for file {self.file_id}")

    async def _message_loop(self, websocket):
        """Handle incoming WebSocket messages."""
        try:
            async for message in websocket:
                if self._shutdown:
                    break

                await self._handle_message(websocket, message)
        except ConnectionClosed:
            logger.info(f"WebSocket closed for file {self.file_id}")
            raise
        finally:
            # Graceful shutdown: save final state
            if self._shutdown:
                logger.info(f"Shutting down, saving final state for file {self.file_id}")
                await self._save_to_db(force=True)

    async def _handle_message(self, websocket, message):
        """Handle a single WebSocket message."""
        if not message:
            return

        assert self.doc is not None, "doc must be initialized before handling messages"

        # y-websocket protocol: first byte is message type
        msg_type = message[0]
        payload = message[1:]

        if msg_type == 0:  # Sync message
            reply = handle_sync_message(payload, self.doc)
            if reply:
                # Send reply (SyncStep2 or Update)
                reply_message = struct.pack('!B', 0) + reply
                await websocket.send(reply_message)
                logger.debug(f"Sent sync reply for file {self.file_id}")

    async def _load_from_db(self):
        """Load file content from database and initialize Y.Text."""
        assert self.doc is not None, "doc must be initialized before loading from DB"
        assert self.text is not None, "text must be initialized before loading from DB"

        async with ArisSession() as session:
            try:
                result = await session.execute(
                    sql_text("SELECT source FROM files WHERE id = :file_id"),
                    {"file_id": self.file_id},
                )
                row = result.fetchone()

                if row and row[0]:
                    content = row[0]
                    logger.info(f"Loaded {len(content)} chars from DB for file {self.file_id}")

                    with self.doc.transaction():
                        self.text += content

                    logger.info(f"Y.Text initialized for file {self.file_id}")
                else:
                    logger.warning(f"No content found in DB for file {self.file_id}, starting empty")

            except Exception as e:
                logger.error(f"Failed to load content from DB for file {self.file_id}: {e}", exc_info=True)
                raise

    def _on_text_change(self, event: TextEvent):
        """Observer callback for Y.Text changes."""
        if self._save_task and not self._save_task.done():
            self._save_task.cancel()

        self._save_task = asyncio.create_task(self._debounced_save())

    async def _debounced_save(self):
        """Wait for debounce period, then save to database."""
        try:
            await asyncio.sleep(self.debounce_ms / 1000.0)
            await self._save_to_db()
        except asyncio.CancelledError:
            pass

    async def _save_to_db(self, force: bool = False):
        """Persist current Y.Text content to database."""
        if not self.text:
            return

        try:
            content = str(self.text)

            async with ArisSession() as session:
                await session.execute(
                    sql_text("UPDATE files SET source = :content WHERE id = :file_id"),
                    {"content": content, "file_id": self.file_id},
                )
                await session.commit()

                action = "Final save" if force else "Saved"
                logger.debug(f"{action}: {len(content)} chars to DB for file {self.file_id}")

        except Exception as e:
            logger.error(f"Failed to save content to DB for file {self.file_id}: {e}", exc_info=True)

    async def _wait_before_reconnect(self):
        """Wait before reconnecting with exponential backoff."""
        self._reconnect_attempt += 1
        delay = min(2 ** (self._reconnect_attempt - 1), self._max_reconnect_delay)
        logger.info(f"Reconnecting to file {self.file_id} in {delay}s (attempt {self._reconnect_attempt})")
        await asyncio.sleep(delay)

    async def shutdown(self):
        """Gracefully shutdown the client."""
        logger.info(f"Shutdown requested for file {self.file_id}")
        self._shutdown = True

        if self._save_task and not self._save_task.done():
            self._save_task.cancel()
