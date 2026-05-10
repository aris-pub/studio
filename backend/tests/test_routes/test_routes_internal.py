"""Tests for internal infrastructure endpoints.

These endpoints are not user-facing — they are called by trusted infrastructure
(currently the multi-player WebSocket server) and authenticated via a shared
secret rather than user JWTs.

POST /internal/collab/start  — multi-player asks backend to ensure a YDocClient
                                is in a given file's room (auto-bootstrap path
                                for Option 2: persistence works for any client
                                connecting to the room, not just the browser).
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from aris.crud.file import create_file


INTERNAL_SECRET = "test-internal-secret-AAA"
INTERNAL_URL = "/internal/collab/start"


@pytest.fixture(autouse=True)
def _patch_secret(monkeypatch):
    """Pin INTERNAL_SHARED_SECRET to a known value for these tests."""
    monkeypatch.setattr("aris.routes.internal.settings.INTERNAL_SHARED_SECRET", INTERNAL_SECRET)


async def _create_file(db: AsyncSession, owner_id: int) -> int:
    file = await create_file(source="# Test internal", owner_id=owner_id, db=db)
    return file.id


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_internal_collab_start_rejects_missing_header(client: AsyncClient):
    """No X-Internal-Secret header → 401."""
    response = await client.post(INTERNAL_URL, json={"file_id": 1})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_internal_collab_start_rejects_wrong_secret(client: AsyncClient):
    """Wrong secret → 401."""
    response = await client.post(
        INTERNAL_URL,
        json={"file_id": 1},
        headers={"X-Internal-Secret": "definitely-wrong"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_internal_collab_start_accepts_correct_secret(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """Correct secret + valid file_id → 200, manager.start_client invoked."""
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    with patch("aris.routes.internal.get_collaboration_manager") as mock_get:
        mock_manager = mock_get.return_value
        mock_manager.start_client = AsyncMock(return_value=True)

        response = await client.post(
            INTERNAL_URL,
            json={"file_id": file_id},
            headers={"X-Internal-Secret": INTERNAL_SECRET},
        )

    assert response.status_code == status.HTTP_200_OK
    mock_manager.start_client.assert_awaited_once_with(file_id)


@pytest.mark.asyncio
async def test_internal_collab_start_does_not_require_user_auth(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """The endpoint must work without an Authorization Bearer token —
    it's authenticated by the internal secret, not by user JWT."""
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    with patch("aris.routes.internal.get_collaboration_manager") as mock_get:
        mock_manager = mock_get.return_value
        mock_manager.start_client = AsyncMock(return_value=True)

        # No "Authorization" header — only X-Internal-Secret.
        response = await client.post(
            INTERNAL_URL,
            json={"file_id": file_id},
            headers={"X-Internal-Secret": INTERNAL_SECRET},
        )

    assert response.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# File validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_internal_collab_start_404_for_unknown_file(client: AsyncClient):
    with patch("aris.routes.internal.get_collaboration_manager") as mock_get:
        mock_manager = mock_get.return_value
        mock_manager.start_client = AsyncMock(return_value=True)

        response = await client.post(
            INTERNAL_URL,
            json={"file_id": 99999},
            headers={"X-Internal-Secret": INTERNAL_SECRET},
        )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_manager.start_client.assert_not_called()


@pytest.mark.asyncio
async def test_internal_collab_start_returns_500_when_manager_fails(
    client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    """If manager.start_client returns False (e.g. readiness timeout), surface 503."""
    file_id = await _create_file(db_session, authenticated_user["user_id"])

    with patch("aris.routes.internal.get_collaboration_manager") as mock_get:
        mock_manager = mock_get.return_value
        mock_manager.start_client = AsyncMock(return_value=False)

        response = await client.post(
            INTERNAL_URL,
            json={"file_id": file_id},
            headers={"X-Internal-Secret": INTERNAL_SECRET},
        )

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


# ---------------------------------------------------------------------------
# Body validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_internal_collab_start_rejects_missing_body(client: AsyncClient):
    response = await client.post(
        INTERNAL_URL,
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_internal_collab_start_rejects_non_int_file_id(client: AsyncClient):
    response = await client.post(
        INTERNAL_URL,
        json={"file_id": "not-a-number"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
