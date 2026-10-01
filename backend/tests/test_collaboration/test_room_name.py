"""
Regression test for the Y.js room name.

The room name used to carry an environment suffix (file-{id}-{env}): the frontend
derived {env} from VITE_ENV and the backend from ENV, and those could disagree
(VITE_ENV=preview vs backend ENV=PROD on previews), putting the two in different
rooms so nothing synced (std-0g12).

Fix: drop the suffix. The room is file-{id}, independent of ENV. Each deployment
runs its own multiplayer server, so rooms cannot collide across environments
without it.
"""

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from aris.collaboration.manager import CollaborationManager


FILE_ID = 42


def _extract_room_url(manager: CollaborationManager, file_id: int, env_value: str | None) -> str:
    """
    Call start_client with a mocked YDocClient and ENV, return the websocket_url
    that YDocClient was constructed with.
    """
    captured_url = None

    def fake_ydoc_client(**kwargs):
        nonlocal captured_url
        captured_url = kwargs["websocket_url"]
        mock_client = MagicMock()
        mock_client.run = MagicMock(return_value=asyncio.sleep(9999))
        return mock_client

    env_patch = {"MULTIPLAYER_HOST": "localhost", "MULTIPLAYER_PORT": "1234"}
    if env_value is not None:
        env_patch["ENV"] = env_value

    with patch.dict("os.environ", env_patch, clear=True):
        # Re-init so __init__ picks up the patched MULTIPLAYER_* vars
        manager.__init__()

        with patch("aris.collaboration.manager.YDocClient", side_effect=fake_ydoc_client):
            loop = asyncio.get_event_loop()
            loop.run_until_complete(manager.start_client(file_id))

    # Cancel the spawned task to avoid warnings
    task = manager.tasks.pop(file_id, None)
    if task:
        task.cancel()
    manager.clients.pop(file_id, None)

    assert captured_url is not None, "YDocClient was never instantiated"
    return captured_url


@pytest.fixture
def manager():
    with patch.dict("os.environ", {"MULTIPLAYER_HOST": "localhost", "MULTIPLAYER_PORT": "1234"}, clear=True):
        return CollaborationManager()


class TestRoomNameHasNoEnvSuffix:
    """The room name is file-{id}, with no environment suffix, for any ENV."""

    @pytest.mark.parametrize(
        "env_value", ["LOCAL", "local", "DEV", "TEST", "CI", "STAGING", "PROD", None]
    )
    def test_room_is_env_independent(self, manager, env_value):
        url = _extract_room_url(manager, FILE_ID, env_value)
        assert url.endswith(f"file-{FILE_ID}"), (
            f"ENV={env_value!r} should produce room 'file-{FILE_ID}' with no suffix, got: {url}"
        )
