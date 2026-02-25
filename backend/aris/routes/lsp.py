"""LSP WebSocket proxy endpoint.

Bridges browser WebSocket connections to the stdio-based RSM LSP server.
"""

import asyncio
import os
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from aris.logging_config import get_logger


logger = get_logger(__name__)
router = APIRouter()


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

    Accepts WebSocket connections from the browser and proxies LSP
    JSON-RPC messages to/from the stdio-based RSM LSP server.
    """
    await websocket.accept()
    logger.info("LSP WebSocket connection accepted")

    proxy = LSPProxy(websocket)

    try:
        await proxy.start()
    finally:
        await proxy.cleanup()
        logger.info("LSP WebSocket connection closed")
