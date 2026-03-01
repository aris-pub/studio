"""Feedback submission route."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import UserRead, current_user, get_db
from ..logging_config import get_logger
from ..models import Feedback
from ..services.email import get_email_service


logger = get_logger(__name__)

router = APIRouter()


class FeedbackCreate(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Feedback message cannot be empty")
        if len(v) > 5000:
            raise ValueError("Feedback message must be 5000 characters or fewer")
        return v


@router.post("/feedback", status_code=201)
async def submit_feedback(
    body: FeedbackCreate,
    user: UserRead = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    feedback = Feedback(user_id=user.id, message=body.message)
    db.add(feedback)
    await db.commit()

    # Send admin notification (best-effort, don't fail the request)
    try:
        email_service = get_email_service()
        if email_service:
            await email_service.send_feedback_notification(
                user_email=user.email,
                user_name=user.name,
                message=body.message,
            )
    except Exception as e:
        logger.error(f"Failed to send feedback notification email: {e}")

    return {"status": "ok"}
