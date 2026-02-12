"""CRUD operations for file versions.

This module provides operations for creating, reading, updating, and deleting
file versions. Versions are snapshots of a file's RSM content at specific points
in time, allowing users to track changes and restore previous states.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from aris.models import File, FileVersion


async def create_version(
    file_id: int,
    user_id: int,
    version_name: Optional[str] = None,
    db: AsyncSession = None,
) -> FileVersion:
    """Create a new version snapshot of a file.

    Captures the current state of the file (RSM content, title, abstract) and
    assigns a sequential version number.

    Parameters
    ----------
    file_id : int
        ID of the file to version.
    user_id : int
        ID of the user creating this version.
    version_name : str, optional
        User-provided name for this version (e.g., "Before review").
    db : AsyncSession
        Database session.

    Returns
    -------
    FileVersion
        The newly created version.

    """
    # Get the file
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one()

    # Get the next version number
    result = await db.execute(
        select(func.max(FileVersion.version_number))
        .where(FileVersion.file_id == file_id)
        .where(FileVersion.deleted_at.is_(None))
    )
    max_version: int | None = result.scalar()
    next_version_number = (max_version or 0) + 1

    # Create version snapshot
    version = FileVersion(
        file_id=file_id,
        version_number=next_version_number,
        version_name=version_name,
        rsm_content=file.source,
        title=file.title,
        abstract=file.abstract,
        created_by=user_id,
    )

    db.add(version)
    await db.commit()
    await db.refresh(version)

    return version


async def get_versions_for_file(
    file_id: int,
    db: AsyncSession = None,
    include_deleted: bool = False,
) -> list[FileVersion]:
    """Get all versions for a file, ordered by creation date (newest first).

    Parameters
    ----------
    file_id : int
        ID of the file.
    db : AsyncSession
        Database session.
    include_deleted : bool, optional
        Whether to include soft-deleted versions. Default is False.

    Returns
    -------
    list[FileVersion]
        List of versions, newest first.

    """
    query = select(FileVersion).where(FileVersion.file_id == file_id)

    if not include_deleted:
        query = query.where(FileVersion.deleted_at.is_(None))

    # Order by ID descending (newer versions have higher IDs)
    query = query.order_by(desc(FileVersion.id))

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_version(
    version_id: int,
    db: AsyncSession = None,
    include_deleted: bool = False,
) -> Optional[FileVersion]:
    """Get a specific version by ID.

    Parameters
    ----------
    version_id : int
        ID of the version.
    db : AsyncSession
        Database session.
    include_deleted : bool, optional
        Whether to include soft-deleted versions. Default is False.

    Returns
    -------
    FileVersion or None
        The version if found, None otherwise.

    """
    query = select(FileVersion).where(FileVersion.id == version_id)

    if not include_deleted:
        query = query.where(FileVersion.deleted_at.is_(None))

    result = await db.execute(query)
    return result.scalar_one_or_none()


async def rename_version(
    version_id: int,
    new_name: str,
    db: AsyncSession = None,
) -> FileVersion:
    """Rename a version.

    Parameters
    ----------
    version_id : int
        ID of the version to rename.
    new_name : str
        New name for the version.
    db : AsyncSession
        Database session.

    Returns
    -------
    FileVersion
        The updated version.

    """
    version = await get_version(version_id, db=db)
    if version is None:
        raise ValueError(f"Version {version_id} not found")

    version.version_name = new_name

    await db.commit()
    await db.refresh(version)

    return version


async def delete_version(
    version_id: int,
    db: AsyncSession = None,
) -> None:
    """Soft delete a version.

    Parameters
    ----------
    version_id : int
        ID of the version to delete.
    db : AsyncSession
        Database session.

    """
    version = await get_version(version_id, db=db, include_deleted=False)
    if version:
        version.deleted_at = datetime.now(timezone.utc)
        await db.commit()


async def soft_delete_versions_for_file(
    file_id: int,
    db: AsyncSession,
) -> None:
    """Soft delete all versions for a file.

    Called when a file is soft-deleted to ensure its versions are also marked as deleted.

    Parameters
    ----------
    file_id : int
        ID of the file whose versions should be deleted.
    db : AsyncSession
        Database session.

    """
    deleted_at = datetime.now(timezone.utc)

    # Get all non-deleted versions for this file
    versions = await get_versions_for_file(file_id, db=db, include_deleted=False)

    # Soft delete each version
    for version in versions:
        version.deleted_at = deleted_at

    # Commit is handled by the caller (delete_file_in_database)
