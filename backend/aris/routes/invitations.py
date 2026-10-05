"""Public routes for accepting magic-link collaborator invitations (std-nbpwwn)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from .. import get_db, jwt
from ..config import settings
from ..crud.invitations import consume_invitation, get_invitation_by_token
from ..logging_config import get_logger
from ..models import File, FileInvitation, User
from ..rate_limiting import REGISTER_RATE_LIMIT, limiter
from ..security import hash_password
from ..services.email import get_email_service


logger = get_logger(__name__)

router = APIRouter(prefix="/invitations", tags=["invitations"])


class ConsumeInvitationRequest(BaseModel):
    """Signup fields for accepting an invitation.

    The email, file, and role come from the invitation itself, never from here.
    """

    name: str
    password: str = Field(min_length=8)


def _check_usable(invitation: FileInvitation | None) -> FileInvitation:
    """Return the invitation, or raise 404/409/410. Reveals nothing extra."""
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.consumed_at is not None:
        raise HTTPException(status_code=409, detail="This invitation has already been used")
    # SQLite stores DateTime(timezone=True) as naive, so coerce before comparing.
    expires = invitation.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires <= datetime.now(UTC):
        raise HTTPException(status_code=410, detail="This invitation has expired")
    return invitation


@router.get("/{token}")
async def get_invitation(token: str, db: AsyncSession = Depends(get_db)):
    """Minimal metadata for the signup page. Returns 404 for an unknown token."""
    invitation = _check_usable(await get_invitation_by_token(token, db))
    file = await db.get(File, invitation.file_id)
    granter = await db.get(User, invitation.granted_by) if invitation.granted_by else None
    return {
        "invited_email": invitation.invited_email,
        "file_title": (file.title if file else None) or "Untitled",
        "inviter_name": granter.name if granter else None,
        "role": invitation.role.value,
    }


@router.post("/{token}/consume", status_code=201)
@limiter.limit(REGISTER_RATE_LIMIT)
async def consume(
    token: str,
    body: ConsumeInvitationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Accept an invitation: create the account if needed, grant access, sign in."""
    invitation = _check_usable(await get_invitation_by_token(token, db))
    file_id = invitation.file_id

    result = await consume_invitation(
        invitation, body.name, hash_password(body.password), db
    )
    if result is None:
        raise HTTPException(status_code=409, detail="This invitation has already been used")
    user, created, verification_token = result

    if created and verification_token:
        email_service = get_email_service()
        if email_service:
            try:
                await email_service.send_verification_email(
                    to_email=user.email,
                    name=user.name,
                    token=verification_token,
                    frontend_url=settings.FRONTEND_URL,
                )
            except Exception:
                logger.warning(
                    "Verification email failed after invite consume", exc_info=True
                )

    return {
        "token_type": "bearer",
        "access_token": jwt.create_access_token(data={"sub": str(user.id)}),
        "refresh_token": jwt.create_refresh_token(data={"sub": str(user.id)}),
        "file_id": file_id,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "initials": user.initials,
            "email_verified": user.email_verified,
        },
    }
