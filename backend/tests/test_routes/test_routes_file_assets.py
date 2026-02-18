"""Tests for file-scoped asset routes: /files/{file_id}/assets."""

import base64

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def test_file(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Asset Test Doc",
            "abstract": "",
            "owner_id": authenticated_user["user_id"],
            "source": "test content",
        },
    )
    return response.json()


@pytest.fixture
def valid_base64_image():
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    )
    return base64.b64encode(png_bytes).decode()


@pytest.fixture
def valid_base64_text():
    return base64.b64encode(b"Hello, World!").decode()


# ---------------------------------------------------------------------------
# GET /files/{file_id}/assets
# ---------------------------------------------------------------------------


async def test_list_assets_requires_auth(client: AsyncClient, test_file):
    response = await client.get(f"/files/{test_file['id']}/assets")
    assert response.status_code == 401


async def test_list_assets_empty(client: AsyncClient, authenticated_user, test_file):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.get(f"/files/{test_file['id']}/assets", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_list_assets_returns_all_file_assets(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={"filename": "a.png", "mime_type": "image/png", "content": valid_base64_image},
    )
    response = await client.get(f"/files/{test_file['id']}/assets", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["filename"] == "a.png"


async def test_collaborator_can_list_assets(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Collaborator must see assets uploaded by the file owner (the core bug fix)."""
    owner_headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Upload an asset as the owner
    await client.post(
        f"/files/{test_file['id']}/assets",
        headers=owner_headers,
        json={"filename": "shared.png", "mime_type": "image/png", "content": valid_base64_image},
    )

    # Create a collaborator and give them view permission
    collab_response = await client.post(
        "/register",
        json={
            "email": "collab@example.com",
            "name": "Collaborator",
            "initials": "C1",
            "password": "pass1234",
        },
    )
    collab_token = collab_response.json()["access_token"]
    collab_id = collab_response.json()["user"]["id"]
    collab_headers = {"Authorization": f"Bearer {collab_token}"}

    await client.post(
        f"/files/{test_file['id']}/permissions",
        headers=owner_headers,
        json={"user_id": collab_id, "role": "COMMENTER"},
    )

    response = await client.get(f"/files/{test_file['id']}/assets", headers=collab_headers)
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 1
    assert assets[0]["filename"] == "shared.png"


# ---------------------------------------------------------------------------
# POST /files/{file_id}/assets
# ---------------------------------------------------------------------------


async def test_upload_asset_requires_auth(client: AsyncClient, test_file, valid_base64_image):
    response = await client.post(
        f"/files/{test_file['id']}/assets",
        json={"filename": "a.png", "mime_type": "image/png", "content": valid_base64_image},
    )
    assert response.status_code == 401


async def test_upload_asset_success(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={"filename": "img.png", "mime_type": "image/png", "content": valid_base64_image},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "img.png"
    assert data["file_id"] == test_file["id"]
    assert data["deleted_at"] is None


async def test_upload_asset_invalid_base64(client: AsyncClient, authenticated_user, test_file):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={
            "filename": "bad.png",
            "mime_type": "image/png",
            "content": "not-valid-base64!@#",
            "content_encoding": "base64",
        },
    )
    assert response.status_code == 422


async def test_upload_asset_viewer_forbidden(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    """Viewers must not be able to upload assets (requires edit permission)."""
    owner_headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    viewer_response = await client.post(
        "/register",
        json={"email": "viewer@example.com", "name": "Viewer", "initials": "V1", "password": "pass1234"},
    )
    viewer_token = viewer_response.json()["access_token"]
    viewer_id = viewer_response.json()["user"]["id"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    await client.post(
        f"/files/{test_file['id']}/permissions",
        headers=owner_headers,
        json={"user_id": viewer_id, "role": "COMMENTER"},
    )

    response = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=viewer_headers,
        json={"filename": "a.png", "mime_type": "image/png", "content": valid_base64_image},
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# PUT /files/{file_id}/assets/{asset_id}
# ---------------------------------------------------------------------------


async def test_update_asset_filename(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    create_resp = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={"filename": "original.png", "mime_type": "image/png", "content": valid_base64_image},
    )
    asset_id = create_resp.json()["id"]

    response = await client.put(
        f"/files/{test_file['id']}/assets/{asset_id}",
        headers=headers,
        json={"filename": "renamed.png"},
    )
    assert response.status_code == 200
    assert response.json()["filename"] == "renamed.png"


async def test_update_asset_not_found(client: AsyncClient, authenticated_user, test_file):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.put(
        f"/files/{test_file['id']}/assets/999999",
        headers=headers,
        json={"filename": "x.png"},
    )
    assert response.status_code == 404


async def test_update_asset_requires_auth(client: AsyncClient, test_file):
    response = await client.put(
        f"/files/{test_file['id']}/assets/1",
        json={"filename": "x.png"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /files/{file_id}/assets/{asset_id}
# ---------------------------------------------------------------------------


async def test_delete_asset_success(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    create_resp = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={"filename": "del.png", "mime_type": "image/png", "content": valid_base64_image},
    )
    asset_id = create_resp.json()["id"]

    response = await client.delete(
        f"/files/{test_file['id']}/assets/{asset_id}", headers=headers
    )
    assert response.status_code == 200

    # Should not appear in the list
    list_resp = await client.get(f"/files/{test_file['id']}/assets", headers=headers)
    assert len(list_resp.json()) == 0


async def test_delete_asset_not_found(client: AsyncClient, authenticated_user, test_file):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.delete(f"/files/{test_file['id']}/assets/999999", headers=headers)
    assert response.status_code == 404


async def test_delete_asset_requires_auth(client: AsyncClient, test_file):
    response = await client.delete(f"/files/{test_file['id']}/assets/1")
    assert response.status_code == 401


async def test_list_excludes_deleted_assets(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    for name in ("keep.png", "delete.png"):
        await client.post(
            f"/files/{test_file['id']}/assets",
            headers=headers,
            json={"filename": name, "mime_type": "image/png", "content": valid_base64_image},
        )

    assets = (await client.get(f"/files/{test_file['id']}/assets", headers=headers)).json()
    to_delete_id = next(a["id"] for a in assets if a["filename"] == "delete.png")
    await client.delete(f"/files/{test_file['id']}/assets/{to_delete_id}", headers=headers)

    remaining = (await client.get(f"/files/{test_file['id']}/assets", headers=headers)).json()
    assert len(remaining) == 1
    assert remaining[0]["filename"] == "keep.png"
