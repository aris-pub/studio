"""CRUD operations for file permissions."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from aris.models.models import FilePermission, FileRole, User


async def create_permission(
    file_id: int,
    user_id: int,
    role: FileRole,
    granted_by: int,
    db: AsyncSession,
) -> FilePermission:
    """Create a new file permission.

    Parameters
    ----------
    file_id : int
        File ID to grant permission for.
    user_id : int
        User ID to grant permission to.
    role : FileRole
        Role to grant (OWNER, EDITOR, COMMENTER).
    granted_by : int
        User ID who granted the permission.
    db : AsyncSession
        Database session.

    Returns
    -------
    FilePermission
        The created permission record.

    """
    permission = FilePermission(
        file_id=file_id,
        user_id=user_id,
        role=role,
        granted_by=granted_by,
    )
    db.add(permission)
    await db.commit()
    await db.refresh(permission)
    return permission


async def update_permission_role(
    permission_id: int, new_role: FileRole, db: AsyncSession
) -> Optional[FilePermission]:
    """Update the role of an existing permission.

    Parameters
    ----------
    permission_id : int
        Permission ID to update.
    new_role : FileRole
        New role to assign.
    db : AsyncSession
        Database session.

    Returns
    -------
    Optional[FilePermission]
        Updated permission record, or None if not found.

    """
    stmt = select(FilePermission).where(
        and_(
            FilePermission.id == permission_id,
            FilePermission.deleted_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    permission = result.scalar_one_or_none()

    if permission:
        permission.role = new_role
        await db.commit()
        await db.refresh(permission)

    return permission


async def revoke_permission(
    permission_id: int, db: AsyncSession
) -> Optional[FilePermission]:
    """Revoke a permission (soft delete).

    Parameters
    ----------
    permission_id : int
        Permission ID to revoke.
    db : AsyncSession
        Database session.

    Returns
    -------
    Optional[FilePermission]
        Revoked permission record, or None if not found.

    """
    stmt = select(FilePermission).where(
        and_(
            FilePermission.id == permission_id,
            FilePermission.deleted_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    permission = result.scalar_one_or_none()

    if permission:
        permission.deleted_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(permission)

    return permission


async def get_file_collaborators(
    file_id: int, db: AsyncSession
) -> list[dict]:
    """Get all collaborators for a file with their roles.

    Parameters
    ----------
    file_id : int
        File ID to query.
    db : AsyncSession
        Database session.

    Returns
    -------
    list[dict]
        List of collaborator information with user details and roles.

    """
    stmt = (
        select(FilePermission, User)
        .join(User, FilePermission.user_id == User.id)
        .where(
            and_(
                FilePermission.file_id == file_id,
                FilePermission.deleted_at.is_(None),
            )
        )
        .order_by(FilePermission.granted_at)
    )
    result = await db.execute(stmt)
    rows = result.all()

    collaborators = []
    for permission, user in rows:
        collaborators.append({
            "permission_id": permission.id,
            "user_id": user.id,
            "user_name": user.name,
            "user_email": user.email,
            "role": permission.role.value,
            "granted_at": permission.granted_at.isoformat() if permission.granted_at else None,
        })

    return collaborators


async def get_permission_by_file_and_user(
    file_id: int, user_id: int, db: AsyncSession
) -> Optional[FilePermission]:
    """Get a permission record for a specific file and user.

    Parameters
    ----------
    file_id : int
        File ID to query.
    user_id : int
        User ID to query.
    db : AsyncSession
        Database session.

    Returns
    -------
    Optional[FilePermission]
        Permission record if found, None otherwise.

    """
    stmt = select(FilePermission).where(
        and_(
            FilePermission.file_id == file_id,
            FilePermission.user_id == user_id,
            FilePermission.deleted_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
