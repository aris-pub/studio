# backend/tests/test_routes/test_assets.py
import base64
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient


@pytest.fixture
async def test_file(client: AsyncClient, authenticated_user):
    """Create a test file to associate assets with."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document for assets",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:test content::",
        },
    )
    return response.json()


@pytest.fixture
def valid_base64_image():
    """Return a valid base64 encoded image (1x1 PNG)."""
    # Minimal 1x1 PNG image
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    )
    return base64.b64encode(png_bytes).decode()


@pytest.fixture
def valid_base64_text():
    """Return a valid base64 encoded text."""
    return base64.b64encode(b"Hello, World!").decode()


async def test_upload_asset_without_auth(client: AsyncClient):
    """Test that asset upload requires authentication."""
    response = await client.post(
        "/assets",
        json={
            "filename": "test.txt",
            "mime_type": "text/plain",
            "content": "SGVsbG8gV29ybGQ=",
            "file_id": 1,
        },
    )
    assert response.status_code == 401


async def test_upload_asset_valid_image(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Test uploading a valid image asset."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.png"
    assert data["mime_type"] == "image/png"
    assert data["content"] == valid_base64_image
    assert data["file_id"] == test_file["id"]
    assert "id" in data
    assert "uploaded_at" in data
    assert data["deleted_at"] is None


async def test_upload_asset_valid_text(
    client: AsyncClient, authenticated_user, test_file, valid_base64_text
):
    """Test uploading a valid text asset."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.txt",
            "mime_type": "text/plain",
            "content": valid_base64_text,
            "file_id": test_file["id"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.txt"
    assert data["mime_type"] == "text/plain"
    assert data["content"] == valid_base64_text


async def test_upload_asset_invalid_base64_image(
    client: AsyncClient, authenticated_user, test_file
):
    """Test uploading an image asset with invalid base64 content."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": "not-valid-base64!@#",
            "content_encoding": "base64",
            "file_id": test_file["id"],
        },
    )
    assert response.status_code == 422
    # The error message might be from base64 decode or your validator
    response_text = str(response.json())
    assert (
        "Invalid base64-encoded string" in response_text
        or "Invalid base64 content for image MIME type" in response_text
        or "Incorrect padding" in response_text
    )


async def test_list_assets_without_auth(client: AsyncClient):
    """Test that listing assets requires authentication."""
    response = await client.get("/assets")
    assert response.status_code == 401


async def test_list_assets_empty(client: AsyncClient, authenticated_user):
    """Test listing assets when user has no assets."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.get("/assets", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_list_assets_with_data(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Test listing assets when user has assets."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create an asset
    await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )

    # List assets
    response = await client.get("/assets", headers=headers)
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 1
    assert assets[0]["filename"] == "test.png"
    assert assets[0]["deleted_at"] is None


async def test_get_asset_without_auth(client: AsyncClient):
    """Test that getting an asset requires authentication."""
    response = await client.get("/assets/1")
    assert response.status_code == 401


async def test_get_asset_not_found(client: AsyncClient, authenticated_user):
    """Test getting a non-existent asset."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.get("/assets/999", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Asset not found"


async def test_get_asset_success(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Test successfully getting an asset."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create an asset
    create_response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset_id = create_response.json()["id"]

    # Get the asset
    response = await client.get(f"/assets/{asset_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == asset_id
    assert data["filename"] == "test.png"
    assert data["content"] == valid_base64_image


async def test_get_asset_different_user(client: AsyncClient, test_file, valid_base64_image):
    """Test that users can't access other users' assets."""
    # Create first user and asset
    user1_response = await client.post(
        "/register",
        json={
            "email": "user1@example.com",
            "name": "User One",
            "initials": "U1",
            "password": "testpass123",
        },
    )
    user1_headers = {"Authorization": f"Bearer {user1_response.json()['access_token']}"}

    create_response = await client.post(
        "/assets",
        headers=user1_headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset_id = create_response.json()["id"]

    # Create second user
    user2_response = await client.post(
        "/register",
        json={
            "email": "user2@example.com",
            "name": "User Two",
            "initials": "U2",
            "password": "testpass123",
        },
    )
    user2_headers = {"Authorization": f"Bearer {user2_response.json()['access_token']}"}

    # Try to access asset as second user
    response = await client.get(f"/assets/{asset_id}", headers=user2_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Asset not found"


async def test_update_asset_without_auth(client: AsyncClient):
    """Test that updating an asset requires authentication."""
    response = await client.put("/assets/1", json={"filename": "new_name.txt"})
    assert response.status_code == 401


async def test_update_asset_not_found(client: AsyncClient, authenticated_user):
    """Test updating a non-existent asset."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.put("/assets/999", headers=headers, json={"filename": "new_name.txt"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Asset not found"


