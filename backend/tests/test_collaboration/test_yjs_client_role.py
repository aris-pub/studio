"""
Tests for the backend Y.js client's role identification and reconnection behavior.

1. The backend client must connect with ?role=backend so the multiplayer
   server's cleanup logic can distinguish it from frontend clients.
2. The backend client must always reconnect after a disconnection (including
   close code 4000) unless explicitly shut down by the CollaborationManager.
"""

import asyncio
from unittest.mock import AsyncMock

from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from websockets.asyncio.server import serve

from aris.collaboration.yjs_client import YDocClient


async def _echo_server(websocket):
    """Minimal server that records the request path and does Y.js sync."""
    # Store the request path for assertions
    websocket._test_path = websocket.request.path
    if hasattr(websocket.request, 'query_string'):
        websocket._test_query = websocket.request.query_string

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


async def test_backend_connects_with_role_param():
    """The backend client must include ?role=backend in the WebSocket URL."""
    received_paths = []

    async def tracking_server(websocket):
        # Capture the full request path + query string
        path = str(websocket.request.path)
        # websockets parses the URL; query params are in request.path
        received_paths.append(path)
        await _echo_server(websocket)

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

    assert len(received_paths) > 0, "Server never received a connection"
    assert "role=backend" in received_paths[0], (
        f"Backend client did not include ?role=backend in URL. Got: {received_paths[0]}"
    )


async def test_backend_reconnects_after_code_4000():
    """
    The backend client must reconnect after receiving close code 4000
    (server cleanup). It should NOT treat 4000 as a permanent shutdown.
    """
    connection_count = 0

    async def counting_server(websocket):
        nonlocal connection_count
        connection_count += 1

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
