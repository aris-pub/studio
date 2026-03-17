"""Routes for user settings."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from .. import current_user, get_db
from ..crud.user_settings import (
    UserSettingsBase,
    UserSettingsDB,
    UserSettingsResponse,
)
from ..models import User


router = APIRouter(prefix="/user-settings", tags=["user", "settings"])


@router.post("", response_model=UserSettingsResponse, response_model_by_alias=True)
async def upsert_user_settings(
    settings_data: UserSettingsBase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(current_user),
):
    """Create or update user settings for the current user."""
    settings = await UserSettingsDB.upsert_user_settings(settings_data, current_user.id, db)
    return settings


@router.get("", response_model=UserSettingsResponse, response_model_by_alias=True)
async def get_user_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(current_user),
):
    """Get user settings for the current user."""
    settings = await UserSettingsDB.get_user_settings(current_user.id, db)

    if not settings:
        # Return default values without persisting
        return UserSettingsResponse(
            user_id=current_user.id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    return settings