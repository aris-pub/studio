"""
Regression test for the Y.js room name mismatch bug.

Bug: CollaborationManager used ENV directly to build room names. With ENV=LOCAL
(the default for local dev), the backend joined room "file-{id}-local", while the
frontend used VITE_ENV=DEV → "file-{id}-dev". They never shared a Y.js room, so
the backend never seeded or persisted content for the frontend.

Fix: Normalize LOCAL → dev in manager.py so both sides join the same room.
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


class TestRoomNameEnvNormalization:
    """ENV=LOCAL must map to 'dev' so the backend joins the same room as the frontend."""

    def test_env_local_uppercase_produces_dev(self, manager):
        url = _extract_room_url(manager, FILE_ID, "LOCAL")
        assert url.endswith(f"file-{FILE_ID}-dev")

    def test_env_dev_unchanged(self, manager):
        url = _extract_room_url(manager, FILE_ID, "DEV")
        assert url.endswith(f"file-{FILE_ID}-dev")

    def test_env_test_unchanged(self, manager):
        url = _extract_room_url(manager, FILE_ID, "TEST")
        assert url.endswith(f"file-{FILE_ID}-test")

    def test_env_ci_unchanged(self, manager):
        url = _extract_room_url(manager, FILE_ID, "CI")
        assert url.endswith(f"file-{FILE_ID}-ci")

    def test_env_staging_unchanged(self, manager):
        url = _extract_room_url(manager, FILE_ID, "STAGING")
        assert url.endswith(f"file-{FILE_ID}-staging")

    def test_env_prod_unchanged(self, manager):
        url = _extract_room_url(manager, FILE_ID, "PROD")
        assert url.endswith(f"file-{FILE_ID}-prod")

    def test_env_unset_defaults_to_dev(self, manager):
        url = _extract_room_url(manager, FILE_ID, None)
        assert url.endswith(f"file-{FILE_ID}-dev")

    @pytest.mark.parametrize("env_value", ["Local", "local", "LOCAL", "LoCAl"])
    def test_case_insensitivity(self, manager, env_value):
        url = _extract_room_url(manager, FILE_ID, env_value)
        assert url.endswith(f"file-{FILE_ID}-dev"), (
            f"ENV={env_value!r} should produce room suffix 'dev', got URL: {url}"
        )
