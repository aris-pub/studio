"""API tests for the invite-by-email endpoint (std-nbpwwn, PR B)."""

from unittest.mock import patch

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aris.crud.file import create_file
from aris.crud.permissions import create_permission
from aris.models import FileInvitation, FileRole


@pytest.fixture
def mock_resend(monkeypatch):
    """Enable the email service with a fake key and capture Resend.Emails.send."""
    monkeypatch.setattr("aris.services.email.settings.ENV", "PROD")
    monkeypatch.setattr("aris.services.email.settings.RESEND_API_KEY", "test_key")
    monkeypatch.setattr("aris.config.settings.FRONTEND_URL", "https://studio.test")
    with patch("resend.Emails.send") as mock_send:
        mock_send.return_value = {"id": "fake-email-id"}
        yield mock_send


async def _file(db, owner_id):
    return await create_file(source="# Test", owner_id=owner_id, db=db)


async def _invitations(db, file_id):
    result = await db.execute(
        select(FileInvitation).where(FileInvitation.file_id == file_id)
    )
    return result.scalars().all()


@pytest.mark.asyncio
async def test_invite_existing_user_grants_directly(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    resp = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": second_authenticated_user["email"], "role": "EDITOR"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    body = resp.json()
    assert body["status"] == "granted"
    assert body["user_id"] == second_authenticated_user["user_id"]
    assert body["role"] == "EDITOR"
    # No invitation row for an existing user.
    assert await _invitations(db_session, file.id) == []


@pytest.mark.asyncio
async def test_invite_new_email_creates_invitation(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    resp = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": "newcoauthor@example.com", "role": "EDITOR"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    body = resp.json()
    assert body["status"] == "invited"
    assert body["invited_email"] == "newcoauthor@example.com"
    assert body["role"] == "EDITOR"
    assert "/invitations/" in body["invite_url"]

    rows = await _invitations(db_session, file.id)
    assert len(rows) == 1
    assert rows[0].invited_email == "newcoauthor@example.com"
    assert rows[0].role == FileRole.EDITOR
    assert rows[0].consumed_at is None
    assert len(rows[0].token_hash) == 64


@pytest.mark.asyncio
async def test_invite_normalizes_email(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    resp = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": "MixedCase@Example.COM", "role": "COMMENTER"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    rows = await _invitations(db_session, file.id)
    assert rows[0].invited_email == "mixedcase@example.com"


@pytest.mark.asyncio
async def test_invite_replaces_existing_invitation(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    first = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": "coauthor@example.com", "role": "EDITOR"},
    )
    second = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": "coauthor@example.com", "role": "COMMENTER"},
    )
    assert first.status_code == second.status_code == status.HTTP_201_CREATED
    # Exactly one live invitation, and the token changed.
    rows = await _invitations(db_session, file.id)
    assert len(rows) == 1
    assert rows[0].role == FileRole.COMMENTER
    assert first.json()["invite_url"] != second.json()["invite_url"]


@pytest.mark.asyncio
async def test_invite_existing_collaborator_rejected(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )
    resp = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": second_authenticated_user["email"], "role": "EDITOR"},
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_invite_owner_role_rejected(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    resp = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": "someone@example.com", "role": "OWNER"},
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_invite_bad_email_rejected(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    resp = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": "not-an-email", "role": "EDITOR"},
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_invite_as_editor_forbidden(
    authenticated_client: AsyncClient,
    authenticated_client2: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )
    resp = await authenticated_client2.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": "someone@example.com", "role": "EDITOR"},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_invite_new_email_sends_magic_link(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
    mock_resend,
):
    file = await _file(db_session, authenticated_user["user_id"])
    resp = await authenticated_client.post(
        f"/files/{file.id}/permissions/invite",
        json={"email": "newcoauthor@example.com", "role": "EDITOR"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    invite_url = resp.json()["invite_url"]

    mock_resend.assert_called_once()
    params = mock_resend.call_args[0][0]
    assert params["to"] == ["newcoauthor@example.com"]
    assert invite_url in params["html"]
    assert invite_url in params["text"]


@pytest.mark.asyncio
async def test_invite_new_email_no_send_when_email_disabled(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    db_session: AsyncSession,
):
    file = await _file(db_session, authenticated_user["user_id"])
    with patch("resend.Emails.send") as send:
        resp = await authenticated_client.post(
            f"/files/{file.id}/permissions/invite",
            json={"email": "nobody@example.com", "role": "EDITOR"},
        )
    assert resp.status_code == status.HTTP_201_CREATED
    send.assert_not_called()
    assert len(await _invitations(db_session, file.id)) == 1
