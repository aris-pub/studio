"""File asset CRUD, plus the public signed-URL raw-asset endpoint."""

import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import current_user, get_db, get_file_service
from ..asset_filenames import validate_asset_filename
from ..authorization import (
    require_edit,
    require_view,
)
from ..config import settings
from ..crud.file_assets import FileAssetCreate, FileAssetDB, FileAssetOut, FileAssetUpdate
from ..deps import UserRead
from ..logging_config import get_logger
from ..models import FileAsset, FileRole
from ..rate_limiting import ASSET_UPLOAD_RATE_LIMIT, limiter
from ..services.file_events import get_event_broker
from ..services.file_service import InMemoryFileService


logger = get_logger(__name__)


router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(current_user)])
public_router = APIRouter(prefix="/files", tags=["files"])


class _AssetBody(BaseModel):
    """Request body for uploading a file asset (file_id comes from the URL path)."""

    filename: str
    mime_type: str
    content: str
    content_encoding: str = "plain"

    @field_validator("filename")
    @classmethod
    def _validate_filename(cls, v: str) -> str:
        return validate_asset_filename(v)

    @field_validator("content_encoding")
    @classmethod
    def _validate_encoding(cls, v: str) -> str:
        if v not in ("plain", "base64"):
            raise ValueError("content_encoding must be 'plain' or 'base64'")
        return v

    @model_validator(mode="after")
    def _validate_base64_content(self) -> "_AssetBody":
        if self.content_encoding == "base64":
            try:
                base64.b64decode(self.content)
            except (TypeError, binascii.Error):
                raise ValueError("Invalid base64-encoded string")
        return self


