import base64
import binascii
from datetime import UTC, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging_config import get_logger
from ..models import FileAsset


logger = get_logger(__name__)


class FileAssetCreate(BaseModel):
    filename: str
    mime_type: str
    content: str
    content_encoding: str = "plain"  # "plain" or "base64"
    file_id: int

    @field_validator("content_encoding")
    @classmethod
    def validate_content_encoding(cls, v):
        if v not in ("plain", "base64"):
            raise ValueError("content_encoding must be 'plain' or 'base64'")
        return v

    @model_validator(mode="after")
    def validate_base64_content(self):
        if self.content_encoding == "base64":
            try:
                base64.b64decode(self.content)
            except (TypeError, binascii.Error):
                raise ValueError("Invalid base64-encoded string")
        return self


class FileAssetUpdate(BaseModel):
    filename: str | None = None
    content: str | None = None
    deleted_at: datetime | None = None

    @classmethod
    def validate_optional_content(cls, v):
        if v is None:
            return v
        try:
            base64.b64decode(v)
        except (TypeError, binascii.Error):
            logger.warning("Content is not base64 decodable")
        return v

    @field_validator("content")
    @classmethod
    def validate_content_strict(cls, v):
        if v is None:
            return v
        try:
            base64.b64decode(v)
        except (TypeError, binascii.Error):
            raise ValueError("Invalid base64-encoded string")
        return v


class FileAssetOut(BaseModel):
    id: int
    filename: str
    mime_type: str
    content: str
    content_encoding: str
    uploaded_at: datetime
    deleted_at: datetime | None
    file_id: int


class FileAssetDB:
    @staticmethod
    async def get_user_asset(asset_id: int, user_id: int, db: AsyncSession) -> Optional[FileAsset]:
        """Get a user's asset by ID, excluding soft-deleted assets"""
        asset = await db.get(FileAsset, asset_id)
        if not asset or asset.owner_id != user_id or asset.deleted_at is not None:
            return None
        return asset

    @staticmethod
    async def create_asset(payload: FileAssetCreate, user_id: int, db: AsyncSession) -> FileAsset:
        """Create a new file asset"""
        new_asset = FileAsset(
            filename=payload.filename,
            mime_type=payload.mime_type,
            content=payload.content,
            content_encoding=payload.content_encoding,
            file_id=payload.file_id,
            owner_id=user_id,
        )
        db.add(new_asset)
        await db.commit()
        await db.refresh(new_asset)
        return new_asset

    @staticmethod
    async def list_user_assets(user_id: int, db: AsyncSession) -> List[FileAsset]:
        """List all non-deleted assets for a user"""
        result: Result[Any] = await db.execute(
            select(FileAsset).where(FileAsset.owner_id == user_id, FileAsset.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_asset(
        asset: FileAsset, payload: FileAssetUpdate, db: AsyncSession
    ) -> FileAsset:
        """Update an existing asset"""
        if payload.filename is not None:
            asset.filename = payload.filename
        if payload.content is not None:
            asset.content = payload.content
        if payload.deleted_at is not None:
            asset.deleted_at = payload.deleted_at
        await db.commit()
        await db.refresh(asset)
        return asset

    @staticmethod
    async def soft_delete_asset(asset: FileAsset, db: AsyncSession) -> None:
        """Soft delete an asset by setting deleted_at timestamp"""
        asset.deleted_at = datetime.now(UTC)
        await db.commit()
