"""LSP WebSocket proxy endpoint.

Bridges browser WebSocket connections to the stdio-based RSM LSP server.
"""

import asyncio
import os
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from aris.config import settings
from aris.jwt import decode_token
from aris.logging_config import get_logger


logger = get_logger(__name__)
router = APIRouter()

# The browser passes the access JWT as a WebSocket subprotocol, ["lsp", <token>],
# because an <img>/WebSocket cannot send an Authorization header. Verifying it
# during the handshake lets us reject before accept(), so an unauthenticated
# client never gets an accepted socket, let alone a subprocess.
LSP_SUBPROTOCOL = "lsp"

# Reject any inbound frame larger than this before forwarding it to the language
# server, so one huge frame cannot amplify into a parser memory/CPU spike.
MAX_LSP_FRAME_BYTES = 512 * 1024

# In-memory concurrency registry. The asyncio loop is single-threaded, so as long
# as no await sits between the check and the increment in _try_acquire_lsp_slot,
# a plain int + dict need no lock.
_active_global = 0
_active_per_user: dict[int, int] = {}


def _extract_lsp_user_id(websocket: WebSocket) -> Optional[int]:
    """Return the authenticated user id from the ["lsp", <token>] subprotocol.

    Returns None (caller rejects the handshake) for a missing/malformed
    subprotocol, an invalid or expired access token, a refresh token, or a token
    with no numeric subject. Pure and sync so the auth contract is unit-testable
    without standing up a socket.
    """
    protocols = websocket.scope.get("subprotocols") or []
    if len(protocols) < 2 or protocols[0] != LSP_SUBPROTOCOL:
        return None
    payload = decode_token(protocols[1])
    if not payload or payload.get("type") == "refresh":
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        return int(sub)
    except (TypeError, ValueError):
        return None


def _try_acquire_lsp_slot(user_id: int) -> bool:
    """Reserve a session slot if under both the global and per-user caps."""
    global _active_global
    if _active_global >= settings.LSP_MAX_CONCURRENT_SESSIONS:
        return False
    if _active_per_user.get(user_id, 0) >= settings.LSP_MAX_SESSIONS_PER_USER:
        return False
    _active_global += 1
    _active_per_user[user_id] = _active_per_user.get(user_id, 0) + 1
    return True


def _release_lsp_slot(user_id: int) -> None:
    """Release a previously acquired slot. Floored so a double-release is safe."""
    global _active_global
    _active_global = max(0, _active_global - 1)
    remaining = _active_per_user.get(user_id, 0) - 1
    if remaining <= 0:
        _active_per_user.pop(user_id, None)
    else:
        _active_per_user[user_id] = remaining


