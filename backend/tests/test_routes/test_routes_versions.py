"""Test version API routes.

Tests for /files/{file_id}/versions endpoints including:
- Creating named versions
- Listing versions
- Previewing version content
- Renaming versions
- Deleting versions
- Permission checks
"""

from httpx import AsyncClient

from aris.crud.file import create_file
from aris.crud.permissions import create_permission
from aris.crud.versions import create_version
from aris.models.models import FileRole


async def test_create_version_success(authenticated_client: AsyncClient, authenticated_user, db_session):
    """Test creating a new version successfully."""
    # Create a file
    file = await create_file("# Test Content", owner_id=authenticated_user["user_id"], title="Test", db=db_session)

    # Create version via API
    response = await authenticated_client.post(
        f"/files/{file.id}/versions/named",
        json={"version_name": "First Draft", "description": "Initial version"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["version_number"] == 1
    assert data["version_name"] == "First Draft"
    assert data["file_id"] == file.id
    assert data["created_by"] == authenticated_user["user_id"]
    assert "created_at" in data
    assert "id" in data


async def test_create_version_without_name(authenticated_client: AsyncClient, authenticated_user, db_session):
    """Test creating a version without a name (optional)."""
    file = await create_file("# Content", owner_id=authenticated_user["user_id"], db=db_session)

    response = await authenticated_client.post(
        f"/files/{file.id}/versions/named",
        json={},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["version_name"] is None


async def test_create_version_sequential_numbers(
    authenticated_client: AsyncClient, authenticated_user, db_session
):
    """Test that version numbers increment sequentially."""
    file = await create_file("# Content", owner_id=authenticated_user["user_id"], db=db_session)

    # Create three versions
    r1 = await authenticated_client.post(
        f"/files/{file.id}/versions/named", json={"version_name": "V1"}
    )
    r2 = await authenticated_client.post(
        f"/files/{file.id}/versions/named", json={"version_name": "V2"}
    )
    r3 = await authenticated_client.post(
        f"/files/{file.id}/versions/named", json={"version_name": "V3"}
    )

    assert r1.json()["version_number"] == 1
    assert r2.json()["version_number"] == 2
    assert r3.json()["version_number"] == 3


async def test_create_version_nonexistent_file(authenticated_client: AsyncClient):
    """Test creating version for non-existent file returns 404."""
    response = await authenticated_client.post(
        "/files/99999/versions/named",
        json={"version_name": "Test"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "File not found"


async def test_create_version_unauthorized(
    authenticated_client: AsyncClient, test_user2, db_session
):
    """Test creating version without permission returns 403."""
    # Create file owned by another user (test_user2)
    file = await create_file("# Content", owner_id=test_user2.id, db=db_session)

    # Try to create version as authenticated_user (no permission)
    response = await authenticated_client.post(
        f"/files/{file.id}/versions/named",
        json={"version_name": "Test"},
    )

    assert response.status_code == 403


async def test_list_versions(authenticated_client: AsyncClient, authenticated_user, db_session):
    """Test listing all versions for a file."""
    file = await create_file("# Content", owner_id=authenticated_user["user_id"], db=db_session)

    # Create versions
    await create_version(file.id, authenticated_user["user_id"], "Draft", db=db_session)
    await create_version(file.id, authenticated_user["user_id"], "Review", db=db_session)
    await create_version(file.id, authenticated_user["user_id"], "Final", db=db_session)

    # List via API
    response = await authenticated_client.get(f"/files/{file.id}/versions")

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 3
    # Newest first
    assert data[0]["version_name"] == "Final"
    assert data[1]["version_name"] == "Review"
    assert data[2]["version_name"] == "Draft"


async def test_list_versions_empty(authenticated_client: AsyncClient, authenticated_user, db_session):
    """Test listing versions for file with no versions."""
    file = await create_file("# Content", owner_id=authenticated_user["user_id"], db=db_session)

    response = await authenticated_client.get(f"/files/{file.id}/versions")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_versions_nonexistent_file(authenticated_client: AsyncClient):
    """Test listing versions for non-existent file returns 404."""
    response = await authenticated_client.get("/files/99999/versions")

    assert response.status_code == 404


async def test_preview_version(authenticated_client: AsyncClient, authenticated_user, db_session):
    """Test previewing a version's content."""
    # Create file with content
    file = await create_file("# Original Content", owner_id=authenticated_user["user_id"], db=db_session)

    # Create version
    version = await create_version(file.id, authenticated_user["user_id"], "Snapshot", db=db_session)

    # Update file content
    file.source = "# Updated Content"
    await db_session.commit()

    # Preview version via API
    response = await authenticated_client.get(
        f"/files/{file.id}/versions/{version.id}/preview"
    )

    assert response.status_code == 200
    data = response.json()

    assert data["version_id"] == version.id
    assert data["version_name"] == "Snapshot"
    assert data["rsm_content"] == "# Original Content"  # Version content
    assert data["current_content"] == "# Updated Content"  # Current file content
    assert "created_at" in data


async def test_preview_version_nonexistent(authenticated_client: AsyncClient, authenticated_user, db_session):
    """Test previewing non-existent version returns 404."""
    file = await create_file("# Content", owner_id=authenticated_user["user_id"], db=db_session)

    response = await authenticated_client.get(f"/files/{file.id}/versions/99999/preview")

    assert response.status_code == 404
    assert response.json()["detail"] == "Version not found"


async def test_preview_version_wrong_file(
    authenticated_client: AsyncClient, authenticated_user, db_session
):
    """Test previewing version with mismatched file_id returns 404."""
    file1 = await create_file("# Content 1", owner_id=authenticated_user["user_id"], db=db_session)
    file2 = await create_file("# Content 2", owner_id=authenticated_user["user_id"], db=db_session)

    # Create version for file1
    version = await create_version(file1.id, authenticated_user["user_id"], "V1", db=db_session)

    # Try to preview via file2 URL
    response = await authenticated_client.get(
        f"/files/{file2.id}/versions/{version.id}/preview"
    )

    assert response.status_code == 404


async def test_rename_version(authenticated_client: AsyncClient, authenticated_user, db_session):
    """Test renaming a version."""
    file = await create_file("# Content", owner_id=authenticated_user["user_id"], db=db_session)
    version = await create_version(file.id, authenticated_user["user_id"], "Old Name", db=db_session)

    response = await authenticated_client.put(
        f"/files/{file.id}/versions/{version.id}",
        json={"version_name": "New Name"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["version_name"] == "New Name"
    assert data["id"] == version.id


async def test_rename_version_unauthorized(
    authenticated_client: AsyncClient, authenticated_user, test_user2, db_session
):
    """Test renaming version without OWNER permission returns 403."""
    # File owned by test_user2
    file = await create_file("# Content", owner_id=test_user2.id, db=db_session)
    version = await create_version(file.id, test_user2.id, "V1", db=db_session)

    # Give authenticated_user EDITOR permission (not OWNER)
    await create_permission(
        file_id=file.id,
        user_id=authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=test_user2.id,
        db=db_session,
    )

    # Try to rename (should fail - requires OWNER)
    response = await authenticated_client.put(
        f"/files/{file.id}/versions/{version.id}",
        json={"version_name": "New Name"},
    )

    assert response.status_code == 403


async def test_delete_version(authenticated_client: AsyncClient, authenticated_user, db_session):
    """Test deleting a version (soft delete)."""
    file = await create_file("# Content", owner_id=authenticated_user["user_id"], db=db_session)
    version = await create_version(file.id, authenticated_user["user_id"], "To Delete", db=db_session)

    response = await authenticated_client.delete(
        f"/files/{file.id}/versions/{version.id}"
    )

    assert response.status_code == 200
    assert "deleted successfully" in response.json()["message"]

    # Verify version is soft deleted (not in list)
    list_response = await authenticated_client.get(f"/files/{file.id}/versions")
    assert len(list_response.json()) == 0


async def test_delete_version_unauthorized(
    authenticated_client: AsyncClient, authenticated_user, test_user2, db_session
):
    """Test deleting version without OWNER permission returns 403."""
    file = await create_file("# Content", owner_id=test_user2.id, db=db_session)
    version = await create_version(file.id, test_user2.id, "V1", db=db_session)

    # Give authenticated_user EDITOR permission (not OWNER)
    await create_permission(
        file_id=file.id,
        user_id=authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=test_user2.id,
        db=db_session,
    )

    # Try to delete (should fail - requires OWNER)
    response = await authenticated_client.delete(
        f"/files/{file.id}/versions/{version.id}"
    )

    assert response.status_code == 403


async def test_version_permissions_editor_can_create(
    authenticated_client: AsyncClient, authenticated_user, test_user2, db_session
):
    """Test that EDITOR can create versions."""
    file = await create_file("# Content", owner_id=test_user2.id, db=db_session)

    # Give authenticated_user EDITOR permission
    await create_permission(
        file_id=file.id,
        user_id=authenticated_user["user_id"],
        role=FileRole.EDITOR,
        granted_by=test_user2.id,
        db=db_session,
    )

    # EDITOR should be able to create versions
    response = await authenticated_client.post(
        f"/files/{file.id}/versions/named",
        json={"version_name": "Editor Version"},
    )

    assert response.status_code == 200


async def test_version_permissions_commenter_cannot_create(
    authenticated_client: AsyncClient, authenticated_user, test_user2, db_session
):
    """Test that COMMENTER cannot create versions."""
    file = await create_file("# Content", owner_id=test_user2.id, db=db_session)

    # Give authenticated_user COMMENTER permission
    await create_permission(
        file_id=file.id,
        user_id=authenticated_user["user_id"],
        role=FileRole.COMMENTER,
        granted_by=test_user2.id,
        db=db_session,
    )

    # COMMENTER should NOT be able to create versions
    response = await authenticated_client.post(
        f"/files/{file.id}/versions/named",
        json={"version_name": "Commenter Version"},
    )

    assert response.status_code == 403


async def test_version_permissions_commenter_can_view(
    authenticated_client: AsyncClient, authenticated_user, test_user2, db_session
):
    """Test that COMMENTER can view/list/preview versions."""
    file = await create_file("# Content", owner_id=test_user2.id, db=db_session)
    version = await create_version(file.id, test_user2.id, "V1", db=db_session)

    # Give authenticated_user COMMENTER permission
    await create_permission(
        file_id=file.id,
        user_id=authenticated_user["user_id"],
        role=FileRole.COMMENTER,
        granted_by=test_user2.id,
        db=db_session,
    )

    # COMMENTER should be able to list versions
    list_response = await authenticated_client.get(f"/files/{file.id}/versions")
    assert list_response.status_code == 200

    # COMMENTER should be able to preview versions
    preview_response = await authenticated_client.get(
        f"/files/{file.id}/versions/{version.id}/preview"
    )
    assert preview_response.status_code == 200
