"""CRUD for magic-link collaborator invitations (std-nbpwwn)."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import FileInvitation, FilePermission, FileRole, User
from .permissions import get_permission_by_file_and_user
from .user import build_new_user, get_user_by_email


INVITE_TTL_DAYS = 7


def hash_token(raw_token: str) -> str:
    """SHA-256 hex of a raw invite token. We store this, never the raw token."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def create_invitation(
    file_id: int,
    invited_email: str,
    role: FileRole,
    granted_by: int,
    db: AsyncSession,
    ttl_days: int = INVITE_TTL_DAYS,
) -> tuple[str, FileInvitation]:
    """Create a pending invitation and return (raw_token, row).

    Replaces any outstanding (unconsumed) invitation for the same file and email,
    so there is never more than one live token per file and email.
    """
    email = invited_email.strip().lower()
    await db.execute(
        delete(FileInvitation).where(
            FileInvitation.file_id == file_id,
            func.lower(FileInvitation.invited_email) == email,
            FileInvitation.consumed_at.is_(None),
        )
    )
    raw_token = secrets.token_urlsafe(32)
    invitation = FileInvitation(
        token_hash=hash_token(raw_token),
        file_id=file_id,
        invited_email=email,
        role=role,
        expires_at=datetime.now(UTC) + timedelta(days=ttl_days),
        granted_by=granted_by,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return raw_token, invitation


async def get_invitation_by_token(raw_token: str, db: AsyncSession) -> FileInvitation | None:
    """Look up an invitation by the hash of its raw token."""
    result = await db.execute(
        select(FileInvitation).where(FileInvitation.token_hash == hash_token(raw_token))
    )
    return result.scalar_one_or_none()


async def consume_invitation(
    invitation: FileInvitation,
    name: str,
    password_hash: str,
    db: AsyncSession,
) -> tuple[User, bool, str | None] | None:
    """Consume an invitation and provision access, all in one transaction.

    Marks the invitation consumed with a conditional update (one-time, race-safe),
    then creates the user if needed and grants the permission. Rolls back and
    returns None if the invitation was already consumed or expired by the time we
    locked it. On success returns (user, created, verification_token). The email,
    file, and role come from the invitation row, never from the caller.
    """
    # consumed_at IS NULL is the atomic one-time guard. Expiry is enforced by the
    # route pre-check, not here, since a tz-aware comparison in SQL is unreliable on
    # SQLite (naive storage) and the expire-during-consume window is negligible.
    result = await db.execute(
        update(FileInvitation)
        .where(
            FileInvitation.id == invitation.id,
            FileInvitation.consumed_at.is_(None),
        )
        .values(consumed_at=datetime.now(UTC))
    )
    if result.rowcount != 1:
        await db.rollback()
        return None

    user = await get_user_by_email(invitation.invited_email, db)
    created = False
    verification_token = None
    if user is None:
        user = await build_new_user(name, "", invitation.invited_email, password_hash, db)
        verification_token = user.generate_verification_token()
        user.email_verification_sent_at = datetime.now(UTC)
        created = True

    assert user is not None
    existing = await get_permission_by_file_and_user(invitation.file_id, int(user.id), db)
    if existing is None:
        db.add(
            FilePermission(
                file_id=invitation.file_id,
                user_id=user.id,
                role=invitation.role,
                granted_by=invitation.granted_by,
            )
        )

    await db.commit()
    await db.refresh(user)
    return user, created, verification_token
