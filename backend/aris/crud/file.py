import asyncio
from datetime import UTC, datetime
from typing import Any, Optional

import rsm
from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import File, FileStatus, file_tags
from .utils import extract_section, extract_title


async def get_files(db: AsyncSession):
    """Retrieve all non-deleted files with their extracted titles.

    Parameters
    ----------
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    list of File
        List of File objects with title attribute populated from RSM content.

    Notes
    -----
    Titles are extracted asynchronously from RSM source content using
    extract_title and assigned to each file object's title attribute.
    """
    result: Result[Any] = await db.execute(select(File).where(File.deleted_at.is_(None)))
    files = result.scalars().all()
    titles = await asyncio.gather(*(extract_title(f) for f in files))
    for file, title in zip(files, titles):
        file.title = title
    return files


async def get_file(file_id: int, db: AsyncSession):
    """Retrieve a single file by ID with extracted title.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to retrieve.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    File or None
        File object with title attribute if found and not deleted, None otherwise.

    Notes
    -----
    The title is extracted from RSM source content and assigned to the
    file object's title attribute before returning.
    """
    result: Result[Any] = await db.execute(select(File).where(File.id == file_id, File.deleted_at.is_(None)))
    file = result.scalars().first()
    if file:
        file.title = await extract_title(file)
    return file


async def get_file_html(file_id: int, db: AsyncSession):
    """Retrieve rendered HTML for a file's RSM content.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to render.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    str or None
        Rendered HTML string with handrails enabled, None if file not found.

    Notes
    -----
    Uses the rsm.render() function with handrails=True for enhanced navigation.
    Only retrieves the source field from the database for efficiency.
    """
    result: Result[Any] = await db.execute(
        select(File.source).where(File.id == file_id, File.deleted_at.is_(None))
    )
    source = result.scalars().first()
    if not source:
        return None

    return rsm.render(source, handrails=True)


async def create_file(
    source: str,
    owner_id: int,
    title: str = "",
    abstract: str = "",
    db: Optional[AsyncSession] = None,
):
    """Create a new file with RSM source content.

    Parameters
    ----------
    source : str
        RSM source content for the file.
    owner_id : int
        User ID of the file owner.
    title : str, optional
        Explicit title for the file (default: empty string).
    abstract : str, optional
        Abstract/summary of the file content (default: empty string).
    db : AsyncSession, optional
        SQLAlchemy async database session.

    Returns
    -------
    File
        The newly created file object with timestamps set.

    Notes
    -----
    Sets status to DRAFT by default and timestamps created_at and last_edited_at
    to current UTC time. Commits the transaction and refreshes the object.
    """
    file = File(
        title=title,
        abstract=abstract,
        owner_id=owner_id,
        source=source,
        status=FileStatus.DRAFT,
    )
    if db is None:
        raise ValueError("Database session is required")
    
    now = datetime.now(UTC)
    file.created_at = now
    file.last_edited_at = now
    db.add(file)
    await db.commit()
    await db.refresh(file)

    # Create OWNER permission for the file creator
    from ..models.models import FileRole
    from .permissions import create_permission
    await create_permission(
        file_id=file.id,  # type: ignore[arg-type]
        user_id=owner_id,
        role=FileRole.OWNER,
        granted_by=owner_id,
        db=db,
    )

    return file


async def update_file(
    file_id: int,
    title: str,
    source: str,
    db: AsyncSession,
):
    """Update an existing file's title and source content.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to update.
    title : str
        New title for the file.
    source : str
        New RSM source content for the file.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    File or None
        The updated file object if found, None if file doesn't exist.

    Notes
    -----
    Updates last_edited_at to current UTC time. Commits the transaction
    and refreshes the object before returning.
    """
    file = await get_file(file_id, db)
    if not file:
        return None

    file.title = title
    file.source = source
    file.last_edited_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(file)
    return file


async def soft_delete_file(file_id: int, db: AsyncSession):
    """Soft delete a file by setting deleted_at timestamp.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to delete.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    dict or None
        Success message dictionary if file found, None if file doesn't exist.

    Notes
    -----
    Sets the deleted_at field to current UTC timestamp instead of actually
    deleting the record. This preserves data integrity and allows for recovery.
    """
    file = await get_file(file_id, db)
    if not file:
        return None
    file.deleted_at = datetime.now(UTC)
    await db.commit()
    return {"message": f"File {file_id} soft deleted"}


async def duplicate_file(file_id: int, db: AsyncSession):
    """Create a duplicate copy of an existing file with all its tags.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to duplicate.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    File
        The newly created duplicate file object.

    Raises
    ------
    ValueError
        If the original file is not found or has been deleted.

    Notes
    -----
    Creates a copy with '(copy)' appended to the title and copies all
    associated tags. Sets last_edited_at to current time for the new file.
    """
    original = await get_file(file_id, db)
    if not original or original.deleted_at:
        raise ValueError("File not found")

    new_file = File(
        title=f"{original.title} (copy)",
        source=original.source,
        owner_id=original.owner_id,
        last_edited_at=datetime.now(UTC),
    )
    db.add(new_file)
    await db.flush()

    tag_ids: Any = (
        await db.execute(file_tags.select().where(file_tags.c.file_id == file_id))
    ).fetchall()
    if tag_ids:
        await db.execute(
            file_tags.insert(),
            [{"file_id": new_file.id, "tag_id": tag.tag_id} for tag in tag_ids],
        )
    await db.commit()

    return new_file


async def get_file_section(
    file_id: int, section_name: str, db: AsyncSession, handrails: bool = True
):
    """Extract and render a specific section from a file's RSM content.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file.
    section_name : str
        Name of the section to extract (e.g., 'minimap', 'abstract').
    db : AsyncSession
        SQLAlchemy async database session.
    handrails : bool, optional
        Whether to enable handrails in the rendered output (default: True).

    Returns
    -------
    str
        Rendered HTML for the section, empty string if section not found.

    Raises
    ------
    ValueError
        If the file is not found.

    Notes
    -----
    Uses extract_section utility to parse RSM content and extract the
    specified section before rendering to HTML.
    """
    result: Result[Any] = await db.execute(select(File).where(File.id == file_id))
    file = result.scalars().first()
    if not file:
        raise ValueError(f"File {file_id} not found")
    html = await extract_section(file, section_name, handrails)
    return html or ""
