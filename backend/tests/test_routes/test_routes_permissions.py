"""API endpoint tests for permission management routes."""

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from aris.crud.file import create_file
from aris.crud.permissions import create_permission
from aris.models.models import FileRole


@pytest.mark.asyncio
async def test_list_collaborators_as_owner(
    authenticated_client: AsyncClient, authenticated_user: dict, db_session: AsyncSession
):
    """Test owner can list collaborators."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    response = await authenticated_client.get(f"/files/{file.id}/permissions")

    assert response.status_code == status.HTTP_200_OK
    collaborators = response.json()
    assert len(collaborators) == 1  # Just the owner
    assert collaborators[0]["user_id"] == authenticated_user["user_id"]
    assert collaborators[0]["role"] == "OWNER"


@pytest.mark.asyncio
async def test_list_collaborators_as_editor_forbidden(
    authenticated_client: AsyncClient,
    authenticated_client2: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test editor cannot list collaborators."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )

    # Try as editor (using authenticated_client2)
    response = await authenticated_client2.get(f"/files/{file.id}/permissions")

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_list_collaborators_as_commenter_forbidden(
    authenticated_client: AsyncClient,
    authenticated_client2: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test commenter cannot list collaborators."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.COMMENTER,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )

    # Try as commenter (using authenticated_client2)
    response = await authenticated_client2.get(f"/files/{file.id}/permissions")

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_add_collaborator_as_owner(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test owner can add collaborator."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    response = await authenticated_client.post(
        f"/files/{file.id}/permissions",
        json={
            "user_id": second_authenticated_user["user_id"],
            "role": "EDITOR",
        },
    )

    assert response.status_code == status.HTTP_201_CREATED
    permission = response.json()
    assert permission["user_id"] == second_authenticated_user["user_id"]
    assert permission["role"] == "EDITOR"
    assert permission["file_id"] == file.id


@pytest.mark.asyncio
async def test_add_collaborator_as_editor_forbidden(
    authenticated_client: AsyncClient,
    authenticated_client2: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test editor cannot add collaborators."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )

    # Try as editor to add someone
    response = await authenticated_client2.post(
        f"/files/{file.id}/permissions",
        json={
            "user_id": authenticated_user["user_id"],
            "role": "COMMENTER",
        },
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_add_collaborator_invalid_role(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test adding collaborator with invalid role fails."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    response = await authenticated_client.post(
        f"/files/{file.id}/permissions",
        json={
            "user_id": second_authenticated_user["user_id"],
            "role": "INVALID_ROLE",
        },
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_update_collaborator_role_as_owner(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test owner can update collaborator role."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    permission = await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.COMMENTER,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )

    response = await authenticated_client.put(
        f"/files/{file.id}/permissions/{permission.id}",
        json={"role": "EDITOR"},
    )

    assert response.status_code == status.HTTP_200_OK
    updated = response.json()
    assert updated["id"] == permission.id
    assert updated["role"] == "EDITOR"


@pytest.mark.asyncio
async def test_update_collaborator_role_as_editor_forbidden(
    authenticated_client: AsyncClient,
    authenticated_client2: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test editor cannot update collaborator roles."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    editor_permission = await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )

    # Try as editor to update own permission
    response = await authenticated_client2.put(
        f"/files/{file.id}/permissions/{editor_permission.id}",
        json={"role": "COMMENTER"},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_revoke_collaborator_as_owner(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test owner can revoke collaborator access."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    permission = await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )

    response = await authenticated_client.delete(f"/files/{file.id}/permissions/{permission.id}")

    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Verify permission is revoked
    list_response = await authenticated_client.get(f"/files/{file.id}/permissions")
    collaborators = list_response.json()
    assert len(collaborators) == 1  # Only owner remains
    assert collaborators[0]["user_id"] == authenticated_user["user_id"]


@pytest.mark.asyncio
async def test_revoke_collaborator_as_editor_forbidden(
    authenticated_client: AsyncClient,
    authenticated_client2: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test editor cannot revoke collaborators."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    editor_permission = await create_permission(
        file_id=file.id,
        user_id=second_authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=authenticated_user["user_id"],
        db=db_session,
    )

    # Try as editor to revoke own permission
    response = await authenticated_client2.delete(
        f"/files/{file.id}/permissions/{editor_permission.id}"
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_list_collaborators_for_nonexistent_file(authenticated_client: AsyncClient):
    """Test listing collaborators for nonexistent file returns 404."""
    response = await authenticated_client.get("/files/99999/permissions")
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_add_collaborator_to_nonexistent_file(
    authenticated_client: AsyncClient, second_authenticated_user: dict
):
    """Test adding collaborator to nonexistent file returns 404."""
    response = await authenticated_client.post(
        "/files/99999/permissions",
        json={
            "user_id": second_authenticated_user["user_id"],
            "role": "EDITOR",
        },
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_cannot_add_owner_permission(
    authenticated_client: AsyncClient,
    authenticated_user: dict,
    second_authenticated_user: dict,
    db_session: AsyncSession,
):
    """Test cannot add OWNER permission (only one owner allowed)."""
    file = await create_file(
        source="# Test", owner_id=authenticated_user["user_id"], db=db_session
    )

    response = await authenticated_client.post(
        f"/files/{file.id}/permissions",
        json={
            "user_id": second_authenticated_user["user_id"],
            "role": "OWNER",
        },
    )

    # Should either be 422 (validation error) or 400 (business logic error)
    assert response.status_code in [status.HTTP_422_UNPROCESSABLE_ENTITY, status.HTTP_400_BAD_REQUEST]
