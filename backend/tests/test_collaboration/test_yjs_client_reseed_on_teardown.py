"""
Regression: edits are lost after a page reload.

Reproduction in production: a user types (edits relay through the backend and
the preview recompiles), then reloads the page. After the reload the editor
shows the *old* content — the just-typed edits are gone.

Root cause: when the last frontend disconnects, the multi-player server kicks
the backend YDocClient with close code 4000 ("all-frontends-left") and tears
the room down. The YDocClient flushes to the DB and then reconnects — but
``_connect_and_run`` builds a *fresh, empty* ``Doc`` every time and the
one-time ``_has_seeded`` guard suppresses the DB re-seed. So the backend
rejoins the now-empty room holding an empty document and serves *that* to the
next editor that opens, masking the content that is safely in the DB.

Fix: on a 4000 close (and only then — no frontends remain) clear
``_has_seeded`` so the next ``_connect_and_run`` re-seeds from the DB. A plain
reconnect with live frontends still present must NOT reset the guard, or the
backend would re-seed stale DB content over the frontends' newer edits.
"""

import asyncio

import pytest
from pycrdt import Doc, Text
from websockets.exceptions import ConnectionClosed, WebSocketException
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


def _connection_closed(code: int, reason: str) -> ConnectionClosed:
    close = Close(code, reason)
    return ConnectionClosed(close, close, rcvd_then_sent=True)


async def _drive_one_iteration(client: YDocClient, exc: Exception):
    """Run client.run() for exactly one iteration with _connect_and_run raising ``exc``."""

    async def fake_connect_and_run():
        raise exc

    async def fake_flush():
        pass

    async def fake_wait():
        # Stop after the first reconnect so run() exits.
        client._shutdown = True

    client._connect_and_run = fake_connect_and_run  # type: ignore[method-assign]
    client._flush_before_reconnect = fake_flush  # type: ignore[method-assign]
    client._wait_before_reconnect = fake_wait  # type: ignore[method-assign]

    await asyncio.wait_for(client.run(), timeout=1.0)


class TestReseedOnRoomTeardown:
    @pytest.mark.asyncio
    async def test_4000_close_clears_has_seeded(self):
        """A 4000 (all-frontends-left) close must re-arm the DB seed."""
        client = _make_client()
        client._has_seeded = True

        await _drive_one_iteration(client, _connection_closed(4000, "all-frontends-left"))

        assert client._has_seeded is False, (
            "after the room is torn down the backend must re-seed from the DB on "
            "reconnect, otherwise it serves an empty document to the next editor"
        )

    @pytest.mark.asyncio
    async def test_non_4000_close_keeps_has_seeded(self):
        """A plain reconnect (frontends still present) must NOT re-seed.

        Re-seeding here would pull stale DB content into a fresh Doc and merge
        it with the frontends' newer in-room edits, duplicating/garbling text.
        """
        client = _make_client()
        client._has_seeded = True

        await _drive_one_iteration(client, _connection_closed(1006, "abnormal-closure"))

        assert client._has_seeded is True

    @pytest.mark.asyncio
    async def test_generic_websocket_exception_keeps_has_seeded(self):
        client = _make_client()
        client._has_seeded = True

        await _drive_one_iteration(client, WebSocketException("boom"))

        assert client._has_seeded is True
