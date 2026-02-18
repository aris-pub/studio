"""Tests for collaboration lifecycle endpoints.

POST /files/{id}/collab/start  — frontend signals editor is open
POST /files/{id}/collab/stop   — frontend signals editor is closed
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from aris.crud.file import create_file
from aris.crud.permissions import create_permission
from aris.models.models import FileRole


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _collab_url(file_id: int, action: str) -> str:
    return f"/files/{file_id}/collab/{action}"


async def _create_file(db: AsyncSession, owner_id: int) -> int:
    file = await create_file(source="# Test", owner_id=owner_id, db=db)
    return file.id


# ---------------------------------------------------------------------------
# /collab/start
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_collab_start_requires_auth(client: AsyncClient, authenticated_user, db_session):
    file_id = await _create_file(db_session, authenticated_user["user_id"])
    response = await client.post(_collab_url(file_id, "start"))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_collab_start_404_for_unknown_file(authenticated_client: AsyncClient):
    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_get.return_value.start_client = AsyncMock(return_value=True)
        response = await authenticated_client.post(_collab_url(99999, "start"))
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_collab_start_forbidden_for_non_editor(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """A user without EDIT permission cannot start a collaboration session."""
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    # Register a second user and give them only VIEW permission
    reg = await client.post(
        "/register",
        json={"email": "viewer@example.com", "name": "Viewer", "initials": "VW", "password": "pw123456"},
    )
    assert reg.status_code == 200
    viewer_token = reg.json()["access_token"]
    viewer_id = reg.json()["user"]["id"]

    await create_permission(
        file_id=file_id,
        user_id=viewer_id,
        role=FileRole.COMMENTER,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )

    response = await client.post(
        _collab_url(file_id, "start"),
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_collab_start_calls_manager(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_manager = mock_get.return_value
        mock_manager.start_client = AsyncMock(return_value=True)

        response = await authenticated_client.post(_collab_url(file_id, "start"))

    assert response.status_code == status.HTTP_200_OK
    mock_manager.start_client.assert_called_once_with(file_id)


@pytest.mark.asyncio
async def test_collab_start_returns_already_running_gracefully(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """Calling start when already running is idempotent."""
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_manager = mock_get.return_value
        mock_manager.start_client = AsyncMock(return_value=True)

        r1 = await authenticated_client.post(_collab_url(file_id, "start"))
        r2 = await authenticated_client.post(_collab_url(file_id, "start"))

    assert r1.status_code == status.HTTP_200_OK
    assert r2.status_code == status.HTTP_200_OK
    assert mock_manager.start_client.call_count == 2


# ---------------------------------------------------------------------------
# /collab/stop
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_collab_stop_requires_auth(client: AsyncClient, authenticated_user, db_session):
    file_id = await _create_file(db_session, authenticated_user["user_id"])
    response = await client.post(_collab_url(file_id, "stop"))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_collab_stop_succeeds_for_unknown_file(authenticated_client: AsyncClient):
    """Stop is idempotent even when the file no longer exists in the database.

    This matters because the frontend fires /collab/stop during onBeforeUnmount,
    which can race with the file being deleted (e.g. in test teardown).
    """
    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_get.return_value.stop_client = AsyncMock(return_value=False)
        response = await authenticated_client.post(_collab_url(99999, "stop"))
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.asyncio
async def test_collab_stop_calls_manager(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_manager = mock_get.return_value
        mock_manager.stop_client = AsyncMock(return_value=True)

        response = await authenticated_client.post(_collab_url(file_id, "stop"))

    assert response.status_code == status.HTTP_200_OK
    mock_manager.stop_client.assert_called_once_with(file_id)


@pytest.mark.asyncio
async def test_collab_stop_when_not_running_is_fine(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """Stopping a client that isn't running should not error."""
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_manager = mock_get.return_value
        mock_manager.stop_client = AsyncMock(return_value=False)  # not running

        response = await authenticated_client.post(_collab_url(file_id, "stop"))

    assert response.status_code == status.HTTP_200_OK
