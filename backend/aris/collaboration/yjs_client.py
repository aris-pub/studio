"""
YDocClient: Backend Y.js WebSocket client with PostgreSQL persistence.

Uses pycrdt's native sync protocol which is compatible with JavaScript y-websocket.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from pycrdt import Doc, Text, TextEvent, create_sync_message, handle_sync_message
from sqlalchemy import text as sql_text
from websockets import ClientConnection, connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from aris.deps import ArisSession


# Collaboration-specific logger
logger = logging.getLogger("aris.collaboration")

# ---------------------------------------------------------------------------
# Auto-checkpoint heuristic constants
# ---------------------------------------------------------------------------
CHECKPOINT_IDLE_TIMEOUT_SECS: float = 5 * 60       # idle pause before snapshotting
CHECKPOINT_MIN_EDIT_EVENTS: int = 15                # minimum edits to warrant a checkpoint
CHECKPOINT_MIN_INTERVAL_SECS: float = 15 * 60      # minimum time between checkpoints
CHECKPOINT_SAFETY_NET_SECS: float = 2 * 60 * 60    # force checkpoint if edits go this long


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
        checkpoint_idle_timeout_secs: float = CHECKPOINT_IDLE_TIMEOUT_SECS,
        checkpoint_min_interval_secs: float = CHECKPOINT_MIN_INTERVAL_SECS,
        checkpoint_safety_net_secs: float = CHECKPOINT_SAFETY_NET_SECS,
    ):
        self.file_id = file_id
        self.websocket_url = websocket_url
        self.debounce_ms = debounce_ms
        self.checkpoint_idle_timeout_secs = checkpoint_idle_timeout_secs
        self.checkpoint_min_interval_secs = checkpoint_min_interval_secs
        self.checkpoint_safety_net_secs = checkpoint_safety_net_secs

        # Y.js state
        self.doc: Optional[Doc] = None
        self.text: Optional[Text] = None

        # Persistence state
        self._save_task: Optional[asyncio.Task] = None
        self._shutdown = False
        self._ws: Optional[ClientConnection] = None  # Active WebSocket, set during connection

        # Reconnection state
        self._reconnect_attempt = 0
        self._max_reconnect_delay = 60

        # Checkpoint state
        self._edit_count_since_checkpoint: int = 0
        self._last_checkpoint_at: Optional[datetime] = None
        self._idle_timer_task: Optional[asyncio.Task] = None
        self._safety_net_task: Optional[asyncio.Task] = None

        logger.info(f"YDocClient initialized for file {file_id}")

    async def run(self):
        """Main client loop with auto-reconnection."""
        while not self._shutdown:
            try:
                await self._connect_and_run()
                if not self._shutdown:
                    logger.warning(f"Connection closed for file {self.file_id}, reconnecting...")
                    await self._wait_before_reconnect()
            except ConnectionClosed as e:
                # Code 4000 = intentional server-side cleanup, do not reconnect
                if e.rcvd is not None and e.rcvd.code == 4000:
                    logger.info(f"Server closed connection for cleanup (file {self.file_id}), shutting down client")
                    self._shutdown = True
                    break
                if not self._shutdown:
                    logger.warning(f"WebSocket closed for file {self.file_id}: {e}, reconnecting...")
                    await self._wait_before_reconnect()
            except WebSocketException as e:
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
            self._ws = websocket
            self._reconnect_attempt = 0
            logger.info(f"WebSocket connected for file {self.file_id}")

            # Create Y.Doc
            self.doc = Doc()
            self.text = self.doc.get("text", type=Text)

            # Sync with room first — room state is authoritative.
            # This ensures we see any edits already in the room before deciding
            # whether to seed from the database, preventing CRDT duplication
            # when the backend reconnects to a room that already has newer edits.
            await self._send_sync_step1(websocket)
            await self._receive_sync_step2(websocket)

            # Only seed from DB when the room was empty (first peer to connect,
            # or room was reset). If the room already had content, we absorbed it
            # via SyncStep2 above and must not insert stale DB content on top.
            if len(self.text) == 0:
                await self._load_from_db()
            else:
                # Room had content when we connected. The observer is not set up yet,
                # so SyncStep2 won't trigger _on_text_change. Persist now in case the
                # room is ahead of what's stored (e.g. backend connected after edits).
                await self._save_to_db()

            # Setup observer for persistence
            self.text.observe(self._on_text_change)

            # Handle incoming messages
            await self._message_loop(websocket)

    async def _receive_sync_step2(self, websocket):
        """Receive messages until the room's SyncStep2 has been processed.

        The room sends SyncStep2 (all updates the client is missing) immediately
        in response to our SyncStep1. After processing it, self.text reflects the
        room's authoritative state. Any remaining messages (e.g. the room's own
        SyncStep1) are left in the buffer for _message_loop to handle normally.
        """
        assert self.doc is not None, "doc must be initialized before receiving sync"
        assert self.text is not None, "text must be initialized before receiving sync"
        while True:
            message = await websocket.recv()
            if not message:
                continue

            msg_type = message[0]
            payload = message[1:]

            if msg_type == 0:  # Sync message
                reply = handle_sync_message(payload, self.doc)
                if reply:
                    await websocket.send(reply)
                    logger.debug(f"Sent sync reply for file {self.file_id}")

                # payload[0] == 1 means this was SyncStep2 — the room's update
                # to us. Our doc now has the room's current state.
                if payload and payload[0] == 1:
                    logger.debug(f"Room SyncStep2 received for file {self.file_id}, "
                                 f"text length: {len(self.text)}")
                    return

    async def _send_sync_step1(self, websocket):
        """Send SyncStep1 message to initiate sync."""
        assert self.doc is not None, "doc must be initialized before sending sync"
        sync_message = create_sync_message(self.doc)
        # pycrdt's create_sync_message() already includes the message type bytes
        # No need to prepend anything - send directly
        await websocket.send(sync_message)
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
                # pycrdt's handle_sync_message() already returns properly formatted message
                # No need to prepend message type - send directly
                await websocket.send(reply)
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

        self._record_edit_for_checkpoint()

    def _record_edit_for_checkpoint(self):
        """Increment edit counter and (re)start the idle timer and safety net."""
        self._edit_count_since_checkpoint += 1
        self._restart_idle_timer()

        if self._safety_net_task is None or self._safety_net_task.done():
            self._safety_net_task = asyncio.create_task(self._safety_net_loop())

    def _restart_idle_timer(self):
        if self._idle_timer_task and not self._idle_timer_task.done():
            self._idle_timer_task.cancel()
        self._idle_timer_task = asyncio.create_task(self._idle_timer())

    async def _idle_timer(self):
        try:
            await asyncio.sleep(self.checkpoint_idle_timeout_secs)
            await self._maybe_create_checkpoint()
        except asyncio.CancelledError:
            pass

    async def _safety_net_loop(self):
        """Periodically checkpoint if edits have accumulated without a pause."""
        try:
            while not self._shutdown:
                await asyncio.sleep(self.checkpoint_safety_net_secs)
                if self._edit_count_since_checkpoint > 0:
                    await self._maybe_create_checkpoint(force=True)
        except asyncio.CancelledError:
            pass

    async def _maybe_create_checkpoint(self, force: bool = False) -> None:
        """Create a checkpoint if heuristic conditions are satisfied.

        Parameters
        ----------
        force : bool
            When True (safety net path), bypass the minimum edit count check
            but still require at least one edit and respect the min interval.
        """
        now = datetime.now(timezone.utc)

        if self._last_checkpoint_at is not None:
            elapsed = (now - self._last_checkpoint_at).total_seconds()
            if elapsed < self.checkpoint_min_interval_secs:
                return

        if self._edit_count_since_checkpoint == 0:
            return

        if not force and self._edit_count_since_checkpoint < CHECKPOINT_MIN_EDIT_EVENTS:
            return

        # Reset counters before the async call so concurrent timer firings
        # (idle + safety net) cannot both satisfy the conditions.
        self._last_checkpoint_at = now
        self._edit_count_since_checkpoint = 0

        await self._create_checkpoint()

    async def _create_checkpoint(self) -> None:
        """Look up the file owner and create an auto-checkpoint in the database."""
        from aris.crud.versions import CHECKPOINT_TYPE_AUTO, create_version

        try:
            async with ArisSession() as session:
                result = await session.execute(
                    sql_text("SELECT owner_id FROM files WHERE id = :file_id"),
                    {"file_id": self.file_id},
                )
                row = result.fetchone()
                if not row:
                    logger.warning(f"Cannot checkpoint file {self.file_id}: file not found")
                    return
                owner_id = row[0]

            async with ArisSession() as session:
                await create_version(
                    file_id=self.file_id,
                    user_id=owner_id,
                    checkpoint_type=CHECKPOINT_TYPE_AUTO,
                    db=session,
                )

            logger.info(f"Auto-checkpoint created for file {self.file_id}")

        except Exception as e:
            logger.error(f"Failed to create auto-checkpoint for file {self.file_id}: {e}", exc_info=True)

    def _cancel_checkpoint_tasks(self) -> None:
        """Cancel both checkpoint background tasks."""
        if self._idle_timer_task and not self._idle_timer_task.done():
            self._idle_timer_task.cancel()
        if self._safety_net_task and not self._safety_net_task.done():
            self._safety_net_task.cancel()

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

        self._cancel_checkpoint_tasks()

        if self._save_task and not self._save_task.done():
            self._save_task.cancel()

        # Close the WebSocket to unblock the message loop immediately
        # rather than waiting for the server to send the next message.
        if self._ws is not None:
            await self._ws.close()
