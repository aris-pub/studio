"""Schema tests for the FileInvitation model (std-nbpwwn, PR A)."""

import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from aris.models import FileInvitation, FileRole


def test_declares_expected_indexes():
    declared = {index.name for index in FileInvitation.__table__.indexes}
    expected = {
        "uq_file_invitations_token_hash",
        "ix_file_invitations_file_id",
        "ix_file_invitations_invited_email",
    }
    assert expected <= declared


def test_token_hash_index_is_unique():
    idx = next(
        i
        for i in FileInvitation.__table__.indexes
        if i.name == "uq_file_invitations_token_hash"
    )
    assert idx.unique is True


async def _make(db_session, file, token="raw-token", email="invitee@example.com", role=FileRole.EDITOR):
    inv = FileInvitation(
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        file_id=file.id,
        invited_email=email,
        role=role,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()
    await db_session.refresh(inv)
    return inv


async def test_persists_with_defaults(db_session, test_file):
    inv = await _make(db_session, test_file)
    assert inv.id is not None
    assert inv.invited_email == "invitee@example.com"
    assert inv.role == FileRole.EDITOR
    assert inv.consumed_at is None
    assert inv.created_at is not None
    assert len(inv.token_hash) == 64


async def test_duplicate_token_hash_rejected(db_session, test_file):
    await _make(db_session, test_file, token="same")
    with pytest.raises(IntegrityError):
        await _make(db_session, test_file, token="same", email="other@example.com")
    await db_session.rollback()
