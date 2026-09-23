"""Authorization and permission checking for file access.

This module provides core permission checking logic and FastAPI dependency
guards for enforcing file access control based on user roles.

"""

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from aris.deps import current_user, get_db
from aris.models.models import File, FilePermission, FileRole, User


class PermissionLevel:
    """Permission level constants mapping to required roles."""

    VIEW = [FileRole.OWNER, FileRole.EDITOR, FileRole.COMMENTER]
    EDIT = [FileRole.OWNER, FileRole.EDITOR]
    COMMENT = [FileRole.OWNER, FileRole.EDITOR, FileRole.COMMENTER]
    MANAGE = [FileRole.OWNER]


async def list_user_accessible_files(
    user_id: int, db: AsyncSession
) -> list[tuple[File, FileRole]]:
    """List all non-deleted files a user can access, with their effective role.

    Access comes from undeleted FilePermission rows only, which is the same
    source get_user_role_for_file uses. The two used to disagree: this function
    also counted File.owner_id, so a file with a stale owner_id listed for a user
    who then got a 403 opening it, and the list payload includes the manuscript
    source. Migration 453e2da040b7 backfilled an OWNER row for every file, and
    create_file writes one, so owner_id adds nothing here.

    Parameters
    ----------
    user_id : int
        The user whose accessible files to list.
    db : AsyncSession
        Database session.

    Returns
    -------
    list[tuple[File, FileRole]]
        Ordered by File.last_edited_at descending. Each file appears once.

    """
    stmt = (
        select(File, FilePermission.role)
        .join(
            FilePermission,
            and_(
                FilePermission.file_id == File.id,
                FilePermission.user_id == user_id,
                FilePermission.deleted_at.is_(None),
            ),
        )
        .where(File.deleted_at.is_(None))
        .order_by(desc(File.last_edited_at))
    )
    result = await db.execute(stmt)

    # The unique constraint on file_permissions includes deleted_at, so a file
    # can carry more than one undeleted row for the same user (std-3gj40g).
    # Keep the strongest role rather than listing the file twice.
    strength = {FileRole.OWNER: 3, FileRole.EDITOR: 2, FileRole.COMMENTER: 1}
    best: dict[int, tuple[File, FileRole]] = {}
    for file, role in result.all():
        seen = best.get(file.id)
        if seen is None or strength[role] > strength[seen[1]]:
            best[file.id] = (file, role)
    return list(best.values())


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
    role = result.scalars().first()
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


async def require_self(
    user_id: int,
    user: User = Depends(current_user),
) -> User:
    """FastAPI dependency: require the path ``user_id`` to be the caller.

    Endpoints namespaced by ``/users/{user_id}`` get a router-level
    ``Depends(current_user)`` that only proves the caller is logged in, not that
    they are acting on their own account. Without this guard any authenticated
    user can substitute another user's ``user_id`` and read or mutate that
    account (IDOR). Returns the authenticated user so handlers can use it.

    Raises
    ------
    HTTPException
        403 if the authenticated user's id differs from the path ``user_id``.

    """
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return user
