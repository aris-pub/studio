"""
Tests for the YDocClient readiness signal — Option 2 prerequisite.

The CollaborationManager and the multi-player auto-bootstrap both need to
know when a YDocClient has actually joined its room and finished the initial
sync handshake (so any caller that subsequently writes to the room is
guaranteed there is a backend peer to relay updates to and persist them).

The contract:
- ``YDocClient._ready: asyncio.Event`` is created in ``__init__`` (initially clear).
- ``_connect_and_run`` clears ``_ready`` on entry (so reconnects cycle the flag).
- After SyncStep1/SyncStep2 + the DB-seed broadcast (or skip), ``_ready`` is set.
- ``CollaborationManager.start_client(file_id)`` awaits ``_ready.wait()`` with
  a timeout and returns ``False`` if the client never becomes ready.
- The "already running" branch in ``start_client`` also awaits ``_ready`` —
  otherwise concurrent callers can get a vacuous ``True`` from a half-started
  client mid-reconnect.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pycrdt import Doc, Text

from aris.collaboration.manager import CollaborationManager
from aris.collaboration.yjs_client import YDocClient


def _make_client():
    c = YDocClient(
        file_id=42,
        websocket_url="ws://localhost:9999",
        debounce_ms=50,
    )
    c.doc = Doc()
    c.text = c.doc.get("text", type=Text)
    return c


# ---------------------------------------------------------------------------
# YDocClient._ready exists and is initially clear
# ---------------------------------------------------------------------------


class TestReadyAttribute:
    def test_ready_event_exists_after_init(self):
        client = _make_client()
        assert hasattr(client, "_ready"), "YDocClient must expose a _ready event"
        assert isinstance(client._ready, asyncio.Event), (
            "YDocClient._ready must be an asyncio.Event"
        )

    def test_ready_event_initially_clear(self):
        client = _make_client()
        assert not client._ready.is_set(), (
            "YDocClient._ready must start cleared (not yet ready)"
        )


# ---------------------------------------------------------------------------
# CollaborationManager.start_client awaits _ready
# ---------------------------------------------------------------------------


@pytest.fixture
def manager():
    """Fresh manager instance — bypasses the global singleton to keep tests isolated."""
    return CollaborationManager()


class TestStartClientAwaitsReadiness:
    """``start_client`` must not return True until the YDocClient is in the room."""

    @pytest.mark.asyncio
    async def test_returns_true_after_client_ready(self, manager):
        """When the YDocClient sets _ready, start_client returns True."""
        # Build a fake YDocClient: client.run() blocks forever; we set _ready manually.
        fake_client = MagicMock(spec=YDocClient)
        fake_client.file_id = 7
        fake_client._ready = asyncio.Event()
        fake_client.run = AsyncMock(side_effect=lambda: asyncio.sleep(60))

        with patch("aris.collaboration.manager.YDocClient", return_value=fake_client):
            # Mark ready shortly after start_client begins awaiting — this proves
            # start_client actually waits for the event rather than returning
            # immediately after spawning the run task.
            async def trip():
                await asyncio.sleep(0.05)
                fake_client._ready.set()

            asyncio.create_task(trip())
            ok = await manager.start_client(7)

        assert ok is True
        assert fake_client._ready.is_set()
        # Cleanup
        task = manager.tasks.get(7)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    @pytest.mark.asyncio
    async def test_returns_false_if_ready_never_fires(self, manager, monkeypatch):
        """If the client never becomes ready within the timeout, start_client returns False."""
        # Drop the readiness timeout to keep the test fast.
        monkeypatch.setenv("YJS_READY_TIMEOUT_SECS", "0.1")

        fake_client = MagicMock(spec=YDocClient)
        fake_client.file_id = 8
        fake_client._ready = asyncio.Event()  # never set
        fake_client.run = AsyncMock(side_effect=lambda: asyncio.sleep(60))

        with patch("aris.collaboration.manager.YDocClient", return_value=fake_client):
            ok = await manager.start_client(8)

        assert ok is False
        # Cleanup
        task = manager.tasks.get(8)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    @pytest.mark.asyncio
    async def test_actually_awaits_does_not_return_immediately(self, manager):
        """If we never set _ready, start_client must NOT return True quickly."""
        fake_client = MagicMock(spec=YDocClient)
        fake_client.file_id = 9
        fake_client._ready = asyncio.Event()  # never set
        fake_client.run = AsyncMock(side_effect=lambda: asyncio.sleep(60))

        with patch("aris.collaboration.manager.YDocClient", return_value=fake_client):
            # If start_client doesn't await _ready, this returns nearly instantly.
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(manager.start_client(9), timeout=0.05)

        # Cleanup
        task = manager.tasks.get(9)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass


class TestStartClientAlreadyRunningAwaitsReadiness:
    """The 'already running' branch must also await ``_ready`` so concurrent callers
    don't see a half-started client as ready."""

    @pytest.mark.asyncio
    async def test_already_running_awaits_ready(self, manager):
        """A second call while a client is already running must also wait for _ready."""
        fake_client = MagicMock(spec=YDocClient)
        fake_client.file_id = 10
        fake_client._ready = asyncio.Event()
        fake_client.run = AsyncMock(side_effect=lambda: asyncio.sleep(60))

        with patch("aris.collaboration.manager.YDocClient", return_value=fake_client):
            # First call: start the client. Set _ready early so the first call returns.
            asyncio.create_task(_set_after(fake_client._ready, 0.02))
            ok1 = await manager.start_client(10)
            assert ok1 is True

            # Now clear _ready to simulate a mid-reconnect window where the client
            # is running but not yet ready again.
            fake_client._ready.clear()

            # Second call should wait for _ready before returning True.
            asyncio.create_task(_set_after(fake_client._ready, 0.05))
            t0 = asyncio.get_event_loop().time()
            ok2 = await manager.start_client(10)
            elapsed = asyncio.get_event_loop().time() - t0

        assert ok2 is True
        assert elapsed >= 0.04, (
            f"Expected to wait at least 40ms for ready, but returned in {elapsed:.3f}s"
        )

        # Cleanup
        task = manager.tasks.get(10)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass


