"""Unit tests for CollaborationManager.flush (std-es20w7)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from aris.collaboration.manager import CollaborationManager


@pytest.mark.asyncio
async def test_flush_saves_when_a_client_is_running():
    manager = CollaborationManager()
    client = MagicMock()
    client.text = "some content"
    client._save_to_db = AsyncMock()
    manager.clients = {7: client}

    result = await manager.flush(7)

    assert result is True
    client._save_to_db.assert_awaited_once_with(force=True)


@pytest.mark.asyncio
async def test_flush_is_a_noop_when_no_client_is_running():
    manager = CollaborationManager()
    manager.clients = {}

    result = await manager.flush(7)

    assert result is False
