"""Unit tests for permission CRUD operations."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from aris.crud.file import create_file
from aris.crud.permissions import (
    create_permission,
    get_file_collaborators,
    revoke_permission,
    update_permission_role,
)
from aris.models.models import FileRole, User


@pytest.mark.asyncio
async def test_create_permission_editor(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test creating EDITOR permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    permission = await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.EDITOR,
        granted_by=test_user.id,
        db=db_session,
    )

    assert permission.file_id == file.id
    assert permission.user_id == test_user2.id
    assert permission.role == FileRole.EDITOR
    assert permission.granted_by == test_user.id
    assert permission.deleted_at is None


@pytest.mark.asyncio
async def test_create_permission_commenter(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test creating COMMENTER permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    permission = await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    assert permission.role == FileRole.COMMENTER


@pytest.mark.asyncio
async def test_get_file_collaborators_returns_all_permissions(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test getting all collaborators for a file."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.EDITOR,
        granted_by=test_user.id,
        db=db_session,
    )

    collaborators = await get_file_collaborators(file.id, db_session)

    assert len(collaborators) == 2  # Owner + Editor

    # Check owner permission
    owner_perm = next(c for c in collaborators if c["user_id"] == test_user.id)
    assert owner_perm["role"] == "OWNER"

    # Check editor permission
    editor_perm = next(c for c in collaborators if c["user_id"] == test_user2.id)
    assert editor_perm["role"] == "EDITOR"


@pytest.mark.asyncio
async def test_get_file_collaborators_includes_user_info(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test collaborators list includes user email and name."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.EDITOR,
        granted_by=test_user.id,
        db=db_session,
    )

    collaborators = await get_file_collaborators(file.id, db_session)

    owner_perm = next(c for c in collaborators if c["user_id"] == test_user.id)
    assert "user_email" in owner_perm
    assert "user_name" in owner_perm


@pytest.mark.asyncio
async def test_get_file_collaborators_excludes_deleted(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test getting collaborators excludes soft-deleted permissions."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    permission = await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.EDITOR,
        granted_by=test_user.id,
        db=db_session,
    )

    # Revoke permission
    await revoke_permission(permission.id, db_session)

    collaborators = await get_file_collaborators(file.id, db_session)

    # Should only have owner, not the revoked editor
    assert len(collaborators) == 1
    assert collaborators[0]["user_id"] == test_user.id


@pytest.mark.asyncio
async def test_update_permission_role_editor_to_commenter(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test updating permission role from EDITOR to COMMENTER."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    permission = await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.EDITOR,
        granted_by=test_user.id,
        db=db_session,
    )

    updated = await update_permission_role(permission.id, FileRole.COMMENTER, db_session)

    assert updated.id == permission.id
    assert updated.role == FileRole.COMMENTER


@pytest.mark.asyncio
async def test_update_permission_role_commenter_to_editor(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test updating permission role from COMMENTER to EDITOR."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    permission = await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    updated = await update_permission_role(permission.id, FileRole.EDITOR, db_session)

    assert updated.role == FileRole.EDITOR


@pytest.mark.asyncio
async def test_update_permission_role_returns_none_for_nonexistent(db_session: AsyncSession):
    """Test updating nonexistent permission returns None."""
    updated = await update_permission_role(99999, FileRole.EDITOR, db_session)
    assert updated is None


@pytest.mark.asyncio
async def test_revoke_permission_soft_deletes(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test revoking permission soft-deletes it."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    permission = await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.EDITOR,
        granted_by=test_user.id,
        db=db_session,
    )

    revoked = await revoke_permission(permission.id, db_session)

    assert revoked is not None
    assert revoked.id == permission.id
    assert revoked.deleted_at is not None


@pytest.mark.asyncio
async def test_revoke_permission_returns_none_for_nonexistent(db_session: AsyncSession):
    """Test revoking nonexistent permission returns None."""
    result = await revoke_permission(99999, db_session)
    assert result is None