async def test_update_asset_filename(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Test updating an asset's filename."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create an asset
    create_response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "original.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset_id = create_response.json()["id"]

    # Update filename
    response = await client.put(
        f"/assets/{asset_id}", headers=headers, json={"filename": "updated.png"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "updated.png"
    assert data["content"] == valid_base64_image  # Content unchanged


async def test_update_asset_content(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image, valid_base64_text
):
    """Test updating an asset's content."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create an asset
    create_response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset_id = create_response.json()["id"]

    # Update content
    response = await client.put(
        f"/assets/{asset_id}", headers=headers, json={"content": valid_base64_text}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == valid_base64_text
    assert data["filename"] == "test.png"  # Filename unchanged


async def test_update_asset_soft_delete(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Test soft deleting an asset via update."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create an asset
    create_response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset_id = create_response.json()["id"]

    # Soft delete via update
    delete_time = datetime.now(timezone.utc).isoformat()
    response = await client.put(
        f"/assets/{asset_id}", headers=headers, json={"deleted_at": delete_time}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["deleted_at"] is not None


async def test_update_asset_invalid_base64_content(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Test updating an asset with invalid base64 content."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create an asset
    create_response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset_id = create_response.json()["id"]

    # Try to update with invalid base64
    response = await client.put(
        f"/assets/{asset_id}", headers=headers, json={"content": "not-valid-base64!@#"}
    )
    assert response.status_code == 422


async def test_delete_asset_without_auth(client: AsyncClient):
    """Test that deleting an asset requires authentication."""
    response = await client.delete("/assets/1")
    assert response.status_code == 401


async def test_delete_asset_not_found(client: AsyncClient, authenticated_user):
    """Test deleting a non-existent asset."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.delete("/assets/999", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Asset not found"


async def test_delete_asset_success(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Test successfully soft deleting an asset."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create an asset
    create_response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset_id = create_response.json()["id"]

    # Delete the asset
    response = await client.delete(f"/assets/{asset_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["message"] == f"Asset {asset_id} soft deleted"

    # Verify asset is no longer accessible
    get_response = await client.get(f"/assets/{asset_id}", headers=headers)
    assert get_response.status_code == 404

    # Verify asset doesn't appear in list
    list_response = await client.get("/assets", headers=headers)
    assert len(list_response.json()) == 0


async def test_delete_asset_different_user(client: AsyncClient, test_file, valid_base64_image):
    """Test that users can't delete other users' assets."""
    # Create first user and asset
    user1_response = await client.post(
        "/register",
        json={
            "email": "user1@example.com",
            "name": "User One",
            "initials": "U1",
            "password": "testpass123",
        },
    )
    user1_headers = {"Authorization": f"Bearer {user1_response.json()['access_token']}"}

    create_response = await client.post(
        "/assets",
        headers=user1_headers,
        json={
            "filename": "test.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset_id = create_response.json()["id"]

    # Create second user
    user2_response = await client.post(
        "/register",
        json={
            "email": "user2@example.com",
            "name": "User Two",
            "initials": "U2",
            "password": "testpass123",
        },
    )
    user2_headers = {"Authorization": f"Bearer {user2_response.json()['access_token']}"}

    # Try to delete asset as second user
    response = await client.delete(f"/assets/{asset_id}", headers=user2_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Asset not found"


async def test_list_assets_excludes_deleted(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Test that listing assets excludes soft-deleted assets."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create two assets
    await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "asset1.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )

    create_response2 = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "asset2.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "file_id": test_file["id"],
        },
    )
    asset2_id = create_response2.json()["id"]

    # Delete the second asset
    await client.delete(f"/assets/{asset2_id}", headers=headers)

    # List assets should only return the first one
    response = await client.get("/assets", headers=headers)
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 1
    assert assets[0]["filename"] == "asset1.png"
