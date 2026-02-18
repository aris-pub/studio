"""
Regression test for the Y.js CRDT content duplication bug in yjs_client.py.

Bug: _connect_and_run() creates a fresh Doc(), calls _load_from_db() to insert
stale DB content with new client IDs, and ONLY THEN syncs with the WebSocket room.
If the room already has edits, Y.js CRDT keeps both versions (different client IDs)
→ permanent content duplication that propagates to all peers.

Fix: sync with room first, then call _load_from_db() only if len(self.text) == 0.
"""

import asyncio
from unittest.mock import AsyncMock

from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

from aris.collaboration.yjs_client import YDocClient


ORIGINAL_CONTENT = "# Test Heading\n\nOriginal paragraph."
EDITED_CONTENT = "# Test Heading EDIT1\n\nOriginal paragraph."


async def _room_server(websocket):
    """
    Minimal y-websocket room handler with pre-existing edited content.

    Implements the 4-message sync handshake:
      1. Receive SyncStep1 from client → reply with SyncStep2
      2. Send our own SyncStep1 → client replies with SyncStep2
    """
    room_doc = Doc()
    room_text = room_doc.get("text", type=Text)
    with room_doc.transaction():
        room_text += EDITED_CONTENT

    # Step 1a: receive client's SyncStep1 (first byte is message type 0)
    raw = await websocket.recv()
    assert raw[0] == 0, f"Expected sync message type (0), got {raw[0]}"
    # pycrdt's handle_sync_message already includes the type byte in its reply
    reply = handle_sync_message(raw[1:], room_doc)
    if reply:
        await websocket.send(reply)

    # Step 1b: send our SyncStep1 so the client sends us its SyncStep2
    # pycrdt's create_sync_message already includes the type byte
    await websocket.send(create_sync_message(room_doc))

    # Step 2: receive the client's SyncStep2 (its state update for us)
    try:
        raw2 = await asyncio.wait_for(websocket.recv(), timeout=2.0)
        if raw2 and raw2[0] == 0:
            reply2 = handle_sync_message(raw2[1:], room_doc)
            if reply2:
                await websocket.send(reply2)
    except asyncio.TimeoutError:
        pass  # client had nothing to send us — fine

    # Brief pause to ensure client processes the SyncStep2 it received, then close
    await asyncio.sleep(0.3)


async def test_reconnect_does_not_duplicate_content():
    """
    YDocClient must not duplicate content when reconnecting to a room that already
    has newer edits than what is in the database.

    Scenario:
      - Room already contains EDITED_CONTENT (frontend made edits while backend
        was disconnected or not yet connected).
      - Backend reconnects: _connect_and_run() creates a fresh Doc(), calls
        _load_from_db() which inserts ORIGINAL_CONTENT (stale DB state) with
        brand-new client IDs.
      - Backend then syncs with room via SyncStep1/2.
      - Y.js CRDT sees two sets of items with different client IDs, keeps both
        → ORIGINAL_CONTENT + EDITED_CONTENT = permanent duplication.

    After the fix (_load_from_db only when len(self.text) == 0 after room sync),
    the client's text must contain only EDITED_CONTENT.
    """
    async with serve(_room_server, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]

        client = YDocClient(
            file_id=999,
            websocket_url=f"ws://127.0.0.1:{port}",
            debounce_ms=99999,  # prevent debounced DB save from firing during test
        )

        # Stub _load_from_db to inject stale original content — exactly what the
        # real method does on reconnect when the DB has not yet seen the edits.
        async def fake_load_from_db():
            with client.doc.transaction():
                client.text += ORIGINAL_CONTENT

        client._load_from_db = fake_load_from_db
        client._save_to_db = AsyncMock()

        try:
            await asyncio.wait_for(client._connect_and_run(), timeout=5.0)
        except ConnectionClosed:
            pass  # expected: server closes after sync completes

    result = str(client.text)

    heading_count = result.count("# Test Heading")
    assert heading_count == 1, (
        f"Y.js CRDT duplication detected: '# Test Heading' appears {heading_count} times "
        f"in the Y.js document.\n"
        f"This means _load_from_db() inserted stale DB content on top of the room's "
        f"existing edits.\n"
        f"Full content ({len(result)} chars): {result!r}"
    )
    assert "EDIT1" in result, (
        f"Expected EDITED_CONTENT to be present after sync, got: {result!r}"
    )
