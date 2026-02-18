"""API routes for file version management.

This module provides endpoints for creating, viewing, previewing, and managing
file versions. Versions are snapshots of file content at specific points in time.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from .. import current_user, get_db
from ..authorization import require_edit, require_manage, require_view
from ..crud.file import get_file
from ..crud.versions import (
    create_version,
    delete_version,
    get_version,
    get_versions_for_file,
    rename_version,
)
from ..deps import UserRead
from ..models.models import FileRole


router = APIRouter(prefix="/files", tags=["versions"], dependencies=[Depends(current_user)])


class VersionCreate(BaseModel):
    """Request model for creating a new version."""

    version_name: Optional[str] = None
    description: Optional[str] = None
    checkpoint_type: str = "manual"


class VersionRename(BaseModel):
    """Request model for renaming a version."""

    version_name: str


class VersionOut(BaseModel):
    """Response model for version data."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    file_id: int
    version_number: int
    version_name: Optional[str]
    title: Optional[str]
    abstract: Optional[str]
    created_by: int
    created_at: datetime
    creator_name: Optional[str] = None
    checkpoint_type: str = "manual"


class VersionPreviewOut(BaseModel):
    """Response model for version preview."""

    version_id: int
    version_name: Optional[str]
    version_number: int
    rsm_content: str
    current_content: str
    title: Optional[str]
    created_at: datetime
    created_by: int


@router.post("/{file_id}/versions/named", response_model=VersionOut)
async def create_named_version(
    file_id: int,
    version_data: VersionCreate,
    user: UserRead = Depends(current_user),
    user_role: FileRole = Depends(require_edit),
    db: AsyncSession = Depends(get_db),
):
    """Create a new named version of a file (Owner/Editor only)."""
    file = await get_file(file_id, db)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    version = await create_version(
        file_id=file_id,
        user_id=user.id,
        version_name=version_data.version_name,
        checkpoint_type=version_data.checkpoint_type,
        db=db,
    )

    return VersionOut(
        id=version.id,
        file_id=version.file_id,
        version_number=version.version_number,
        version_name=version.version_name,
        title=version.title,
        abstract=version.abstract,
        created_by=version.created_by,
        created_at=version.created_at,
        creator_name=user.name,
        checkpoint_type=version.checkpoint_type,
    )


@router.get("/{file_id}/versions", response_model=list[VersionOut])
async def list_versions(
    file_id: int,
    user_role: FileRole = Depends(require_view),
    db: AsyncSession = Depends(get_db),
):
    """List all versions for a file."""
    file = await get_file(file_id, db)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    versions = await get_versions_for_file(file_id, db=db)

    return [
        VersionOut(
            id=v.id,
            file_id=v.file_id,
            version_number=v.version_number,
            version_name=v.version_name,
            title=v.title,
            abstract=v.abstract,
            created_by=v.created_by,
            created_at=v.created_at,
            checkpoint_type=v.checkpoint_type,
        )
        for v in versions
    ]


@router.get("/{file_id}/versions/{version_id}/preview", response_model=VersionPreviewOut)
async def preview_version(
    file_id: int,
    version_id: int,
    user_role: FileRole = Depends(require_view),
    db: AsyncSession = Depends(get_db),
):
    """Preview a version's content."""
    file = await get_file(file_id, db)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    version = await get_version(version_id, db=db)
    if not version or version.file_id != file_id:
        raise HTTPException(status_code=404, detail="Version not found")

    return VersionPreviewOut(
        version_id=version.id,
        version_name=version.version_name,
        version_number=version.version_number,
        rsm_content=version.rsm_content,
        current_content=file.source or "",
        title=version.title,
        created_at=version.created_at,
        created_by=version.created_by,
    )


@router.put("/{file_id}/versions/{version_id}", response_model=VersionOut)
async def update_version(
    file_id: int,
    version_id: int,
    version_data: VersionRename,
    user_role: FileRole = Depends(require_manage),
    db: AsyncSession = Depends(get_db),
):
    """Rename a version (Owner only)."""
    file = await get_file(file_id, db)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    version = await get_version(version_id, db=db)
    if not version or version.file_id != file_id:
        raise HTTPException(status_code=404, detail="Version not found")

    updated_version = await rename_version(version_id, version_data.version_name, db=db)

    return VersionOut(
        id=updated_version.id,
        file_id=updated_version.file_id,
        version_number=updated_version.version_number,
        version_name=updated_version.version_name,
        title=updated_version.title,
        abstract=updated_version.abstract,
        created_by=updated_version.created_by,
        created_at=updated_version.created_at,
        checkpoint_type=updated_version.checkpoint_type,
    )


@router.delete("/{file_id}/versions/{version_id}")
async def delete_version_endpoint(
    file_id: int,
    version_id: int,
    user_role: FileRole = Depends(require_manage),
    db: AsyncSession = Depends(get_db),
):
    """Delete a version (Owner only, soft delete)."""
    file = await get_file(file_id, db)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    version = await get_version(version_id, db=db)
    if not version or version.file_id != file_id:
        raise HTTPException(status_code=404, detail="Version not found")

    await delete_version(version_id, db=db)

    return {"message": "Version deleted successfully"}
