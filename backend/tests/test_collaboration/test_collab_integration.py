"""End-to-end collaboration integration tests through the real manager/client.

The rest of test_collaboration/ covers the pieces in isolation (readiness logic
with a mocked client, flush ordering with a mocked _save_to_db, the sync
handshake by driving _connect_and_run directly). These tests close the three
gaps std-0ydjjo names by wiring the real pieces together:

  1. readiness through the real CollaborationManager against a real in-process
     y-websocket room (not a MagicMock client),
  2. auto-bootstrap: the backend client joins the room and the room's content
     persists to the DB,
  3. flush-on-disconnect actually writes the latest in-memory edit to the DB,
     not merely calls _save_to_db.

The in-process server here is a thin relay built on pycrdt (both ends use the
same library, so it is not a second implementation of the wire protocol). It
reproduces only the JWT auth ack, the sync step 1/2 handshake, and staying in
the room. Anything past that (role-based write filtering, the code-4000
teardown, multi-peer broadcast ordering) lives in multi-player/server.js and
stays covered by the e2e-collab job, which is the certification of record.
"""

import json

import pytest
from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

from aris.collaboration import yjs_client
from aris.collaboration.manager import CollaborationManager
from aris.collaboration.yjs_client import YDocClient


ROOM_CONTENT = "# Shared Heading\n\nContent already in the room."


class _CapturingSession:
    """Async-context DB session that records the params of the last UPDATE.

    _save_to_db writes ``UPDATE files SET source = :content, ydoc_state = ...``
    then commits, so ``params["content"]`` is what actually reached the DB.
    """

    def __init__(self):
        self.committed = False
        self.params = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, statement, params):
        self.params = params
        return None

    async def commit(self):
        self.committed = True


async def _room_server(websocket):
    """A y-websocket room preloaded with ROOM_CONTENT that stays open.

    Consumes the JWT auth handshake, does the 4-message sync handshake, then
    relays any further sync messages until the client disconnects. Staying open
    is what lets the manager-driven client remain connected and ready for the
    duration of a test (unlike the one-shot servers in test_yjs_client_crdt).
    """
    auth_raw = await websocket.recv()
    auth_msg = json.loads(auth_raw if isinstance(auth_raw, str) else auth_raw.decode("utf-8"))
    assert auth_msg.get("type") == "auth"
    await websocket.send(json.dumps({"type": "auth_ok"}))

    room_doc = Doc()
    room_text = room_doc.get("text", type=Text)
    with room_doc.transaction():
        room_text += ROOM_CONTENT

    raw = await websocket.recv()
    assert raw[0] == 0, f"Expected sync message type (0), got {raw[0]}"
    reply = handle_sync_message(raw[1:], room_doc)
    if reply:
        await websocket.send(reply)

    await websocket.send(create_sync_message(room_doc))

    try:
        async for msg in websocket:
            if msg and msg[0] == 0:
                r = handle_sync_message(msg[1:], room_doc)
                if r:
                    await websocket.send(r)
    except ConnectionClosed:
        pass


@pytest.mark.asyncio
async def test_start_client_becomes_ready_against_real_room(monkeypatch):
    """The real manager brings a real client to readiness via the real handshake.

    Existing readiness tests use a MagicMock client whose _ready is set by hand.
    This proves start_client returns True only after an actual YDocClient joins
    the room and completes sync.
    """
    monkeypatch.setenv("YJS_READY_TIMEOUT_SECS", "5")
    monkeypatch.setattr(yjs_client, "CollabSession", lambda: _CapturingSession())

    async with serve(_room_server, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        manager = CollaborationManager()
        manager.websocket_base_url = f"ws://127.0.0.1:{port}"

        try:
            ok = await manager.start_client(101)
            assert ok is True
            assert 101 in manager.clients
            assert manager.clients[101]._ready.is_set()
        finally:
            await manager.shutdown_all()


@pytest.mark.asyncio
async def test_auto_bootstrap_joins_room_and_persists(monkeypatch):
    """Backend client joins the room, picks up the room's content, and it persists.

    This is the backend half of auto-bootstrap. The multi-player trigger that
    calls /internal/collab/start when a frontend connects lives in server.js and
    stays E2E-only; here we call start_client directly and assert the joined
    content reaches the DB.
    """
    monkeypatch.setenv("YJS_READY_TIMEOUT_SECS", "5")
    session = _CapturingSession()
    monkeypatch.setattr(yjs_client, "CollabSession", lambda: session)

    async with serve(_room_server, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        manager = CollaborationManager()
        manager.websocket_base_url = f"ws://127.0.0.1:{port}"

        try:
            ok = await manager.start_client(202)
            assert ok is True

            # force=True save, so the assertion does not race the debounce loop
            flushed = await manager.flush(202)
            assert flushed is True
        finally:
            await manager.shutdown_all()

    assert session.committed is True
    assert session.params is not None
    assert "Shared Heading" in session.params["content"], (
        "Backend joined the room but the room's content did not reach the DB: "
        f"{session.params['content']!r}"
    )


@pytest.mark.asyncio
async def test_flush_on_disconnect_persists_latest_edit(monkeypatch):
    """A pending in-memory edit reaches the DB when the reconnect flush fires.

    test_yjs_client_flush_on_disconnect proves run() calls _flush_before_reconnect
    before the reconnect wait, and that it forces a save, but with _save_to_db
    mocked. This proves the edit itself lands: no debounce-window data loss.
    """
    session = _CapturingSession()
    monkeypatch.setattr(yjs_client, "CollabSession", lambda: session)

    client = YDocClient(file_id=303, websocket_url="ws://localhost:9999", debounce_ms=50)
    client.doc = Doc()
    client.text = client.doc.get("text", type=Text)
    with client.doc.transaction():
        client.text += "edit made just before the 4000 close"

    await client._flush_before_reconnect()

    assert session.committed is True
    assert session.params is not None
    assert session.params["content"] == "edit made just before the 4000 close"
