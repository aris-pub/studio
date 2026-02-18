"""
CollaborationManager: Manages YDocClient instances for multiple files.

Handles dynamic creation, lifecycle management, and cleanup of backend Y.js clients.
"""

import asyncio
import logging
import os
from typing import Dict, Optional

from .yjs_client import YDocClient


logger = logging.getLogger("aris.collaboration")


class CollaborationManager:
    """
    Manages multiple YDocClient instances for different files.

    Starts clients on-demand when files are accessed and handles cleanup.
    """

    def __init__(self):
        self.clients: Dict[int, YDocClient] = {}
        self.tasks: Dict[int, asyncio.Task] = {}
        self._shutdown = False

        # Get WebSocket server configuration
        multiplayer_host = os.getenv("MULTIPLAYER_HOST", "localhost")
        multiplayer_port = os.getenv("MULTIPLAYER_PORT", "1234")
        self.websocket_base_url = f"ws://{multiplayer_host}:{multiplayer_port}"

        logger.info(f"CollaborationManager initialized with WebSocket base URL: {self.websocket_base_url}")

    async def start_client(self, file_id: int) -> bool:
        """
        Start a YDocClient for the given file if not already running.

        Parameters
        ----------
        file_id : int
            File ID to start collaboration for.

        Returns
        -------
        bool
            True if client started or already running, False on error.
        """
        if file_id in self.clients:
            task = self.tasks.get(file_id)
            if task and not task.done():
                logger.debug(f"YDocClient already running for file {file_id}")
                return True
            # Stale entry — task finished (e.g. received close code 4000), clean up and restart
            logger.info(f"Removing stale YDocClient entry for file {file_id}, restarting")
            self.clients.pop(file_id, None)
            self.tasks.pop(file_id, None)

        try:
            # Use environment namespace to prevent conflicts between dev/test
            env = os.getenv("ENV", "local").lower()
            websocket_url = f"{self.websocket_base_url}/file-{file_id}-{env}"
            logger.info(f"Starting YDocClient for file {file_id} at {websocket_url}")

            debounce_ms = int(os.getenv("YJS_DEBOUNCE_MS", "500"))
            client = YDocClient(
                file_id=file_id,
                websocket_url=websocket_url,
                debounce_ms=debounce_ms,
            )

            task = asyncio.create_task(client.run())
            task.add_done_callback(lambda t, fid=file_id: self._on_client_done(fid))  # type: ignore[misc]
            self.clients[file_id] = client
            self.tasks[file_id] = task

            logger.info(f"YDocClient started for file {file_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to start YDocClient for file {file_id}: {e}", exc_info=True)
            return False

    def _on_client_done(self, file_id: int) -> None:
        """Remove client from registry when its task completes for any reason."""
        self.clients.pop(file_id, None)
        self.tasks.pop(file_id, None)
        logger.info(f"YDocClient task completed for file {file_id}, removed from registry")

    async def stop_client(self, file_id: int) -> bool:
        """
        Stop a YDocClient for the given file.

        Parameters
        ----------
        file_id : int
            File ID to stop collaboration for.

        Returns
        -------
        bool
            True if client stopped, False if not running.
        """
        client = self.clients.get(file_id)
        task = self.tasks.get(file_id)

        if not client or not task:
            logger.debug(f"No YDocClient running for file {file_id}")
            return False

        try:
            logger.info(f"Stopping YDocClient for file {file_id}")
            await client.shutdown()

            # Wait for task to complete with timeout
            try:
                await asyncio.wait_for(task, timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning(f"YDocClient for file {file_id} did not stop gracefully, cancelling")
                task.cancel()

            self.clients.pop(file_id, None)
            self.tasks.pop(file_id, None)

            logger.info(f"YDocClient stopped for file {file_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to stop YDocClient for file {file_id}: {e}", exc_info=True)
            return False

    def is_running(self, file_id: int) -> bool:
        """
        Check if a YDocClient is running for the given file.

        Parameters
        ----------
        file_id : int
            File ID to check.

        Returns
        -------
        bool
            True if client is running.
        """
        return file_id in self.clients

    async def shutdown_all(self):
        """Shutdown all running YDocClient instances."""
        logger.info(f"Shutting down CollaborationManager ({len(self.clients)} clients)")
        self._shutdown = True

        # Shutdown all clients in parallel
        shutdown_tasks = []
        for file_id in list(self.clients.keys()):
            shutdown_tasks.append(self.stop_client(file_id))

        if shutdown_tasks:
            await asyncio.gather(*shutdown_tasks, return_exceptions=True)

        logger.info("CollaborationManager shutdown complete")

    def get_active_files(self) -> list[int]:
        """
        Get list of file IDs with active collaboration clients.

        Returns
        -------
        list[int]
            List of file IDs.
        """
        return list(self.clients.keys())


# Global collaboration manager instance
_collaboration_manager: Optional[CollaborationManager] = None


def get_collaboration_manager() -> CollaborationManager:
    """
    Get the global CollaborationManager instance.

    Returns
    -------
    CollaborationManager
        The global manager instance.
    """
    global _collaboration_manager
    if _collaboration_manager is None:
        _collaboration_manager = CollaborationManager()
    return _collaboration_manager
