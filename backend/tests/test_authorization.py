"""Unit tests for authorization and permission checking."""

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from aris.authorization import (
    PermissionLevel,
    get_user_role_for_file,
    has_permission,
    list_user_accessible_files,
    require_edit,
    require_manage,
    require_view,
)
from aris.crud.file import create_file
from aris.crud.permissions import (
    create_permission,
    get_permission_by_file_and_user,
    revoke_permission,
)
from aris.models.models import FileRole, User


@pytest.mark.asyncio
async def test_get_user_role_for_file_owner(db_session: AsyncSession, test_user: User):
    """Test getting role returns OWNER for file creator."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    role = await get_user_role_for_file(file.id, test_user.id, db_session)
    assert role == FileRole.OWNER


@pytest.mark.asyncio
async def test_get_user_role_for_file_editor(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test getting role returns EDITOR for editor permission."""
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

    role = await get_user_role_for_file(file.id, test_user2.id, db_session)
    assert role == FileRole.EDITOR


@pytest.mark.asyncio
async def test_get_user_role_for_file_commenter(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test getting role returns COMMENTER for commenter permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    role = await get_user_role_for_file(file.id, test_user2.id, db_session)
    assert role == FileRole.COMMENTER


@pytest.mark.asyncio
async def test_get_user_role_for_file_no_permission(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test getting role returns None for user without permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    role = await get_user_role_for_file(file.id, test_user2.id, db_session)
    assert role is None


@pytest.mark.asyncio
async def test_has_permission_owner_can_view(db_session: AsyncSession, test_user: User):
    """Test OWNER has VIEW permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    has_perm = await has_permission(file.id, test_user.id, PermissionLevel.VIEW, db_session)
    assert has_perm is True


@pytest.mark.asyncio
async def test_has_permission_owner_can_edit(db_session: AsyncSession, test_user: User):
    """Test OWNER has EDIT permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    has_perm = await has_permission(file.id, test_user.id, PermissionLevel.EDIT, db_session)
    assert has_perm is True


@pytest.mark.asyncio
async def test_has_permission_owner_can_manage(db_session: AsyncSession, test_user: User):
    """Test OWNER has MANAGE permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    has_perm = await has_permission(file.id, test_user.id, PermissionLevel.MANAGE, db_session)
    assert has_perm is True


@pytest.mark.asyncio
async def test_has_permission_editor_can_view(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test EDITOR has VIEW permission."""
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

    has_perm = await has_permission(file.id, test_user2.id, PermissionLevel.VIEW, db_session)
    assert has_perm is True


@pytest.mark.asyncio
async def test_has_permission_editor_can_edit(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test EDITOR has EDIT permission."""
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

    has_perm = await has_permission(file.id, test_user2.id, PermissionLevel.EDIT, db_session)
    assert has_perm is True


@pytest.mark.asyncio
async def test_has_permission_editor_cannot_manage(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test EDITOR does not have MANAGE permission."""
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

    has_perm = await has_permission(file.id, test_user2.id, PermissionLevel.MANAGE, db_session)
    assert has_perm is False


@pytest.mark.asyncio
async def test_has_permission_commenter_can_view(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test COMMENTER has VIEW permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    has_perm = await has_permission(file.id, test_user2.id, PermissionLevel.VIEW, db_session)
    assert has_perm is True


@pytest.mark.asyncio
async def test_has_permission_commenter_can_comment(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test COMMENTER has COMMENT permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    has_perm = await has_permission(file.id, test_user2.id, PermissionLevel.COMMENT, db_session)
    assert has_perm is True


@pytest.mark.asyncio
async def test_has_permission_commenter_cannot_edit(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test COMMENTER does not have EDIT permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    has_perm = await has_permission(file.id, test_user2.id, PermissionLevel.EDIT, db_session)
    assert has_perm is False


@pytest.mark.asyncio
async def test_has_permission_commenter_cannot_manage(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test COMMENTER does not have MANAGE permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    has_perm = await has_permission(file.id, test_user2.id, PermissionLevel.MANAGE, db_session)
    assert has_perm is False


@pytest.mark.asyncio
async def test_require_view_allows_owner(db_session: AsyncSession, test_user: User):
    """Test require_view allows OWNER."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    role = await require_view(file.id, test_user, db_session)
    assert role == FileRole.OWNER


@pytest.mark.asyncio
async def test_require_view_allows_editor(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test require_view allows EDITOR."""
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

    role = await require_view(file.id, test_user2, db_session)
    assert role == FileRole.EDITOR


@pytest.mark.asyncio
async def test_require_view_allows_commenter(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test require_view allows COMMENTER."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    role = await require_view(file.id, test_user2, db_session)
    assert role == FileRole.COMMENTER


@pytest.mark.asyncio
async def test_require_view_denies_no_permission(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test require_view denies user without permission."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    with pytest.raises(HTTPException) as exc_info:
        await require_view(file.id, test_user2, db_session)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_require_view_returns_404_for_nonexistent_file(db_session: AsyncSession, test_user: User):
    """Test require_view returns 404 for nonexistent file."""
    with pytest.raises(HTTPException) as exc_info:
        await require_view(99999, test_user, db_session)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_require_edit_allows_owner(db_session: AsyncSession, test_user: User):
    """Test require_edit allows OWNER."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    role = await require_edit(file.id, test_user, db_session)
    assert role == FileRole.OWNER


@pytest.mark.asyncio
async def test_require_edit_allows_editor(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test require_edit allows EDITOR."""
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

    role = await require_edit(file.id, test_user2, db_session)
    assert role == FileRole.EDITOR


@pytest.mark.asyncio
async def test_require_edit_denies_commenter(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test require_edit denies COMMENTER."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    with pytest.raises(HTTPException) as exc_info:
        await require_edit(file.id, test_user2, db_session)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_require_manage_allows_owner(db_session: AsyncSession, test_user: User):
    """Test require_manage allows OWNER."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    role = await require_manage(file.id, test_user, db_session)
    assert role == FileRole.OWNER


@pytest.mark.asyncio
async def test_require_manage_denies_editor(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test require_manage denies EDITOR."""
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

    with pytest.raises(HTTPException) as exc_info:
        await require_manage(file.id, test_user2, db_session)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_require_manage_denies_commenter(db_session: AsyncSession, test_user: User, test_user2: User):
    """Test require_manage denies COMMENTER."""
    file = await create_file(
        source="# Test", owner_id=test_user.id, db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=test_user2.id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )

    with pytest.raises(HTTPException) as exc_info:
        await require_manage(file.id, test_user2, db_session)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_list_matches_the_permission_gate(db_session: AsyncSession, test_user: User):
    """A file the list returns must also pass has_permission for the same user."""
    file = await create_file(source="# Test", owner_id=test_user.id, db=db_session)

    listed = await list_user_accessible_files(test_user.id, db_session)
    assert [f.id for f, _ in listed] == [file.id]
    assert await has_permission(file.id, test_user.id, PermissionLevel.VIEW, db_session)


@pytest.mark.asyncio
async def test_list_excludes_a_file_whose_owner_id_has_no_permission_row(
    db_session: AsyncSession, test_user: User, test_user2: User
):
    """owner_id alone must not put a file in someone's list.

    This is the shape a duplicated file used to have: owner_id pointing at the
    original owner, the OWNER permission row belonging to whoever made the copy.
    The list payload carries the manuscript source, so listing it leaked content
    the user could not otherwise open.
    """
    copy = await create_file(source="# Private edits", owner_id=test_user.id, db=db_session)
    # Hand the only OWNER permission to user2 while owner_id still names user1.
    owner_row = await get_permission_by_file_and_user(copy.id, test_user.id, db_session)
    await revoke_permission(owner_row.id, copy.id, db_session)
    await create_permission(
        file_id=copy.id,
        user_id=test_user2.id,
        role=FileRole.OWNER,
        granted_by=test_user2.id,
        db=db_session,
    )

    listed_for_owner_id = await list_user_accessible_files(test_user.id, db_session)
    assert copy.id not in [f.id for f, _ in listed_for_owner_id]
    assert not await has_permission(copy.id, test_user.id, PermissionLevel.VIEW, db_session)

    listed_for_real_owner = await list_user_accessible_files(test_user2.id, db_session)
    assert copy.id in [f.id for f, _ in listed_for_real_owner]


@pytest.mark.asyncio
async def test_second_active_grant_is_rejected_so_the_list_never_duplicates(
    db_session: AsyncSession, test_user: User, test_user2: User
):
    """A user cannot hold two active permissions on one file (partial unique index,
    std-3gj40g), so list_user_accessible_files can never show that file twice for
    them. The strongest-role dedup in list_user_accessible_files stays as defense in
    depth, but the duplicate state it guarded against can no longer be created."""
    file = await create_file(source="# Test", owner_id=test_user.id, db=db_session)
    # Capture ids before the failed commit + rollback, which expires the ORM
    # instances (reading test_user2.id afterward would trigger a sync lazy-load).
    file_id = file.id
    user2_id = test_user2.id
    await create_permission(
        file_id=file_id,
        user_id=user2_id,
        role=FileRole.COMMENTER,
        granted_by=test_user.id,
        db=db_session,
    )
    with pytest.raises(IntegrityError):
        await create_permission(
            file_id=file_id,
            user_id=user2_id,
            role=FileRole.EDITOR,
            granted_by=test_user.id,
            db=db_session,
        )
    await db_session.rollback()

    listed = await list_user_accessible_files(user2_id, db_session)
    entries = [(f.id, role) for f, role in listed if f.id == file_id]
    assert entries == [(file_id, FileRole.COMMENTER)]