def _enforce_asset_size_limit(content: str, content_encoding: str) -> None:
    """Reject asset content whose decoded size exceeds ``settings.MAX_ASSET_BYTES``.

    Raises HTTP 413 when the limit is exceeded. The limit is on the DECODED byte
    length, so it is stable regardless of encoding (base64 inflates the wire size
    by ~33%). For base64 we first reject on the raw string length when it is large
    enough that no valid base64 could possibly fit under the limit: that avoids
    allocating a huge buffer just to measure an abusive payload, which is the whole
    point on the single small prod machine.
    """
    max_bytes = settings.MAX_ASSET_BYTES

    if content_encoding == "base64":
        # 4 base64 chars encode 3 bytes, so any string longer than this cannot
        # decode to <= max_bytes. Reject before decoding to avoid the allocation.
        max_b64_chars = ((max_bytes + 2) // 3) * 4
        if len(content) > max_b64_chars:
            _raise_asset_too_large(max_bytes)
        try:
            decoded_len = len(base64.b64decode(content))
        except (TypeError, binascii.Error):
            # Invalid base64 is a 422 handled by the request model, not our concern.
            return
    else:
        # A UTF-8 string is at least one byte per character, so a character count
        # over the limit is already over the byte limit; skip encoding it.
        if len(content) > max_bytes:
            _raise_asset_too_large(max_bytes)
        decoded_len = len(content.encode("utf-8"))

    if decoded_len > max_bytes:
        _raise_asset_too_large(max_bytes)


def _raise_asset_too_large(max_bytes: int) -> None:
    if max_bytes >= 1024 * 1024:
        limit = f"{max_bytes // (1024 * 1024)} MB"
    elif max_bytes >= 1024:
        limit = f"{max_bytes // 1024} KB"
    else:
        limit = f"{max_bytes} bytes"
    raise HTTPException(status_code=413, detail=f"Asset exceeds {limit} limit")


@router.get("/{file_id}/assets", response_model=list[FileAssetOut])
async def get_assets_for_file(
    file_id: int,
    user_role: FileRole = Depends(require_view),
    db: AsyncSession = Depends(get_db),
):
    """List all non-deleted assets for a file. Any viewer (including collaborators) can list."""
    result = await db.execute(
        select(FileAsset).where(
            FileAsset.file_id == file_id,
            FileAsset.deleted_at.is_(None),
        )
    )
    return result.scalars().all()


@router.post("/{file_id}/assets", response_model=FileAssetOut)
@limiter.limit(ASSET_UPLOAD_RATE_LIMIT)
async def create_asset_for_file(
    request: Request,
    file_id: int,
    payload: _AssetBody,
    user_role: FileRole = Depends(require_edit),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(current_user),
    file_service: InMemoryFileService = Depends(get_file_service),
):
    """Upload a new asset to a file. Requires edit permission."""
    _enforce_asset_size_limit(payload.content, payload.content_encoding)
    asset = await FileAssetDB.create_asset(
        FileAssetCreate(
            filename=payload.filename,
            mime_type=payload.mime_type,
            content=payload.content,
            content_encoding=payload.content_encoding,
            file_id=file_id,
        ),
        user.id,
        db,
    )
    await file_service.clear_file_cache(file_id)
    get_event_broker().publish(file_id, {"type": "asset-changed"})
    return asset


@public_router.get("/{file_id}/assets/raw/{filename:path}")
async def get_asset_raw(
    request: Request,
    file_id: int,
    filename: str,
    v: str = "",
    exp: int = 0,
    sig: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Serve raw asset bytes for browser <img> rendering.

    This stays on the public router because an <img> tag cannot send a bearer
    token. Access is proved instead by the HMAC signature the renderer minted for a
    caller it had already authorized (see aris.asset_signing). The signature is
    verified before any DB lookup, so a caller without a valid one cannot use the
    200-vs-404 response to discover which filenames exist.

    The URL is cache-stable (std-do5t): the content-derived ``v`` only changes when
    the bytes change, so the browser caches an unchanged image instead of
    refetching it on every debounced render. An ``ETag`` lets a stale cache
    revalidate cheaply, and a content change (same filename, new bytes) yields a new
    ETag so the browser gets the fresh bytes.
    """
    import base64 as b64
    import mimetypes

    from aris.asset_signing import (
        ASSET_URL_STEP_SECONDS,
        asset_etag,
        compute_content_hash,
        verify_asset_signature,
    )

    no_store = {"Cache-Control": "no-store"}

    if not verify_asset_signature(file_id, filename, v, exp, sig):
        raise HTTPException(
            status_code=403, detail="Invalid or expired asset signature", headers=no_store
        )

    from sqlalchemy import select
    result = await db.execute(
        select(FileAsset)
        .where(FileAsset.file_id == file_id)
        .where(FileAsset.filename == filename)
        .where(FileAsset.deleted_at.is_(None))
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found", headers=no_store)

    encoding = getattr(asset, "content_encoding", "plain")
    # Prefer the stored hash; fall back to hashing for a legacy row without one. The
    # ETag reflects the CURRENT bytes, so an old URL whose v is stale still gets the
    # fresh content (a 200, not a 304) when the image has changed.
    content_hash = asset.content_hash or compute_content_hash(asset.content, encoding)
    etag = f'"{asset_etag(file_id, filename, content_hash)}"'
    cache_headers = {
        # private so no shared cache/CDN keeps a private manuscript image. immutable
        # is safe because a content change mints a new URL, so within max-age the
        # browser never needs to revalidate. max-age is the quantization step, at or
        # below the token TTL, so caching never outlives the token.
        "Cache-Control": f"private, max-age={ASSET_URL_STEP_SECONDS}, immutable, no-transform",
        "ETag": etag,
    }

    if_none_match = request.headers.get("if-none-match", "")
    presented = {tag.strip().removeprefix("W/") for tag in if_none_match.split(",") if tag.strip()}
    if etag in presented or "*" in presented:
        return Response(status_code=304, headers=cache_headers)

    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    if encoding == "base64":
        data = b64.b64decode(asset.content)
    else:
        content_str: str = asset.content  # type: ignore[assignment]
        data = content_str.encode("utf-8")

    return Response(content=data, media_type=mime, headers=cache_headers)


@router.get("/{file_id}/assets/by-name/{filename:path}", response_model=FileAssetOut)
async def get_asset_by_name(
    file_id: int,
    filename: str,
    user_role: FileRole = Depends(require_view),
    db: AsyncSession = Depends(get_db),
):
    """Get an asset by filename. Requires view permission."""
    from sqlalchemy import select
    result = await db.execute(
        select(FileAsset)
        .where(FileAsset.file_id == file_id)
        .where(FileAsset.filename == filename)
        .where(FileAsset.deleted_at.is_(None))
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/{file_id}/assets/{asset_id}", response_model=FileAssetOut)
async def update_asset_for_file(
    file_id: int,
    asset_id: int,
    payload: FileAssetUpdate,
    user_role: FileRole = Depends(require_edit),
    db: AsyncSession = Depends(get_db),
    file_service: InMemoryFileService = Depends(get_file_service),
):
    """Update an asset's filename or content. Requires edit permission."""
    asset = await db.get(FileAsset, asset_id)
    if not asset or asset.file_id != file_id or asset.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Asset not found")
    if payload.content is not None:
        # An update carries no encoding of its own; reuse the stored asset's so the
        # decoded-size check matches how the content will actually be persisted.
        _enforce_asset_size_limit(payload.content, getattr(asset, "content_encoding", "base64"))
    result = await FileAssetDB.update_asset(asset, payload, db)
    await file_service.clear_file_cache(file_id)
    get_event_broker().publish(file_id, {"type": "asset-changed"})
    return result


@router.delete("/{file_id}/assets/{asset_id}")
async def delete_asset_for_file(
    file_id: int,
    asset_id: int,
    user_role: FileRole = Depends(require_edit),
    db: AsyncSession = Depends(get_db),
    file_service: InMemoryFileService = Depends(get_file_service),
):
    """Soft-delete an asset. Requires edit permission."""
    asset = await db.get(FileAsset, asset_id)
    if not asset or asset.file_id != file_id or asset.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Asset not found")
    await FileAssetDB.soft_delete_asset(asset, db)
    await file_service.clear_file_cache(file_id)
    get_event_broker().publish(file_id, {"type": "asset-changed"})
    return {"message": f"Asset {asset_id} deleted"}


