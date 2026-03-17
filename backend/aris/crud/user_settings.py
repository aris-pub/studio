"""CRUD operations for user settings."""

from datetime import UTC, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import UserSettings


class UserSettingsBase(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    auto_save_interval: int = 30
    focus_mode_auto_hide: bool = True
    sidebar_auto_collapse: bool = False
    drawer_default_annotations: bool = False
    drawer_default_margins: bool = False
    drawer_default_settings: bool = False
    sound_notifications: bool = True
    auto_compile_delay: int = 1000
    mobile_menu_behavior: str = "standard"
    allow_anonymous_feedback: bool = False
    email_digest_frequency: str = "weekly"
    notification_preference: str = "in-app"
    notification_mentions: bool = True
    notification_comments: bool = True
    notification_shares: bool = True
    notification_system: bool = True


class UserSettingsResponse(UserSettingsBase):
    user_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )


class UserSettingsDB:
    @staticmethod
    async def get_user_settings(user_id: int, db: AsyncSession) -> Optional[UserSettings]:
        """Get user settings for a user"""
        query = select(UserSettings).where(
            UserSettings.user_id == user_id,
            UserSettings.deleted_at.is_(None),
        )
        result: Result[Any] = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def upsert_user_settings(
        settings_data: UserSettingsBase, user_id: int, db: AsyncSession
    ) -> UserSettings:
        """Create or update user settings"""
        settings = await UserSettingsDB.get_user_settings(user_id, db)

        if settings:
            # Update existing
            for field, value in settings_data.model_dump().items():
                setattr(settings, field, value)
            settings.updated_at = datetime.now(UTC)
        else:
            # Create new
            settings = UserSettings(
                user_id=user_id,
                **settings_data.model_dump(),
            )
            db.add(settings)

        await db.commit()
        await db.refresh(settings)
        return settings