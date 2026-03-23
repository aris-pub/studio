"""
YDocClient: Backend Y.js WebSocket client with PostgreSQL persistence.

Uses pycrdt's native sync protocol which is compatible with JavaScript y-websocket.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from pycrdt._sync import YSyncMessageType, create_message
from sqlalchemy import text as sql_text
from websockets import ClientConnection, connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from aris.deps import CollabSession


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

        # Flag to skip observer during sync operations (prevents duplicate saves)
        self._in_sync_operation = False

        # Y.js state
        self.doc: Optional[Doc] = None
        self.text: Optional[Text] = None
        self._has_seeded = False

        # Persistence state — single save loop with debounce event instead of
        # cancel+recreate, preventing overlapping DB connections.
        self._save_task: Optional[asyncio.Task] = None
        self._save_event: asyncio.Event = asyncio.Event()
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
                if e.rcvd is not None and e.rcvd.code == 4000:
                    logger.info(f"Server cleanup close for file {self.file_id} (all frontends left)")
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
        # Cancel any lingering save loop from a previous connection
        if self._save_task and not self._save_task.done():
            self._save_task.cancel()
            try:
                await self._save_task
            except asyncio.CancelledError:
                pass
        self._save_event.clear()

        # Identify as the backend client so the server's cleanup logic
        # knows not to kill frontends when we disconnect (hot-reload, crash).
        url = self.websocket_url + ("&" if "?" in self.websocket_url else "?") + "role=backend"
        logger.info(f"Connecting to {url} for file {self.file_id}")

        async with connect(url, open_timeout=10, close_timeout=5) as websocket:
            self._ws = websocket
            self._reconnect_attempt = 0
            # Scope the websockets library's internal logger to this file so that
            # PING/PONG/keepalive log lines show "websockets.client.file_N" and
            # can be identified after tests.
            websocket.logger = logging.getLogger(f"websockets.client.file_{self.file_id}")
            logger.info(f"WebSocket connected for file {self.file_id}")

            # Create Y.Doc
            self.doc = Doc()
            self.text = self.doc.get("text", type=Text)

            # Setup document-level observer IMMEDIATELY - before any sync operations.
            # This ensures ALL updates (local and remote) trigger persistence,
            # eliminating timing gaps. This is the official pycrdt-websocket pattern.
            self.doc.observe(self._on_doc_change)
            logger.debug(f"Document observer attached for file {self.file_id}")

            # Sync with room first — room state is authoritative.
            # This ensures we see any edits already in the room before deciding
            # whether to seed from the database, preventing CRDT duplication
            # when the backend reconnects to a room that already has newer edits.
            await self._send_sync_step1(websocket)
            await self._receive_sync_step2(websocket)

            # Only seed from DB once, ever. The _has_seeded flag prevents
            # re-seeding on reconnect (which creates a fresh Doc each time,
            # so len(self.text)==0 would be true again on a new Doc).
            if len(self.text) == 0 and not self._has_seeded:
                # Set flag to prevent observer from saving during DB load
                self._in_sync_operation = True
                state_before_load = self.doc.get_state()
                try:
                    await self._load_from_db()
                    self._has_seeded = True
                finally:
                    self._in_sync_operation = False

                # Broadcast DB content to all connected clients via WebSocket.
                # Without this, the frontend never receives the DB-loaded content
                # and hangs waiting for the backend to seed the document.
                if len(self.text) > 0:
                    update = self.doc.get_update(state_before_load)
                    update_msg = create_message(update, YSyncMessageType.SYNC_UPDATE)
                    await websocket.send(update_msg)
                    logger.info(f"Broadcast DB content to room for file {self.file_id} "
                                f"({len(self.text)} chars)")

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
            message = await asyncio.wait_for(websocket.recv(), timeout=15.0)
            if not message:
                continue

            msg_type = message[0]
            payload = message[1:]

            if msg_type == 0:  # Sync message
                # Set flag to prevent observer from triggering persistence during sync
                self._in_sync_operation = True
                try:
                    reply = handle_sync_message(payload, self.doc)
                finally:
                    self._in_sync_operation = False

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

    async def _handle_message(self, websocket, message):
        """Handle a single WebSocket message."""
        if not message:
            return

        assert self.doc is not None, "doc must be initialized before handling messages"

        # y-websocket protocol: first byte is message type
        msg_type = message[0]
        payload = message[1:]

        if msg_type == 0:  # Sync message
            # Only suppress observer for SyncStep1/SyncStep2 handshake (sub-types 0, 1).
            # Update messages (sub-type 2) are normal user edits and must trigger persistence.
            is_handshake = payload and payload[0] in (0, 1)
            if is_handshake:
                self._in_sync_operation = True
            try:
                reply = handle_sync_message(payload, self.doc)
            finally:
                if is_handshake:
                    self._in_sync_operation = False

            if reply:
                # pycrdt's handle_sync_message() already returns properly formatted message
                # No need to prepend message type - send directly
                await websocket.send(reply)
                logger.debug(f"Sent sync reply for file {self.file_id}")

    async def _load_from_db(self):
        """Load file content from database and initialize Y.Text."""
        assert self.doc is not None, "doc must be initialized before loading from DB"
        assert self.text is not None, "text must be initialized before loading from DB"

        async with CollabSession() as session:
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
                        if len(self.text) > 0:
                            del self.text[0:len(self.text)]
                        self.text += content

                    logger.info(f"Y.Text initialized for file {self.file_id}")
                else:
                    logger.warning(f"No content found in DB for file {self.file_id}, starting empty")

            except Exception as e:
                logger.error(f"Failed to load content from DB for file {self.file_id}: {e}", exc_info=True)
                raise

    def _on_doc_change(self, event):
        """Observer callback for document changes (local or remote).

        Uses call_soon_threadsafe so it's safe even if pycrdt fires the
        observer from a non-event-loop thread.
        """
        if self._in_sync_operation:
            return
        try:
            loop = asyncio.get_event_loop()
            loop.call_soon_threadsafe(self._signal_save)
        except RuntimeError:
            pass

    def _signal_save(self):
        """Schedule a save — runs on the event loop thread."""
        self._save_event.set()
        if self._save_task is None or self._save_task.done():
            self._save_task = asyncio.create_task(self._save_loop())
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
            async with CollabSession() as session:
                result = await session.execute(
                    sql_text("SELECT owner_id FROM files WHERE id = :file_id"),
                    {"file_id": self.file_id},
                )
                row = result.fetchone()
                if not row:
                    logger.warning(f"Cannot checkpoint file {self.file_id}: file not found")
                    return
                owner_id = row[0]

            async with CollabSession() as session:
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

    async def _save_loop(self):
        """Single persistent loop: wait for change signal, debounce, save serially.

        Only one instance runs per client at a time.  Each save holds a DB
        connection for the minimum duration, and no two saves overlap.
        """
        try:
            while not self._shutdown:
                await self._save_event.wait()
                self._save_event.clear()
                # Debounce: keep waiting while edits keep arriving
                while True:
                    try:
                        await asyncio.wait_for(self._save_event.wait(), timeout=self.debounce_ms / 1000.0)
                        self._save_event.clear()
                    except asyncio.TimeoutError:
                        break  # No new edits within debounce window — save now
                await self._save_to_db()
        except asyncio.CancelledError:
            pass

    async def _save_to_db(self, force: bool = False):
        """Persist current Y.Text content to database."""
        if not self.text:
            return

        try:
            content = str(self.text)

            async with CollabSession() as session:
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

        # Stop the save loop, then do one final save with no overlap
        if self._save_task and not self._save_task.done():
            self._save_task.cancel()
            try:
                await self._save_task
            except asyncio.CancelledError:
                pass

        try:
            await asyncio.wait_for(self._save_to_db(force=True), timeout=2.0)
        except asyncio.TimeoutError:
            logger.warning(f"Final save timed out for file {self.file_id}")
        except Exception as e:
            logger.warning(f"Final save failed for file {self.file_id}: {e}")

        # Close the WebSocket to unblock the message loop immediately
        if self._ws is not None:
            await self._ws.close()
