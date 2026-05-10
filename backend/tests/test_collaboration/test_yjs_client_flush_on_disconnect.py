"""
Tests for flush-on-disconnect: pending edits must be persisted before the
YDocClient enters its reconnect-wait, otherwise CLI updates that arrived just
before a code-4000 ``all-frontends-left`` close are lost.

Bug: ``run()``'s exception handlers go straight to ``_wait_before_reconnect``
without flushing the in-memory Y.Text. The save_loop, mid-debounce when the
close arrives, gets cancelled at the start of the next ``_connect_and_run``
(line ~111) and the pending ``_save_event`` is dropped on the floor.

Fix: a ``_flush_before_reconnect`` helper that cancels the save_loop and forces
``_save_to_db(force=True)`` synchronously, called from every reconnect path in
``run()`` BEFORE ``_wait_before_reconnect``.
"""

import asyncio
from unittest.mock import AsyncMock

import pytest
from pycrdt import Doc, Text
from websockets.exceptions import ConnectionClosed
from websockets.frames import Close

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


def _connection_closed_4000() -> ConnectionClosed:
    """Build a ConnectionClosed exception that matches multi-player's all-frontends-left close."""
    rcvd = Close(4000, "all-frontends-left")
    sent = Close(4000, "all-frontends-left")
    # rcvd_then_sent: True means the close was received first then echoed; required
    # when both rcvd and sent are non-None.
    return ConnectionClosed(rcvd, sent, rcvd_then_sent=True)


# ---------------------------------------------------------------------------
# _flush_before_reconnect helper
# ---------------------------------------------------------------------------


class TestFlushBeforeReconnectHelper:
    """The new helper must exist and do the right thing in isolation."""

    @pytest.mark.asyncio
    async def test_helper_exists(self):
        client = _make_client()
        assert hasattr(client, "_flush_before_reconnect"), (
            "YDocClient must expose _flush_before_reconnect()"
        )

    @pytest.mark.asyncio
    async def test_helper_calls_save_to_db_force_true(self):
        client = _make_client()
        client._save_to_db = AsyncMock()  # type: ignore[method-assign]
        await client._flush_before_reconnect()
        client._save_to_db.assert_awaited_once_with(force=True)

    @pytest.mark.asyncio
    async def test_helper_cancels_running_save_task(self):
        client = _make_client()
        client._save_to_db = AsyncMock()  # type: ignore[method-assign]
        # Start the save loop so there's a task to cancel
        client._save_task = asyncio.create_task(client._save_loop())
        await asyncio.sleep(0.01)
        assert not client._save_task.done()

        await client._flush_before_reconnect()

        assert client._save_task.done(), "save_task should be cancelled by the helper"

    @pytest.mark.asyncio
    async def test_helper_swallows_db_errors_so_reconnect_proceeds(self):
        """If the flush itself errors, the helper must not propagate — reconnect must continue."""
        client = _make_client()
        client._save_to_db = AsyncMock(side_effect=RuntimeError("DB down"))  # type: ignore[method-assign]
        # Should NOT raise
        await client._flush_before_reconnect()


# ---------------------------------------------------------------------------
# run() call ordering: flush MUST happen before _wait_before_reconnect
# ---------------------------------------------------------------------------


async def _drive_one_iteration(client: YDocClient, exc: Exception | None):
    """Run client.run() for exactly one iteration and then signal shutdown.

    If ``exc`` is provided, _connect_and_run raises it; otherwise returns normally.
    """
    call_order: list[str] = []

    async def fake_connect_and_run():
        if exc is not None:
            raise exc

    async def fake_flush():
        call_order.append("flush")

    async def fake_wait():
        call_order.append("wait")
        # After the first iteration, signal shutdown so run() exits cleanly
        client._shutdown = True

    client._connect_and_run = fake_connect_and_run  # type: ignore[method-assign]
    client._flush_before_reconnect = fake_flush  # type: ignore[method-assign]
    client._wait_before_reconnect = fake_wait  # type: ignore[method-assign]

    await asyncio.wait_for(client.run(), timeout=1.0)
    return call_order


class TestRunFlushOrdering:
    """run() must call _flush_before_reconnect BEFORE _wait_before_reconnect on every reconnect path."""

    @pytest.mark.asyncio
    async def test_normal_close_flushes_before_wait(self):
        client = _make_client()
        order = await _drive_one_iteration(client, exc=None)
        assert order == ["flush", "wait"], (
            f"Expected flush before wait on normal close; got {order}"
        )

    @pytest.mark.asyncio
    async def test_connection_closed_4000_flushes_before_wait(self):
        client = _make_client()
        order = await _drive_one_iteration(client, exc=_connection_closed_4000())
        assert order == ["flush", "wait"], (
            f"Expected flush before wait on code-4000 close; got {order}"
        )

    @pytest.mark.asyncio
    async def test_generic_websocket_exception_flushes_before_wait(self):
        from websockets.exceptions import WebSocketException

        client = _make_client()
        order = await _drive_one_iteration(client, exc=WebSocketException("boom"))
        assert order == ["flush", "wait"], (
            f"Expected flush before wait on WebSocketException; got {order}"
        )

    @pytest.mark.asyncio
    async def test_unexpected_exception_flushes_before_wait(self):
        client = _make_client()
        order = await _drive_one_iteration(client, exc=RuntimeError("unexpected"))
        assert order == ["flush", "wait"], (
            f"Expected flush before wait on unexpected exception; got {order}"
        )

    @pytest.mark.asyncio
    async def test_shutdown_path_does_not_call_flush_before_reconnect(self):
        """If _shutdown is already True, run() exits without calling flush_before_reconnect.

        (Final flush is the responsibility of shutdown(), not the reconnect path.)
        """
        client = _make_client()
        client._shutdown = True
        client._connect_and_run = AsyncMock()  # type: ignore[method-assign]
        client._flush_before_reconnect = AsyncMock()  # type: ignore[method-assign]
        client._wait_before_reconnect = AsyncMock()  # type: ignore[method-assign]

        await asyncio.wait_for(client.run(), timeout=1.0)

        client._flush_before_reconnect.assert_not_awaited()
        client._wait_before_reconnect.assert_not_awaited()