class LSPProxy:
    """Proxy between WebSocket and stdio LSP server."""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.process: Optional[asyncio.subprocess.Process] = None
        self.running = False

    async def start(self):
        """Spawn LSP server process and start proxying."""
        # Determine LSP server path based on environment
        if os.getenv("ENV") in ("PROD", "STAGING"):
            # Production: LSP server in Docker image
            lsp_path = "/app/rsm-lsp/dist/server.js"
        else:
            # Development: LSP server from workspace volume mount
            lsp_path = "/workspace/rsm/packages/rsm-lsp/dist/server.js"

        if not os.path.exists(lsp_path):
            logger.error(f"LSP server not found at {lsp_path}")
            await self.websocket.close(code=1011, reason="LSP server not available")
            return

        try:
            # Spawn LSP server process with stdio
            self.process = await asyncio.create_subprocess_exec(
                "node",
                lsp_path,
                "--stdio",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            logger.info(f"Spawned LSP server process (PID: {self.process.pid})")
            self.running = True

            # Start bidirectional proxy
            await asyncio.gather(
                self._proxy_websocket_to_stdin(),
                self._proxy_stdout_to_websocket(),
                self._log_stderr(),
            )

        except Exception as e:
            logger.error(f"LSP proxy error: {e}", exc_info=True)
            await self.cleanup()

    async def _proxy_websocket_to_stdin(self):
        """Forward messages from WebSocket to LSP server stdin."""
        try:
            while self.running:
                # Receive JSON-RPC message from WebSocket
                data = await self.websocket.receive_text()

                # Guard against an oversized frame amplifying into the parser.
                if len(data.encode("utf-8")) > MAX_LSP_FRAME_BYTES:
                    logger.warning("Rejecting oversized LSP frame")
                    self.running = False
                    break

                if not self.process or not self.process.stdin:
                    break

                # LSP protocol: Content-Length header + JSON payload
                content = data.encode("utf-8")
                message = f"Content-Length: {len(content)}\r\n\r\n{data}"

                self.process.stdin.write(message.encode("utf-8"))
                await self.process.stdin.drain()

                logger.debug(f"→ LSP server: {data[:100]}...")

        except WebSocketDisconnect:
            logger.info("WebSocket disconnected")
            self.running = False
        except Exception as e:
            logger.error(f"WebSocket → stdin proxy error: {e}", exc_info=True)
            self.running = False

    async def _proxy_stdout_to_websocket(self):
        """Forward messages from LSP server stdout to WebSocket."""
        try:
            buffer = b""

            while self.running and self.process and self.process.stdout:
                # Read from LSP server stdout
                chunk = await self.process.stdout.read(4096)
                if not chunk:
                    break

                buffer += chunk

                # Parse LSP protocol messages (Content-Length header + JSON)
                while b"\r\n\r\n" in buffer:
                    # Extract header
                    header_end = buffer.index(b"\r\n\r\n")
                    header = buffer[:header_end].decode("utf-8")
                    buffer = buffer[header_end + 4 :]

                    # Parse Content-Length
                    content_length = None
                    for line in header.split("\r\n"):
                        if line.startswith("Content-Length:"):
                            content_length = int(line.split(":")[1].strip())
                            break

                    if content_length is None:
                        logger.warning("Missing Content-Length header")
                        continue

                    # Wait for complete message
                    while len(buffer) < content_length:
                        chunk = await self.process.stdout.read(4096)
                        if not chunk:
                            break
                        buffer += chunk

                    # Extract JSON payload
                    payload = buffer[:content_length].decode("utf-8")
                    buffer = buffer[content_length:]

                    if not self.running:
                        break

                    # Send to WebSocket
                    await self.websocket.send_text(payload)
                    logger.debug(f"← LSP server: {payload[:100]}...")

        except RuntimeError as e:
            if "websocket.close" in str(e) or "response already completed" in str(e):
                logger.debug(f"WebSocket closed while sending LSP response: {e}")
            else:
                logger.error(f"stdout → WebSocket proxy error: {e}", exc_info=True)
            self.running = False
        except Exception as e:
            logger.error(f"stdout → WebSocket proxy error: {e}", exc_info=True)
            self.running = False

    async def _log_stderr(self):
        """Log LSP server stderr output."""
        try:
            while self.running and self.process and self.process.stderr:
                line = await self.process.stderr.readline()
                if not line:
                    break

                stderr_output = line.decode("utf-8").strip()
                if stderr_output:
                    logger.info(f"LSP stderr: {stderr_output}")

        except Exception as e:
            logger.error(f"stderr logging error: {e}", exc_info=True)

    async def cleanup(self):
        """Clean up LSP server process."""
        self.running = False

        if self.process:
            try:
                logger.info(f"Terminating LSP server process (PID: {self.process.pid})")
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("LSP server didn't terminate, killing")
                self.process.kill()
                await self.process.wait()
            except Exception as e:
                logger.error(f"Error terminating LSP server: {e}", exc_info=True)


@router.websocket("/ws/lsp")
async def lsp_websocket(websocket: WebSocket):
    """WebSocket endpoint for LSP communication.

    Proxies LSP JSON-RPC between the browser and the stdio RSM LSP server. Because
    each connection spawns a node subprocess, nothing is spent until the caller is
    authenticated (via the ["lsp", <access-jwt>] subprotocol, checked before the
    handshake is accepted) and a concurrency slot is free.
    """
    user_id = _extract_lsp_user_id(websocket)
    if user_id is None:
        # Reject during the handshake: no accepted socket, no subprocess.
        await websocket.close(code=1008)
        logger.info("LSP WebSocket rejected: unauthenticated")
        return

    if not _try_acquire_lsp_slot(user_id):
        await websocket.accept(subprotocol=LSP_SUBPROTOCOL)
        await websocket.close(code=1013)  # try again later
        logger.warning(f"LSP WebSocket rejected: session cap reached (user {user_id})")
        return

    await websocket.accept(subprotocol=LSP_SUBPROTOCOL)
    logger.info(f"LSP WebSocket connection accepted (user {user_id})")

    proxy = LSPProxy(websocket)
    try:
        await proxy.start()
    finally:
        await proxy.cleanup()
        _release_lsp_slot(user_id)
        logger.info(f"LSP WebSocket connection closed (user {user_id})")
