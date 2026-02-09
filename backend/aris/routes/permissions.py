"""API routes for file permission management."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from aris.authorization import require_manage
from aris.crud.permissions import (
    create_permission,
    get_file_collaborators,
    get_permission_by_file_and_user,
    revoke_permission,
    update_permission_role,
)
from aris.deps import current_user, get_db
from aris.models.models import FileRole, User


router = APIRouter()


class AddCollaboratorRequest(BaseModel):
    """Request to add a collaborator to a file."""

    user_id: int
    role: FileRole


class UpdateCollaboratorRequest(BaseModel):
    """Request to update a collaborator's role."""

    role: FileRole


@router.get("/{file_id}/permissions")
async def list_collaborators(
    file_id: int,
    user_role: FileRole = Depends(require_manage),
    db: AsyncSession = Depends(get_db),
):
    """List all collaborators for a file.

    Requires OWNER permission.

    Parameters
    ----------
    file_id : int
        File ID to query.
    user_role : FileRole
        Current user's role (injected by require_manage).
    db : AsyncSession
        Database session.

    Returns
    -------
    list[dict]
        List of collaborators with their details and roles.

    """
    return await get_file_collaborators(file_id, db)


@router.post("/{file_id}/permissions", status_code=201)
async def add_collaborator(
    file_id: int,
    request: AddCollaboratorRequest,
    user_role: FileRole = Depends(require_manage),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a collaborator to a file.

    Requires OWNER permission.

    Parameters
    ----------
    file_id : int
        File ID to add collaborator to.
    request : AddCollaboratorRequest
        Collaborator details (user_id and role).
    user_role : FileRole
        Current user's role (injected by require_manage).
    user : User
        Current authenticated user.
    db : AsyncSession
        Database session.

    Returns
    -------
    dict
        Created permission details.

    Raises
    ------
    HTTPException
        400 if user already has permission for this file.

    """
    if request.role == FileRole.OWNER:
        raise HTTPException(
            status_code=400,
            detail="Cannot add OWNER permission. Files can only have one owner."
        )

    existing = await get_permission_by_file_and_user(file_id, request.user_id, db)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="User already has permission for this file"
        )

    permission = await create_permission(
        file_id=file_id,
        user_id=request.user_id,
        role=request.role,
        granted_by=user.id,
        db=db,
    )

    return {
        "id": permission.id,
        "file_id": permission.file_id,
        "user_id": permission.user_id,
        "role": permission.role.value,
        "granted_at": permission.granted_at.isoformat() if permission.granted_at else None,
    }


@router.put("/{file_id}/permissions/{permission_id}")
async def update_collaborator(
    file_id: int,
    permission_id: int,
    request: UpdateCollaboratorRequest,
    user_role: FileRole = Depends(require_manage),
    db: AsyncSession = Depends(get_db),
):
    """Update a collaborator's role.

    Requires OWNER permission.

    Parameters
    ----------
    file_id : int
        File ID (for permission check).
    permission_id : int
        Permission ID to update.
    request : UpdateCollaboratorRequest
        New role.
    user_role : FileRole
        Current user's role (injected by require_manage).
    db : AsyncSession
        Database session.

    Returns
    -------
    dict
        Updated permission details.

    Raises
    ------
    HTTPException
        404 if permission not found.

    """
    permission = await update_permission_role(permission_id, request.role, db)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    return {
        "id": permission.id,
        "file_id": permission.file_id,
        "user_id": permission.user_id,
        "role": permission.role.value,
        "granted_at": permission.granted_at.isoformat() if permission.granted_at else None,
    }


@router.delete("/{file_id}/permissions/{permission_id}", status_code=204)
async def remove_collaborator(
    file_id: int,
    permission_id: int,
    user_role: FileRole = Depends(require_manage),
    db: AsyncSession = Depends(get_db),
):
    """Remove a collaborator from a file.

    Requires OWNER permission.

    Parameters
    ----------
    file_id : int
        File ID (for permission check).
    permission_id : int
        Permission ID to revoke.
    user_role : FileRole
        Current user's role (injected by require_manage).
    db : AsyncSession
        Database session.

    Returns
    -------
    None
        No content returned (204 status).

    Raises
    ------
    HTTPException
        404 if permission not found.

    """
    permission = await revoke_permission(permission_id, db)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
