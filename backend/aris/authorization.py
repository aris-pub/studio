"""Authorization and permission checking for file access.

This module provides core permission checking logic and FastAPI dependency
guards for enforcing file access control based on user roles.

"""

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from aris.deps import current_user, get_db
from aris.models.models import File, FilePermission, FileRole, User


class PermissionLevel:
    """Permission level constants mapping to required roles."""

    VIEW = [FileRole.OWNER, FileRole.EDITOR, FileRole.COMMENTER]
    EDIT = [FileRole.OWNER, FileRole.EDITOR]
    COMMENT = [FileRole.OWNER, FileRole.EDITOR, FileRole.COMMENTER]
    MANAGE = [FileRole.OWNER]


async def get_user_role_for_file(
    file_id: int, user_id: int, db: AsyncSession
) -> Optional[FileRole]:
    """Get a user's role for a specific file.

    Parameters
    ----------
    file_id : int
        The file ID to check.
    user_id : int
        The user ID to check.
    db : AsyncSession
        Database session.

    Returns
    -------
    Optional[FileRole]
        The user's role if they have permission, None otherwise.

    """
    stmt = select(FilePermission.role).where(
        and_(
            FilePermission.file_id == file_id,
            FilePermission.user_id == user_id,
            FilePermission.deleted_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    return role


async def has_permission(
    file_id: int, user_id: int, required_roles: list[FileRole], db: AsyncSession
) -> bool:
    """Check if a user has any of the required roles for a file.

    Parameters
    ----------
    file_id : int
        The file ID to check.
    user_id : int
        The user ID to check.
    required_roles : list[FileRole]
        List of acceptable roles.
    db : AsyncSession
        Database session.

    Returns
    -------
    bool
        True if user has permission, False otherwise.

    """
    role = await get_user_role_for_file(file_id, user_id, db)
    return role in required_roles if role else False


async def _check_file_exists(file_id: int, db: AsyncSession) -> None:
    """Check if a file exists, raise 404 if not."""
    stmt = select(File).where(File.id == file_id, File.deleted_at.is_(None))
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="File not found")


async def require_view(
    file_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FileRole:
    """FastAPI dependency to require VIEW permission for a file.

    Parameters
    ----------
    file_id : int
        File ID from path parameter.
    user : User
        Current authenticated user.
    db : AsyncSession
        Database session.

    Returns
    -------
    FileRole
        The user's role if they have permission.

    Raises
    ------
    HTTPException
        404 if file not found, 403 if user lacks permission.

    """
    await _check_file_exists(file_id, db)
    if not await has_permission(file_id, user.id, PermissionLevel.VIEW, db):  # type: ignore[arg-type]
        raise HTTPException(status_code=403, detail="Access denied")
    role = await get_user_role_for_file(file_id, user.id, db)  # type: ignore[arg-type]
    assert role is not None, "Role must exist after permission check passes"
    return role


async def require_edit(
    file_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FileRole:
    """FastAPI dependency to require EDIT permission for a file.

    Parameters
    ----------
    file_id : int
        File ID from path parameter.
    user : User
        Current authenticated user.
    db : AsyncSession
        Database session.

    Returns
    -------
    FileRole
        The user's role if they have permission.

    Raises
    ------
    HTTPException
        404 if file not found, 403 if user lacks permission.

    """
    await _check_file_exists(file_id, db)
    if not await has_permission(file_id, user.id, PermissionLevel.EDIT, db):  # type: ignore[arg-type]
        raise HTTPException(status_code=403, detail="Edit permission required")
    role = await get_user_role_for_file(file_id, user.id, db)  # type: ignore[arg-type]
    assert role is not None, "Role must exist after permission check passes"
    return role


async def require_comment(
    file_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FileRole:
    """FastAPI dependency to require COMMENT permission for a file.

    Parameters
    ----------
    file_id : int
        File ID from path parameter.
    user : User
        Current authenticated user.
    db : AsyncSession
        Database session.

    Returns
    -------
    FileRole
        The user's role if they have permission.

    Raises
    ------
    HTTPException
        404 if file not found, 403 if user lacks permission.

    """
    await _check_file_exists(file_id, db)
    if not await has_permission(file_id, user.id, PermissionLevel.COMMENT, db):  # type: ignore[arg-type]
        raise HTTPException(status_code=403, detail="Comment permission required")
    role = await get_user_role_for_file(file_id, user.id, db)  # type: ignore[arg-type]
    assert role is not None, "Role must exist after permission check passes"
    return role


async def require_manage(
    file_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FileRole:
    """FastAPI dependency to require MANAGE permission for a file.

    Parameters
    ----------
    file_id : int
        File ID from path parameter.
    user : User
        Current authenticated user.
    db : AsyncSession
        Database session.

    Returns
    -------
    FileRole
        The user's role if they have permission.

    Raises
    ------
    HTTPException
        404 if file not found, 403 if user lacks permission.

    """
    await _check_file_exists(file_id, db)
    if not await has_permission(file_id, user.id, PermissionLevel.MANAGE, db):  # type: ignore[arg-type]
        raise HTTPException(status_code=403, detail="Owner permission required")
    role = await get_user_role_for_file(file_id, user.id, db)  # type: ignore[arg-type]
    assert role is not None, "Role must exist after permission check passes"
    return role