async def _set_after(event: asyncio.Event, delay: float):
    await asyncio.sleep(delay)
    event.set()


# ---------------------------------------------------------------------------
# _connect_and_run cycles _ready (clear at start)
# ---------------------------------------------------------------------------


class TestReadyClearedOnReconnect:
    """``_connect_and_run`` must ``_ready.clear()`` on entry so a stale True
    from a previous connection doesn't unblock callers prematurely.

    We can't easily run _connect_and_run end-to-end without a websocket server,
    but we can verify the *signal cycling* by inspecting the source: the clear
    must be called inside _connect_and_run, before the WS connect.
    """

    @pytest.mark.asyncio
    async def test_ready_clear_called_in_connect_and_run(self):
        """Patch asyncio.Event.clear and verify _connect_and_run invokes it via self._ready.clear()."""
        client = _make_client()
        # Start ready=True from a previous connection
        client._ready.set()

        # Make connect() raise immediately so we don't actually need a server,
        # but only AFTER _ready.clear() was called.
        clear_call_log = []
        original_clear = client._ready.clear

        def tracking_clear():
            clear_call_log.append(True)
            return original_clear()

        client._ready.clear = tracking_clear  # type: ignore[method-assign]

        from websockets.exceptions import InvalidURI

        with patch(
            "aris.collaboration.yjs_client.connect",
            side_effect=InvalidURI("ws://nonexistent", "test"),
        ):
            with pytest.raises(Exception):
                await client._connect_and_run()

        assert clear_call_log, "_connect_and_run must call self._ready.clear() on entry"
        assert not client._ready.is_set(), "_ready must be cleared after _connect_and_run entry"
