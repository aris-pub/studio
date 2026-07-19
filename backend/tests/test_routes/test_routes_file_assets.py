"""Tests for file-scoped asset routes: /files/{file_id}/assets."""

import base64

import pytest
from httpx import AsyncClient

from aris.config import settings


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


# ---------------------------------------------------------------------------
# Asset size limit (std-n1m251): enforced on DECODED bytes, rejected with 413
# ---------------------------------------------------------------------------


def _base64_decoding_to(n_bytes: int) -> str:
    """A base64 string that decodes to exactly ``n_bytes`` bytes."""
    return base64.b64encode(b"\0" * n_bytes).decode()


async def test_upload_asset_over_size_limit_returns_413(
    client: AsyncClient, authenticated_user, test_file, monkeypatch
):
    """Base64 content whose decoded size is over the limit is refused with 413."""
    monkeypatch.setattr(settings, "MAX_ASSET_BYTES", 1024 * 1024)
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={
            "filename": "big.png",
            "mime_type": "image/png",
            "content": _base64_decoding_to(1024 * 1024 + 1),
            "content_encoding": "base64",
        },
    )
    assert response.status_code == 413
    assert "1 MB" in response.json()["detail"]
    assert "limit" in response.json()["detail"].lower()


async def test_upload_asset_at_size_limit_succeeds(
    client: AsyncClient, authenticated_user, test_file, monkeypatch
):
    """Content decoding to exactly the limit is accepted.

    The base64 string here is ~1.33x the byte limit, so its raw length is over the
    limit while its decoded length is not. Accepting it proves the check is on the
    DECODED size, not the raw wire length.
    """
    monkeypatch.setattr(settings, "MAX_ASSET_BYTES", 1024 * 1024)
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={
            "filename": "atlimit.png",
            "mime_type": "image/png",
            "content": _base64_decoding_to(1024 * 1024),
            "content_encoding": "base64",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["filename"] == "atlimit.png"


async def test_upload_asset_just_over_bound_rejected(
    client: AsyncClient, authenticated_user, test_file, monkeypatch
):
    """A base64 string just one decoded byte over the bound is rejected."""
    monkeypatch.setattr(settings, "MAX_ASSET_BYTES", 1024 * 1024)
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    under = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={
            "filename": "under.bin",
            "mime_type": "application/octet-stream",
            "content": _base64_decoding_to(1024 * 1024 - 3),
            "content_encoding": "base64",
        },
    )
    assert under.status_code == 200, under.text

    over = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={
            "filename": "over.bin",
            "mime_type": "application/octet-stream",
            "content": _base64_decoding_to(1024 * 1024 + 1),
            "content_encoding": "base64",
        },
    )
    assert over.status_code == 413


async def test_update_asset_over_size_limit_returns_413(
    client: AsyncClient, authenticated_user, test_file, valid_base64_image, monkeypatch
):
    """Updating an asset with over-limit base64 content is refused with 413."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    create_resp = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={
            "filename": "u.png",
            "mime_type": "image/png",
            "content": valid_base64_image,
            "content_encoding": "base64",
        },
    )
    asset_id = create_resp.json()["id"]

    monkeypatch.setattr(settings, "MAX_ASSET_BYTES", 1024 * 1024)
    response = await client.put(
        f"/files/{test_file['id']}/assets/{asset_id}",
        headers=headers,
        json={"content": _base64_decoding_to(1024 * 1024 + 1)},
    )
    assert response.status_code == 413
    assert "limit" in response.json()["detail"].lower()


async def test_upload_asset_over_default_limit_returns_413(
    client: AsyncClient, authenticated_user, test_file
):
    """With the shipped 25 MB default, an over-limit upload returns the 413 message."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/files/{test_file['id']}/assets",
        headers=headers,
        json={
            "filename": "huge.png",
            "mime_type": "image/png",
            "content": _base64_decoding_to(25 * 1024 * 1024 + 1),
            "content_encoding": "base64",
        },
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "Asset exceeds 25 MB limit"
