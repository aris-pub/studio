"""CRUD for magic-link collaborator invitations (std-nbpwwn)."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import FileInvitation, FileRole


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
