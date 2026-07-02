"""
Tests for the backend Y.js client's auth handshake and reconnection behavior.

1. The backend client must send a JWT auth message as the first WebSocket
   frame and wait for ``{type: 'auth_ok'}`` before any Y.js sync traffic.
2. The backend client must always reconnect after a disconnection (including
   close code 4000) unless explicitly shut down by the CollaborationManager.
"""

import asyncio
import json
from unittest.mock import AsyncMock

from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from websockets.asyncio.server import serve

from aris.collaboration.auth import decode_collab_token
from aris.collaboration.yjs_client import YDocClient


async def _do_auth_handshake(websocket):
    """Receive an auth message, send auth_ok. Returns the decoded payload."""
    raw = await asyncio.wait_for(websocket.recv(), timeout=5.0)
    msg = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode("utf-8"))
    assert msg.get("type") == "auth", f"expected auth message, got {msg}"
    payload = decode_collab_token(msg["token"])
    assert payload is not None, "token failed to verify"
    await websocket.send(json.dumps({"type": "auth_ok"}))
    return payload


async def _echo_server(websocket):
    """Minimal server that performs auth then a Y.js sync handshake."""
    await _do_auth_handshake(websocket)

    room_doc = Doc()
    room_doc.get("text", type=Text)

    # SyncStep1 from client
    raw = await websocket.recv()
    reply = handle_sync_message(raw[1:], room_doc)
    if reply:
        await websocket.send(reply)

    # Send our SyncStep1
    await websocket.send(create_sync_message(room_doc))

    # SyncStep2 from client
    try:
        raw2 = await asyncio.wait_for(websocket.recv(), timeout=1.0)
        if raw2 and raw2[0] == 0:
            reply2 = handle_sync_message(raw2[1:], room_doc)
            if reply2:
                await websocket.send(reply2)
    except asyncio.TimeoutError:
        pass

    await asyncio.sleep(0.3)


async def test_backend_sends_auth_token_first():
    """The backend client must present a backend-role JWT as the first frame."""
    captured: list[dict] = []

    async def tracking_server(websocket):
        payload = await _do_auth_handshake(websocket)
        captured.append(payload)

        room_doc = Doc()
        room_doc.get("text", type=Text)
        raw = await websocket.recv()
        reply = handle_sync_message(raw[1:], room_doc)
        if reply:
            await websocket.send(reply)
        await websocket.send(create_sync_message(room_doc))
        try:
            raw2 = await asyncio.wait_for(websocket.recv(), timeout=1.0)
            if raw2 and raw2[0] == 0:
                reply2 = handle_sync_message(raw2[1:], room_doc)
                if reply2:
                    await websocket.send(reply2)
        except asyncio.TimeoutError:
            pass

    async with serve(tracking_server, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]

        client = YDocClient(
            file_id=42,
            websocket_url=f"ws://127.0.0.1:{port}/file-42-dev",
            debounce_ms=99999,
        )
        client._load_from_db = AsyncMock()
        client._save_to_db = AsyncMock()

        from websockets.exceptions import ConnectionClosed
        try:
            await asyncio.wait_for(client._connect_and_run(), timeout=5.0)
        except (ConnectionClosed, asyncio.TimeoutError):
            pass

    assert captured, "server never received an auth message"
    payload = captured[0]
    assert payload.get("role") == "backend"
    assert payload.get("file_id") == 42


async def test_backend_reconnects_after_code_4000():
    """The backend client must reconnect after receiving close code 4000."""
    connection_count = 0

    async def counting_server(websocket):
        nonlocal connection_count
        connection_count += 1

        await _do_auth_handshake(websocket)

        room_doc = Doc()
        room_doc.get("text", type=Text)

        raw = await websocket.recv()
        reply = handle_sync_message(raw[1:], room_doc)
        if reply:
            await websocket.send(reply)
        await websocket.send(create_sync_message(room_doc))

        try:
            raw2 = await asyncio.wait_for(websocket.recv(), timeout=1.0)
            if raw2 and raw2[0] == 0:
                reply2 = handle_sync_message(raw2[1:], room_doc)
                if reply2:
                    await websocket.send(reply2)
        except asyncio.TimeoutError:
            pass

        await asyncio.sleep(0.2)

        # First connection: close with code 4000 (simulating server cleanup)
        if connection_count == 1:
            await websocket.close(4000, "all-frontends-left")
        # Second connection: close normally
        else:
            await websocket.close()

    async with serve(counting_server, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]

        client = YDocClient(
            file_id=99,
            websocket_url=f"ws://127.0.0.1:{port}/file-99-dev",
            debounce_ms=99999,
        )
        client._load_from_db = AsyncMock()
        client._save_to_db = AsyncMock()
        # Speed up reconnect for testing
        client._max_reconnect_delay = 0.1

        # Run the client for a few seconds — it should connect, get 4000,
        # reconnect, then get a clean close.
        try:
            await asyncio.wait_for(client.run(), timeout=5.0)
        except asyncio.TimeoutError:
            client._shutdown = True

    assert connection_count >= 2, (
        f"Backend client did not reconnect after code 4000. "
        f"Expected at least 2 connections, got {connection_count}"
    )
