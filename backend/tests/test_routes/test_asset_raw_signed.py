"""Signed-URL access tests for the public raw-asset endpoint (std-b4v9).

GET /files/{file_id}/assets/raw/{filename} is fetched by browser <img> tags that
cannot carry a bearer token, so it stays on the public router but requires a valid
short-lived HMAC signature (exp + sig query params). These tests lock in that an
unsigned, tampered, expired, or cross-file request is rejected before any DB lookup
(so the endpoint is not an existence/filename oracle either).
"""

import base64

import pytest
from httpx import AsyncClient

from aris.asset_signing import sign_asset_path


PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


@pytest.fixture
async def file_with_image(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Doc",
            "abstract": "",
            "owner_id": authenticated_user["user_id"],
            "source": "x",
        },
    )
    file_id = resp.json()["id"]
    upload = await client.post(
        f"/files/{file_id}/assets",
        headers=headers,
        json={
            "filename": "chart.png",
            "mime_type": "image/png",
            "content": PNG_B64,
            "content_encoding": "base64",
        },
    )
    assert upload.status_code == 200, upload.text
    return file_id


def _tamper(qs: str) -> str:
    parts = dict(p.split("=", 1) for p in qs.split("&"))
    sig = parts["sig"]
    flipped = sig[:-1] + ("0" if sig[-1] != "0" else "1")
    return f"exp={parts['exp']}&sig={flipped}"


async def test_valid_signature_serves_bytes(client: AsyncClient, file_with_image):
    fid = file_with_image
    qs = sign_asset_path(fid, "chart.png")
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png?{qs}")
    assert resp.status_code == 200
    assert resp.content == base64.b64decode(PNG_B64)


async def test_missing_signature_forbidden(client: AsyncClient, file_with_image):
    fid = file_with_image
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png")
    assert resp.status_code == 403


async def test_tampered_signature_forbidden(client: AsyncClient, file_with_image):
    fid = file_with_image
    qs = _tamper(sign_asset_path(fid, "chart.png"))
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png?{qs}")
    assert resp.status_code == 403


async def test_expired_signature_forbidden(client: AsyncClient, file_with_image):
    fid = file_with_image
    qs = sign_asset_path(fid, "chart.png", ttl_seconds=-10)
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png?{qs}")
    assert resp.status_code == 403


async def test_cross_file_signature_forbidden(client: AsyncClient, file_with_image):
    # A signature minted for a different file must not unlock this file's asset.
    fid = file_with_image
    qs = sign_asset_path(fid + 12345, "chart.png")
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png?{qs}")
    assert resp.status_code == 403


async def test_no_existence_oracle_for_unsigned_request(client: AsyncClient, file_with_image):
    # An unsigned request for a non-existent asset must also 403, not 404, so the
    # endpoint cannot be walked to discover which filenames exist.
    fid = file_with_image
    resp = await client.get(f"/files/{fid}/assets/raw/does-not-exist.png")
    assert resp.status_code == 403
