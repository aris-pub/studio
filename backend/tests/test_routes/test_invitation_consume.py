"""API tests for the invitation GET and consume endpoints (std-nbpwwn, PR C)."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import func, select

from aris.crud.file import create_file
from aris.crud.invitations import create_invitation
from aris.models import FileInvitation, FilePermission, FileRole, User


@pytest.fixture
def mock_resend(monkeypatch):
    monkeypatch.setattr("aris.services.email.settings.ENV", "PROD")
    monkeypatch.setattr("aris.services.email.settings.RESEND_API_KEY", "test_key")
    monkeypatch.setattr("aris.config.settings.FRONTEND_URL", "https://studio.test")
    with patch("resend.Emails.send") as mock_send:
        mock_send.return_value = {"id": "x"}
        yield mock_send


async def _invite(db, owner_id, email="newinvitee@example.com", role=FileRole.EDITOR):
    file = await create_file(source="# Test", owner_id=owner_id, db=db)
    raw, inv = await create_invitation(file.id, email, role, owner_id, db)
    return file, raw, inv


async def _invitation(db, inv_id):
    return (
        await db.execute(select(FileInvitation).where(FileInvitation.id == inv_id))
    ).scalar_one()


async def _user_count(db, email):
    return await db.scalar(
        select(func.count()).select_from(User).where(func.lower(User.email) == email)
    )


# --- GET /invitations/{token} ---

@pytest.mark.asyncio
async def test_get_invitation_returns_minimal_metadata(client: AsyncClient, authenticated_user, db_session):
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"])
    resp = await client.get(f"/invitations/{raw}")
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body["invited_email"] == "newinvitee@example.com"
    assert body["role"] == "EDITOR"
    assert "file_title" in body
    assert "token_hash" not in body and "source" not in body


@pytest.mark.asyncio
async def test_get_invitation_unknown_returns_404(client: AsyncClient, db_session):
    resp = await client.get("/invitations/not-a-real-token")
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_get_invitation_expired_returns_410(client: AsyncClient, authenticated_user, db_session):
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"])
    inv.expires_at = datetime.now(UTC) - timedelta(days=1)
    await db_session.commit()
    resp = await client.get(f"/invitations/{raw}")
    assert resp.status_code == status.HTTP_410_GONE


@pytest.mark.asyncio
async def test_get_invitation_consumed_returns_409(client: AsyncClient, authenticated_user, db_session):
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"])
    inv.consumed_at = datetime.now(UTC)
    await db_session.commit()
    resp = await client.get(f"/invitations/{raw}")
    assert resp.status_code == status.HTTP_409_CONFLICT


# --- POST /invitations/{token}/consume ---

@pytest.mark.asyncio
async def test_consume_creates_account_grants_and_signs_in(client: AsyncClient, authenticated_user, db_session):
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"])
    resp = await client.post(
        f"/invitations/{raw}/consume",
        json={"name": "New Author", "password": "password123"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    body = resp.json()
    assert "access_token" in body and "refresh_token" in body
    assert body["file_id"] == file.id
    assert body["user"]["email"] == "newinvitee@example.com"
    assert body["user"]["email_verified"] is False

    assert (await _invitation(db_session, inv.id)).consumed_at is not None
    perm = (
        await db_session.execute(
            select(FilePermission).where(
                FilePermission.file_id == file.id,
                FilePermission.user_id == body["user"]["id"],
            )
        )
    ).scalar_one()
    assert perm.role == FileRole.EDITOR


@pytest.mark.asyncio
async def test_consume_carries_the_invited_role(client: AsyncClient, authenticated_user, db_session):
    file, raw, inv = await _invite(
        db_session, authenticated_user["user_id"], email="viewer@example.com", role=FileRole.COMMENTER
    )
    resp = await client.post(
        f"/invitations/{raw}/consume", json={"name": "V", "password": "password123"}
    )
    assert resp.status_code == status.HTTP_201_CREATED
    perm = (
        await db_session.execute(
            select(FilePermission).where(FilePermission.user_id == resp.json()["user"]["id"])
        )
    ).scalar_one()
    assert perm.role == FileRole.COMMENTER


@pytest.mark.asyncio
async def test_consume_expired_returns_410(client: AsyncClient, authenticated_user, db_session):
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"])
    inv.expires_at = datetime.now(UTC) - timedelta(days=1)
    await db_session.commit()
    resp = await client.post(
        f"/invitations/{raw}/consume", json={"name": "X", "password": "password123"}
    )
    assert resp.status_code == status.HTTP_410_GONE
    assert await _user_count(db_session, "newinvitee@example.com") == 0


@pytest.mark.asyncio
async def test_consume_replay_returns_409(client: AsyncClient, authenticated_user, db_session):
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"])
    first = await client.post(
        f"/invitations/{raw}/consume", json={"name": "A", "password": "password123"}
    )
    second = await client.post(
        f"/invitations/{raw}/consume", json={"name": "B", "password": "password123"}
    )
    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_409_CONFLICT
    assert await _user_count(db_session, "newinvitee@example.com") == 1


@pytest.mark.asyncio
async def test_consume_existing_account_grants_without_new_user(
    client: AsyncClient, authenticated_user, second_authenticated_user, db_session
):
    email = second_authenticated_user["email"]
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"], email=email)
    before = await _user_count(db_session, email.lower())
    resp = await client.post(
        f"/invitations/{raw}/consume", json={"name": "Whatever", "password": "password123"}
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["user"]["id"] == second_authenticated_user["user_id"]
    assert await _user_count(db_session, email.lower()) == before  # no duplicate user


@pytest.mark.asyncio
async def test_consume_sends_verification_email(
    client: AsyncClient, authenticated_user, db_session, mock_resend
):
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"])
    resp = await client.post(
        f"/invitations/{raw}/consume", json={"name": "New", "password": "password123"}
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert mock_resend.called
    assert mock_resend.call_args[0][0]["to"] == ["newinvitee@example.com"]


@pytest.mark.asyncio
async def test_consume_rolls_back_fully_on_failure(
    client: AsyncClient, authenticated_user, db_session
):
    """If granting the permission fails, no user is left behind and the token is not burned."""
    file, raw, inv = await _invite(db_session, authenticated_user["user_id"])
    inv_id = inv.id  # capture before rollback expires the object
    with patch(
        "aris.crud.invitations.get_permission_by_file_and_user",
        side_effect=RuntimeError("boom"),
    ):
        # The test ASGI transport re-raises an unhandled 500 rather than returning it.
        with pytest.raises(RuntimeError):
            await client.post(
                f"/invitations/{raw}/consume",
                json={"name": "New", "password": "password123"},
            )
    await db_session.rollback()
    assert await _user_count(db_session, "newinvitee@example.com") == 0
    consumed = await db_session.scalar(
        select(FileInvitation.consumed_at).where(FileInvitation.id == inv_id)
    )
    assert consumed is None
