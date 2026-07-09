"""Tests for collaboration lifecycle endpoints.

POST /files/{id}/collab/start  — frontend signals editor is open
POST /files/{id}/collab/stop   — frontend signals editor is closed
"""

from unittest.mock import AsyncMock, MagicMock, patch

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
async def test_collab_start_forbidden_for_commenter(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """A COMMENTER (VIEW permission) cannot mint a WS auth token via /collab/start.

    The multi-player server does not currently enforce role-based write
    restrictions on Y.js frames, so any user holding a valid token can inject
    updates that the backend persists. Until read-only enforcement lands
    server-side, the /collab/start gate stays at ``require_edit`` to prevent
    COMMENTER-role privilege escalation into write access.
    """
    file_id = await _create_file(db_session, authenticated_user["user_id"])

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
async def test_collab_start_forbidden_for_user_without_any_role(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """A user with no role on the file cannot start a session."""
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    reg = await client.post(
        "/register",
        json={"email": "stranger@example.com", "name": "Stranger", "initials": "ST", "password": "pw123456"},
    )
    assert reg.status_code == 200
    stranger_token = reg.json()["access_token"]

    response = await client.post(
        _collab_url(file_id, "start"),
        headers={"Authorization": f"Bearer {stranger_token}"},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_collab_start_forbidden_for_user_without_permission_row(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """A user with NO FilePermission row at all cannot start collab on another user's file.

    Regression test for std-p1djel: user 2 (no permission row) must not be able to
    POST /files/{id}/collab/start for a file owned by user 1.
    """
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    reg = await client.post(
        "/register",
        json={"email": "stranger@example.com", "name": "Stranger", "initials": "ST", "password": "pw123456"},
    )
    assert reg.status_code == 200
    stranger_token = reg.json()["access_token"]

    response = await client.post(
        _collab_url(file_id, "start"),
        headers={"Authorization": f"Bearer {stranger_token}"},
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
async def test_collab_start_returns_valid_token(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """The token returned by /collab/start must verify and carry the right claims."""
    from aris.collaboration.auth import decode_collab_token

    file_id = await _create_file(db_session, authenticated_user["user_id"])

    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_get.return_value.start_client = AsyncMock(return_value=True)
        response = await authenticated_client.post(_collab_url(file_id, "start"))

    assert response.status_code == status.HTTP_200_OK
    token = response.json()["token"]
    payload = decode_collab_token(token)
    assert payload is not None
    assert payload["file_id"] == file_id
    assert payload["role"] == "OWNER"  # creator is owner
    assert payload["sub"] == str(authenticated_user["user_id"])


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
async def test_collab_stop_404_for_unknown_file(authenticated_client: AsyncClient):
    """Stop rejects unknown files with 404.

    The ``require_edit`` gate (mirroring /collab/start) checks file existence
    before running the handler, so a stop for a file that does not exist is a
    404 rather than a silent success.
    """
    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_get.return_value.stop_client = AsyncMock(return_value=False)
        response = await authenticated_client.post(_collab_url(99999, "stop"))
    assert response.status_code == status.HTTP_404_NOT_FOUND


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


@pytest.mark.asyncio
async def test_collab_stop_forbidden_for_user_without_permission(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """A user with no role on the file cannot stop its collab client.

    Regression test: /collab/stop was previously only login-gated, so any
    authenticated user could stop the Y.js client of any file (IDOR).
    """
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    reg = await client.post(
        "/register",
        json={"email": "stranger@example.com", "name": "Stranger", "initials": "ST", "password": "pw123456"},
    )
    assert reg.status_code == 200
    stranger_token = reg.json()["access_token"]

    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_get.return_value.stop_client = AsyncMock(return_value=True)
        response = await client.post(
            _collab_url(file_id, "stop"),
            headers={"Authorization": f"Bearer {stranger_token}"},
        )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# /collab/flush
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_collab_flush_requires_auth(client: AsyncClient, authenticated_user, db_session):
    file_id = await _create_file(db_session, authenticated_user["user_id"])
    response = await client.post(_collab_url(file_id, "flush"))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_collab_flush_saves_for_owner(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """The file owner can flush; the client's content is persisted."""
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    mock_client = MagicMock()
    mock_client.text = "content"
    mock_client._save_to_db = AsyncMock()

    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_get.return_value.clients = {file_id: mock_client}
        response = await authenticated_client.post(_collab_url(file_id, "flush"))

    assert response.status_code == status.HTTP_200_OK
    mock_client._save_to_db.assert_awaited_once_with(force=True)


@pytest.mark.asyncio
async def test_collab_flush_forbidden_for_user_without_permission(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """A user with no role on the file cannot flush its collab client.

    Regression test: /collab/flush was previously only login-gated, so any
    authenticated user could force-persist any file's Y.js client (IDOR).
    """
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    reg = await client.post(
        "/register",
        json={"email": "stranger@example.com", "name": "Stranger", "initials": "ST", "password": "pw123456"},
    )
    assert reg.status_code == 200
    stranger_token = reg.json()["access_token"]

    with patch("aris.routes.file.get_collaboration_manager") as mock_get:
        mock_get.return_value.clients = {}
        response = await client.post(
            _collab_url(file_id, "flush"),
            headers={"Authorization": f"Bearer {stranger_token}"},
        )

    assert response.status_code == status.HTTP_403_FORBIDDEN
