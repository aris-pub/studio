"""Signed-URL access tests for the public raw-asset endpoint (std-b4v9, std-do5t).

GET /files/{file_id}/assets/raw/{filename} is fetched by browser <img> tags that
cannot carry a bearer token, so it stays on the public router but requires a valid
HMAC signature (v + exp + sig query params). These tests lock in that:
- an unsigned, tampered, expired, or cross-file request is rejected before any DB
  lookup (so the endpoint is not an existence/filename oracle),
- a valid request serves the bytes with cache headers and an ETag,
- a conditional GET whose If-None-Match matches the current content returns 304,
- a stale If-None-Match (content changed) returns fresh bytes,
- error responses are marked no-store.
"""

import base64
import time

import pytest
from httpx import AsyncClient

from aris.asset_signing import (
    ASSET_URL_STEP_SECONDS,
    ASSET_URL_TTL_SECONDS,
    compute_content_hash,
    sign_asset_path,
)


PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)
PNG_HASH = compute_content_hash(PNG_B64, "base64")


@pytest.fixture
async def file_with_image(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.post(
        "/files",
        headers=headers,
        json={"title": "Doc", "abstract": "", "owner_id": authenticated_user["user_id"], "source": "x"},
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


def _signed(fid: int, filename: str = "chart.png", content_hash: str = PNG_HASH, now=None) -> str:
    return sign_asset_path(fid, filename, content_hash, now=now)


def _tamper_sig(qs: str) -> str:
    parts = dict(p.split("=", 1) for p in qs.split("&"))
    sig = parts["sig"]
    flipped = sig[:-1] + ("0" if sig[-1] != "0" else "1")
    return f"v={parts['v']}&exp={parts['exp']}&sig={flipped}"


async def test_valid_signature_serves_bytes_with_cache_headers(client: AsyncClient, file_with_image):
    fid = file_with_image
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png?{_signed(fid)}")
    assert resp.status_code == 200
    assert resp.content == base64.b64decode(PNG_B64)
    cc = resp.headers["cache-control"]
    assert "private" in cc
    assert "immutable" in cc
    assert "no-transform" in cc
    assert f"max-age={ASSET_URL_STEP_SECONDS}" in cc
    assert resp.headers.get("etag")  # a validator is present for revalidation


async def test_conditional_get_matching_etag_returns_304(client: AsyncClient, file_with_image):
    fid = file_with_image
    first = await client.get(f"/files/{fid}/assets/raw/chart.png?{_signed(fid)}")
    assert first.status_code == 200
    etag = first.headers["etag"]

    again = await client.get(
        f"/files/{fid}/assets/raw/chart.png?{_signed(fid)}",
        headers={"If-None-Match": etag},
    )
    assert again.status_code == 304
    assert again.content == b""
    # 304 still carries the cache directives so the browser keeps caching.
    assert "private" in again.headers["cache-control"]


async def test_stale_if_none_match_returns_fresh_bytes(client: AsyncClient, file_with_image):
    # A browser holding an old ETag (content changed underneath the same filename)
    # must get the new bytes, not a 304. This preserves the std-iu0n behavior.
    fid = file_with_image
    resp = await client.get(
        f"/files/{fid}/assets/raw/chart.png?{_signed(fid)}",
        headers={"If-None-Match": '"an-old-stale-etag"'},
    )
    assert resp.status_code == 200
    assert resp.content == base64.b64decode(PNG_B64)


async def test_missing_signature_forbidden_and_no_store(client: AsyncClient, file_with_image):
    fid = file_with_image
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png")
    assert resp.status_code == 403
    assert resp.headers.get("cache-control") == "no-store"


async def test_tampered_signature_forbidden(client: AsyncClient, file_with_image):
    fid = file_with_image
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png?{_tamper_sig(_signed(fid))}")
    assert resp.status_code == 403
    assert resp.headers.get("cache-control") == "no-store"


async def test_expired_signature_forbidden(client: AsyncClient, file_with_image):
    fid = file_with_image
    past = int(time.time()) - (ASSET_URL_TTL_SECONDS + ASSET_URL_STEP_SECONDS + 10)
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png?{_signed(fid, now=past)}")
    assert resp.status_code == 403


async def test_cross_file_signature_forbidden(client: AsyncClient, file_with_image):
    # A signature minted for a different file must not unlock this file's asset.
    fid = file_with_image
    resp = await client.get(f"/files/{fid}/assets/raw/chart.png?{_signed(fid + 12345)}")
    assert resp.status_code == 403


async def test_no_existence_oracle_for_unsigned_request(client: AsyncClient, file_with_image):
    # Unsigned request for a non-existent asset must also 403, not 404, so the
    # endpoint cannot be walked to discover which filenames exist.
    fid = file_with_image
    resp = await client.get(f"/files/{fid}/assets/raw/does-not-exist.png")
    assert resp.status_code == 403


async def test_valid_signature_for_missing_asset_is_404_and_no_store(client: AsyncClient, file_with_image):
    # A caller with a valid signature for a filename that does not exist gets 404
    # (they were authorized), and it must not be cached.
    fid = file_with_image
    qs = sign_asset_path(fid, "ghost.png", "0" * 64)
    resp = await client.get(f"/files/{fid}/assets/raw/ghost.png?{qs}")
    assert resp.status_code == 404
    assert resp.headers.get("cache-control") == "no-store"
