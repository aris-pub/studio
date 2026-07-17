"""
YDocClient: Backend Y.js WebSocket client with PostgreSQL persistence.

Uses pycrdt's native sync protocol which is compatible with JavaScript y-websocket.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from pycrdt._sync import YSyncMessageType, create_message
from sqlalchemy import text as sql_text
from websockets import ClientConnection, connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from aris.deps import CollabSession
from aris.services.file_events import get_event_broker

from .auth import mint_collab_token


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

        # Persistence state — single save loop with debounce event instead of
        # cancel+recreate, preventing overlapping DB connections.
        self._save_task: Optional[asyncio.Task] = None
        self._save_event: asyncio.Event = asyncio.Event()
        self._shutdown = False
        self._ws: Optional[ClientConnection] = None  # Active WebSocket, set during connection

        # Readiness signal — set after the client has joined the room and
        # completed the SyncStep1/SyncStep2 handshake (and the optional DB-seed
        # broadcast). Cleared on every reconnect so callers see a fresh value.
        # Callers that need the YDocClient to be in the room (CollaborationManager,
        # multi-player auto-bootstrap) await this event with a timeout.
        self._ready: asyncio.Event = asyncio.Event()

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
                    await self._flush_before_reconnect()
                    await self._wait_before_reconnect()
            except ConnectionClosed as e:
                if e.rcvd is not None and e.rcvd.code == 4000:
                    # All frontends left and the multi-player server tore the room
                    # down. Our next reconnect rejoins an empty, freshly recreated
                    # room; the seed gate (len(text) == 0 in _connect_and_run) then
                    # restores from ydoc_state. That restore is idempotent, so it
                    # is safe even if a frontend races back into the room before
                    # us — no duplication, and no "edits lost after reload".
                    logger.info(
                        f"Server cleanup close for file {self.file_id} "
                        f"(all frontends left); will restore from DB on reconnect"
                    )
                if not self._shutdown:
                    logger.warning(f"WebSocket closed for file {self.file_id}: {e}, reconnecting...")
                    await self._flush_before_reconnect()
                    await self._wait_before_reconnect()
            except WebSocketException as e:
                if not self._shutdown:
                    logger.warning(f"WebSocket error for file {self.file_id}: {e}, reconnecting...")
                    await self._flush_before_reconnect()
                    await self._wait_before_reconnect()
            except Exception as e:
                logger.error(f"Unexpected error in YDocClient for file {self.file_id}: {e}", exc_info=True)
                if not self._shutdown:
                    await self._flush_before_reconnect()
                    await self._wait_before_reconnect()

        logger.info(f"YDocClient for file {self.file_id} shut down")

    async def _flush_before_reconnect(self):
        """Persist any pending edits before entering the reconnect-wait.

        The save_loop may be mid-debounce when the connection closes (e.g. a
        code-4000 ``all-frontends-left`` kick from the multiplayer server).
        Cancelling it without flushing first drops the pending ``_save_event``
        and loses the most recent edit. This helper cancels the loop cleanly
        and forces a synchronous save.

        Failures in the flush are swallowed: the reconnect loop must always
        proceed, otherwise the YDocClient gets stuck.
        """
        if self._save_task and not self._save_task.done():
            self._save_task.cancel()
            try:
                await self._save_task
            except asyncio.CancelledError:
                logger.debug(
                    f"Cancelled save task during flush-before-reconnect for file {self.file_id}"
                )
        try:
            await asyncio.wait_for(self._save_to_db(force=True), timeout=2.0)
        except asyncio.TimeoutError:
            logger.warning(f"Flush before reconnect timed out for file {self.file_id}")
        except Exception as e:
            logger.warning(f"Flush before reconnect failed for file {self.file_id}: {e}")

    async def _connect_and_run(self):
        """Connect to WebSocket server and run until disconnection."""
        # Reset readiness so callers see a stale-True from a previous connection
        # only after this connection has finished its sync handshake.
        self._ready.clear()

        # Cancel any lingering save loop from a previous connection
        if self._save_task and not self._save_task.done():
            self._save_task.cancel()
            try:
                await self._save_task
            except asyncio.CancelledError:
                logger.debug(f"Cancelled lingering save task for file {self.file_id}")
        self._save_event.clear()

        # Role is established via the auth JWT sent as the first message;
        # the server uses it to drive role-aware cleanup so frontend edits
        # survive a backend hot-reload.
        logger.info(f"Connecting to {self.websocket_url} for file {self.file_id}")

        async with connect(self.websocket_url, open_timeout=10, close_timeout=5) as websocket:
            self._ws = websocket
            self._reconnect_attempt = 0
            # Scope the websockets library's internal logger to this file so that
            # PING/PONG/keepalive log lines show "websockets.client.file_N" and
            # can be identified after tests.
            websocket.logger = logging.getLogger(f"websockets.client.file_{self.file_id}")
            logger.info(f"WebSocket connected for file {self.file_id}")

            await self._authenticate(websocket)

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

            # Restore from DB whenever the room is empty after sync. Restores go
            # through ydoc_state via apply_update (idempotent), so re-restoring on
            # reconnect — even into a room a surviving peer later repopulates —
            # cannot duplicate content. A NULL ydoc_state falls back to a one-time
            # plaintext seed inside _load_from_db.
            if len(self.text) == 0:
                # Set flag to prevent observer from saving during DB load
                self._in_sync_operation = True
                state_before_load = self.doc.get_state()
                try:
                    await self._load_from_db()
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

            # Now in the room with sync complete and DB seed broadcast (if any).
            # Callers awaiting readiness can proceed.
            self._ready.set()

            # Handle incoming messages
            await self._message_loop(websocket)

    async def _authenticate(self, websocket):
        """Send the auth message and wait for the server's ack.

        The multi-player server expects ``{type: 'auth', token: '<jwt>'}`` as
        the first JSON text frame and replies with ``{type: 'auth_ok'}``
        before any Y.js binary traffic. Failure → server closes with code
        4401; we let that surface as a ConnectionClosed in the run loop.
        """
        token = mint_collab_token(
            user_id="backend",
            file_id=self.file_id,
            role="backend",
        )
        await websocket.send(json.dumps({"type": "auth", "token": token}))

        try:
            raw = await asyncio.wait_for(websocket.recv(), timeout=10.0)
        except asyncio.TimeoutError as exc:
            raise WebSocketException(
                f"No auth response from multi-player for file {self.file_id}"
            ) from exc

        if isinstance(raw, bytes):
            raise WebSocketException(
                f"Expected JSON auth_ok, got binary frame for file {self.file_id}"
            )

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise WebSocketException(
                f"Multi-player auth response was not JSON for file {self.file_id}"
            ) from exc

        if payload.get("type") != "auth_ok":
            raise WebSocketException(
                f"Multi-player rejected auth for file {self.file_id}: {payload!r}"
            )

        logger.debug(f"WebSocket authenticated for file {self.file_id}")

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
        """Restore the document from the database.

        Prefers the authoritative CRDT state (``ydoc_state``): applying it is
        idempotent, so reconnecting and re-restoring — even into a room a
        surviving peer has repopulated — cannot duplicate content. Only when a
        file has no ``ydoc_state`` yet (legacy row, or one never opened since this
        column landed) do we fall back to a ONE-TIME seed from the plaintext
        ``source`` and immediately persist the encoded state, after which the file
        is CRDT-state authoritative forever.
        """
        assert self.doc is not None, "doc must be initialized before loading from DB"
        assert self.text is not None, "text must be initialized before loading from DB"

        try:
            async with CollabSession() as session:
                result = await session.execute(
                    sql_text("SELECT source, ydoc_state FROM files WHERE id = :file_id"),
                    {"file_id": self.file_id},
                )
                row = result.fetchone()
        except Exception as e:
            logger.error(f"Failed to load content from DB for file {self.file_id}: {e}", exc_info=True)
            raise

        if not row:
            logger.warning(f"No file row for {self.file_id}, starting empty")
            return

        source, ydoc_state = row[0], row[1]

        if ydoc_state:
            # Idempotent restore: the encoded state carries the original CRDT item
            # IDs, so applying it (even over a surviving peer's identical items) is
            # a no-op merge — no duplication regardless of reconnect count.
            self.doc.apply_update(bytes(ydoc_state))
            logger.info(
                f"Restored {len(self.text)} chars from ydoc_state for file {self.file_id}"
            )
            return

        if source:
            # Legacy / never-collaborated file: no CRDT state yet. Seed once from
            # plaintext, then persist the encoded state so this branch never runs
            # again for this file.
            self._seed_doc_from_plaintext(source)
            await self._save_to_db(force=True)
            logger.info(
                f"Seeded file {self.file_id} from source ({len(source)} chars) "
                f"and persisted initial ydoc_state"
            )
        else:
            logger.warning(f"No content found in DB for file {self.file_id}, starting empty")

    def _seed_doc_from_plaintext(self, content: str) -> None:
        """Type stored plaintext into the live Doc. THE ONLY such call site.

        Minting CRDT items from a text value is non-idempotent: the item IDs are
        fresh, so doing this more than once (or concurrently with another peer)
        merges duplicate copies — the root cause of the historical content
        duplication (1x -> 2x -> 4x). It is safe ONLY as a one-time conversion for
        a file with no authoritative ``ydoc_state``. Never call it from a
        reconnect/sync path; those restore via apply_update(ydoc_state) instead.
        """
        assert self.doc is not None and self.text is not None
        with self.doc.transaction():
            if len(self.text) > 0:
                del self.text[0 : len(self.text)]
            self.text += content

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
            logger.warning(
                f"No event loop available for file {self.file_id} — "
                f"document change will not trigger persistence"
            )

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
            logger.debug(f"Idle checkpoint timer cancelled for file {self.file_id}")

    async def _safety_net_loop(self):
        """Periodically checkpoint if edits have accumulated without a pause."""
        try:
            while not self._shutdown:
                await asyncio.sleep(self.checkpoint_safety_net_secs)
                if self._edit_count_since_checkpoint > 0:
                    await self._maybe_create_checkpoint(force=True)
        except asyncio.CancelledError:
            logger.debug(f"Safety net checkpoint loop cancelled for file {self.file_id}")

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
            logger.debug(f"Save loop cancelled for file {self.file_id}")

    async def _save_to_db(self, force: bool = False):
        """Persist the document to the database.

        Writes the authoritative CRDT state (``ydoc_state``) and the derived
        plaintext projection (``source``) together in one transaction. Restores
        go through ``ydoc_state`` via apply_update (idempotent); ``source`` exists
        only for compile / LSP / search / checkpoints and is never re-typed into a
        live Doc.
        """
        if self.doc is None or not self.text:
            return

        try:
            content = str(self.text)
            ydoc_state = self.doc.get_update()

            async with CollabSession() as session:
                await session.execute(
                    sql_text(
                        "UPDATE files SET source = :content, ydoc_state = :ydoc_state "
                        "WHERE id = :file_id"
                    ),
                    {
                        "content": content,
                        "ydoc_state": ydoc_state,
                        "file_id": self.file_id,
                    },
                )
                await session.commit()

                action = "Final save" if force else "Saved"
                logger.debug(
                    f"{action}: {len(content)} chars / {len(ydoc_state)}B state "
                    f"to DB for file {self.file_id}"
                )

        except Exception as e:
            logger.error(f"Failed to save content to DB for file {self.file_id}: {e}", exc_info=True)
            return

        # Only reached when the write committed. Ack real persistence to open tabs
        # (std-wmjv) so the editor can show a true "saved" state instead of merely a
        # relay-connected one, closing the silent data-loss window.
        self._publish_persisted()

    def _publish_persisted(self) -> None:
        """Notify this file's open tabs that a DB write just committed.

        Best-effort and fully isolated from the save path: a broker/publish error
        must never turn a successful save into a failure, so it is caught here and
        only logged. Runs in-process (the broker is a singleton and this client
        shares the process), so ``publish`` is a cheap non-blocking fan-out.
        """
        try:
            get_event_broker().publish(
                self.file_id,
                {"type": "persisted", "at": int(time.time() * 1000)},
            )
        except Exception as e:
            logger.warning(
                f"Failed to publish persisted event for file {self.file_id}: {e}"
            )

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
                logger.debug(f"Cancelled save task during shutdown for file {self.file_id}")

        try:
            await asyncio.wait_for(self._save_to_db(force=True), timeout=2.0)
        except asyncio.TimeoutError:
            logger.warning(f"Final save timed out for file {self.file_id}")
        except Exception as e:
            logger.warning(f"Final save failed for file {self.file_id}: {e}")

        # Close the WebSocket to unblock the message loop immediately
        if self._ws is not None:
            await self._ws.close()
