import base64
import binascii
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import current_user, get_db, get_file_service
from ..authorization import (
    list_user_accessible_files,
    require_edit,
    require_manage,
    require_view,
)
from ..collaboration import get_collaboration_manager, mint_collab_token
from ..config import settings
from ..crud.file_assets import FileAssetCreate, FileAssetDB, FileAssetOut, FileAssetUpdate
from ..crud.permissions import create_permission
from ..deps import UserRead
from ..logging_config import get_logger
from ..models import FileAsset
from ..models.models import FileRole
from ..rate_limiting import ASSET_UPLOAD_RATE_LIMIT, FILE_CREATE_RATE_LIMIT, limiter
from ..services.file_events import FileEventBroker, get_event_broker, sse_event_stream
from ..services.file_service import FileCreateData, FileUpdateData, InMemoryFileService


logger = get_logger(__name__)


router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(current_user)])
public_router = APIRouter(prefix="/files", tags=["files"])


class FileCreate(BaseModel):
    title: str = ""
    abstract: str = ""
    source: str

    @field_validator('source')
    @classmethod
    def validate_rsm_source(cls, v: str) -> str:
        """Validate RSM source format.

        Parameters
        ----------
        v : str
            The source content to validate.

        Returns
        -------
        str
            The validated source content.
        """
        # Currently no validation - placeholder for future checks
        return v


class FileUpdate(BaseModel):
    title: str = ""
    abstract: str = ""
    owner_id: int | None = None
    source: str = ""

    @field_validator('source')
    @classmethod
    def validate_rsm_source(cls, v: str) -> str:
        """Validate RSM source format for updates.

        Parameters
        ----------
        v : str
            The source content to validate.

        Returns
        -------
        str
            The validated source content.
        """
        # Currently no validation - placeholder for future checks
        return v




@router.get("")
async def get_files(
    user: UserRead = Depends(current_user),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve files the current user can access (owned or shared).

    Returns the union of files where the user is the owner and files where an
    undeleted FilePermission row grants the user any role. Each entry includes
    a ``role`` field so the frontend can distinguish owned-vs-shared.

    Parameters
    ----------
    user : UserRead
        Current authenticated user.
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    list of dict
        Non-deleted files the user can access, ordered by last edited descending.
    """
    await file_service.sync_from_database(db)

    files_with_roles = await list_user_accessible_files(user.id, db)

    result = []
    for f, role in files_with_roles:
        title = await file_service.get_file_title(f.id)
        # Do NOT compile html here. Rendering a large manuscript can take many
        # seconds, and the home page would block on every file's compile even
        # though it only displays metadata (title, role, last edited). The
        # frontend lazy-loads html when the user actually opens a file (see
        # Canvas.vue's fetchContent path → /render/private).
        result.append({
            "id": f.id,
            "title": title or f.title,
            "abstract": f.abstract,
            "last_edited_at": f.last_edited_at,
            "source": f.source,
            "owner_id": f.owner_id,
            "status": f.status.value,
            "created_at": f.created_at,
            "html": "",
            "role": role.value,
        })
    return result


@router.post("")
@limiter.limit(FILE_CREATE_RATE_LIMIT)
async def create_file(
    request: Request,
    doc: FileCreate,
    user: UserRead = Depends(current_user),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Create a new file with RSM source content.

    Parameters
    ----------
    doc : FileCreate
        File creation data including source, title, and abstract.
    user : UserRead
        Current authenticated user; owns the new file.
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        Dictionary containing the new file's ID.

    Raises
    ------
    HTTPException
        400 error if RSM source format is invalid.

    Notes
    -----
    Requires authentication. Validates RSM source format before creation.
    Owner is always the authenticated caller; any ``owner_id`` in the
    request body is ignored. Sets file status to DRAFT by default.
    """
    # Validation happens automatically via Pydantic field_validator

    # Create file data
    create_data = FileCreateData(
        title=doc.title,
        abstract=doc.abstract,
        source=doc.source,
        owner_id=user.id,
    )

    result = await file_service.create_file(create_data, db=db)

    # Create OWNER permission for the file creator
    await create_permission(
        file_id=result.id,
        user_id=user.id,
        role=FileRole.OWNER,
        granted_by=user.id,
        db=db,
    )

    return {"id": result.id}


FORMAT_MAP = {
    ".md": "markdown",
    ".tex": "latex",
    ".latex": "latex",
    ".docx": "docx",
}

BINARY_FORMATS = {"docx"}


@router.post("/import")
async def import_file(
    file: UploadFile,
    format: str | None = None,
    user: UserRead = Depends(current_user),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    import asyncio
    import os
    import re
    import tempfile

    from rsm.app import pandoc_import as rsm_pandoc_import

    filename = file.filename or "untitled"
    ext = os.path.splitext(filename)[1].lower()

    if format is None:
        format = FORMAT_MAP.get(ext)
        if format is None:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot detect format from extension '{ext}'. "
                f"Supported: {', '.join(FORMAT_MAP.keys())}",
            )

    if format not in FORMAT_MAP.values():
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{format}'. "
            f"Supported: {', '.join(sorted(set(FORMAT_MAP.values())))}",
        )

    content = await file.read()

    if format in BINARY_FORMATS:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            rsm_source = await asyncio.to_thread(
                rsm_pandoc_import, path=tmp_path, from_format=format,
            )
        finally:
            os.unlink(tmp_path)
    else:
        text = content.decode("utf-8")
        rsm_source = await asyncio.to_thread(
            rsm_pandoc_import, source=text, from_format=format,
        )

    # Extract title from the first heading in converted RSM
    title_match = re.search(r"^#\s+(.+)$", rsm_source, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else os.path.splitext(filename)[0]

    create_data = FileCreateData(
        title=title,
        abstract="",
        source=rsm_source,
        owner_id=user.id,
    )
    result = await file_service.create_file(create_data, db=db)
    await create_permission(
        file_id=result.id,
        user_id=user.id,
        role=FileRole.OWNER,
        granted_by=user.id,
        db=db,
    )

    return {"id": result.id}


@router.get("/{file_id}")
async def get_file(
    file_id: int,
    user_role: FileRole = Depends(require_view),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a specific file by ID.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to retrieve.
    user_role : FileRole
        User's role for permission checking (injected by require_view).
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        File information including id, title, abstract, source, and metadata.

    Raises
    ------
    HTTPException
        404 error if file is not found or has been deleted.
        403 error if user lacks VIEW permission.

    Notes
    -----
    Requires authentication and VIEW permission. Uses file service for in-memory access.
    """
    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)

    # Get file from memory
    doc = await file_service.get_file(file_id)
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    # Get extracted title
    title = await file_service.get_file_title(file_id)

    return {
        "id": file_id,
        "title": title or doc.title,  # Use extracted title or fallback to original
        "abstract": doc.abstract,
        "last_edited_at": doc.last_edited_at,
        "source": doc.source,
        "owner_id": doc.owner_id,
        "status": doc.status.value,
        "created_at": doc.created_at,
        "role": user_role.value,
    }


@router.post("/{file_id}/collab/start")
async def collab_start(
    file_id: int,
    user: UserRead = Depends(current_user),
    user_role: FileRole = Depends(require_view),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Signal that the collaborative editor has opened for this file.

    Called by the frontend (and CLI/agents) when an editor mounts. Starts the
    backend Y.js client so edits are persisted to the database, and returns a
    short-lived WS-auth token the caller must present as the first message on
    its multi-player WebSocket connection.

    Gate is ``require_view``: any user who can view the file may open a live
    session. The multi-player server enforces role-based write filtering
    (std-ecup) -- it drops document-mutating Y.js frames from sockets whose
    token role is not OWNER/EDITOR/backend -- so a COMMENTER receives a token,
    joins read-only, and observes live edits without being able to persist any.
    The token still carries the caller's real role for that enforcement.
    """
    await file_service.sync_from_database(db)
    doc = await file_service.get_file(file_id)
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    manager = get_collaboration_manager()
    await manager.start_client(file_id)

    token = mint_collab_token(
        user_id=user.id,
        file_id=file_id,
        role=user_role.value,
    )
    return {"status": "ok", "token": token}


@router.post("/{file_id}/collab/stop")
async def collab_stop(
    file_id: int,
    user_role: FileRole = Depends(require_edit),
):
    """Signal that the collaborative editor has closed for this file.

    Called by the frontend when the CodeMirror editor unmounts. Stops the backend
    Y.js client cleanly after persisting any remaining changes.

    Gate is ``require_edit`` (mirrors ``collab_start``): stopping a file's live
    collaboration client is a privileged operation, so only users with write
    access may do it. Requiring the file to exist means a stop for an
    already-deleted file now returns 404 instead of silently succeeding.
    """
    manager = get_collaboration_manager()
    await manager.stop_client(file_id)
    return {"status": "ok"}


@router.post("/{file_id}/collab/flush")
async def collab_flush(
    file_id: int,
    user_role: FileRole = Depends(require_edit),
):
    """Flush the Y.js client's content to the database immediately.

    Called before export to ensure the DB has the latest content without
    competing with the Y.js save loop.

    Gate is ``require_edit`` (mirrors ``collab_start``): only users with write
    access may force a flush of a file's live collaboration client.
    """
    manager = get_collaboration_manager()
    client = manager.clients.get(file_id)
    if client and client.text:
        await client._save_to_db(force=True)
    return {"status": "ok"}


@router.put("/{file_id}")
async def update_file(
    file_id: int,
    file_data: FileUpdate,
    user_role: FileRole = Depends(require_edit),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing file's content and metadata.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to update.
    file_data : FileUpdate
        Updated file data including title, abstract, and source.
    user_role : FileRole
        User's role for permission checking (injected by require_edit).
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    FileData
        The updated file object.

    Raises
    ------
    HTTPException
        404 error if file is not found.
        403 error if user lacks EDIT permission.

    Notes
    -----
    Requires authentication and EDIT permission. Uses file service for in-memory updates.
    """
    # Validation happens automatically via Pydantic field_validator

    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)
    
    # Create update data
    update_data = FileUpdateData(
        title=file_data.title if file_data.title else None,
        abstract=file_data.abstract if file_data.abstract else None,
        source=file_data.source if file_data.source else None
    )
    
    # Update in memory
    doc = await file_service.update_file(file_id, update_data)
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Save to database
    await file_service.update_file_in_database(file_id, db)
    
    # Get extracted title
    title = await file_service.get_file_title(file_id)
    
    return {
        "id": doc.id,
        "title": title or doc.title,  # Use extracted title or fallback to original
        "abstract": doc.abstract,
        "last_edited_at": doc.last_edited_at,
        "source": doc.source,
        "owner_id": doc.owner_id,
        "status": doc.status.value,
        "created_at": doc.created_at,
    }


@router.delete("/{file_id}")
async def soft_delete_file(
    file_id: int,
    user_role: FileRole = Depends(require_manage),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a file by setting deleted_at timestamp.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to delete.
    user_role : FileRole
        User's role for permission checking (injected by require_manage).
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        Success message confirming the deletion.

    Raises
    ------
    HTTPException
        404 error if file is not found.
        403 error if user lacks OWNER permission.

    Notes
    -----
    Requires authentication and OWNER permission. Uses file service for in-memory soft delete.
    """
    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)
    
    # Delete in memory
    deleted = await file_service.delete_file(file_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Save to database
    await file_service.delete_file_in_database(file_id, db)
    
    return {"message": f"File {file_id} soft deleted"}


@router.post("/{file_id}/duplicate")
async def duplicate_file(
    file_id: int,
    user_role: FileRole = Depends(require_view),
    user: UserRead = Depends(current_user),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db)
):
    """Create a duplicate copy of an existing file.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to duplicate.
    user_role : FileRole
        User's role for permission checking (injected by require_view).
    user : UserRead
        Current authenticated user.
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        Dictionary containing new file ID and success message.

    Raises
    ------
    HTTPException
        404 error if original file is not found.
        403 error if user lacks VIEW permission.

    Notes
    -----
    Requires authentication and VIEW permission. Uses file service for in-memory duplication
    and copies tags from the original file. User becomes OWNER of the duplicated file.
    """
    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)
    
    new_doc = await file_service.duplicate_file(file_id, db=db)
    if not new_doc:
        raise HTTPException(status_code=404, detail="File not found")

    # Create OWNER permission for the duplicating user
    await create_permission(
        file_id=new_doc.id,
        user_id=user.id,
        role=FileRole.OWNER,
        granted_by=user.id,
        db=db,
    )

    # Copy tags from original file (using original logic)
    from ..models.models import file_tags
    tag_ids = (
        await db.execute(file_tags.select().where(file_tags.c.file_id == file_id))
    ).fetchall()
    if tag_ids:
        await db.execute(
            file_tags.insert(),
            [{"file_id": new_doc.id, "tag_id": tag.tag_id} for tag in tag_ids],
        )
        await db.commit()

    return {"id": new_doc.id, "message": "File duplicated successfully"}


@router.get("/{file_id}/content")
async def get_file_content(
    file_id: int,
    format: str = "html",
    user_role: FileRole = Depends(require_view),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve rendered content for a file in specified format.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to render.
    format : str, optional
        Response format: "html" for HTML response or "structured" for JSON with head/body/init_script (default: "html").
    user_role : FileRole
        User's role for permission checking (injected by require_view).
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    HTMLResponse or dict
        For format="html": HTMLResponse with rendered HTML content.
        For format="structured": JSON dict with keys: head, body, init_script.

    Raises
    ------
    HTTPException
        404 error if file is not found.
        400 error if format parameter is invalid.
        403 error if user lacks VIEW permission.

    Notes
    -----
    Requires authentication and VIEW permission. Uses file service for cached rendering.
    Structured format enables tooltip support by providing head dependencies and init scripts.
    """
    # Validate format parameter
    if format not in ["html", "structured"]:
        raise HTTPException(status_code=400, detail="Format must be 'html' or 'structured'")
    
    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)
    
    if format == "structured":
        # Get structured content with head, body, and init_script
        content = await file_service.get_file_content_structured(file_id, db=db)
        if not content:
            raise HTTPException(status_code=404, detail="File not found")
        return content
    else:
        # Get HTML content (backward compatibility)
        html = await file_service.get_file_html(file_id, db=db)
        if not html:
            raise HTTPException(status_code=404, detail="File not found")
        return HTMLResponse(content=html)


@router.get("/{file_id}/content/{section_name}", response_class=HTMLResponse)
async def get_file_section(
    file_id: int,
    section_name: str,
    handrails: bool = True,
    user_role: FileRole = Depends(require_view),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve rendered HTML for a specific section of a file.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file.
    section_name : str
        Name of the section to extract (e.g., 'minimap', 'abstract').
    handrails : bool, optional
        Whether to enable handrails in the rendered output (default: True).
    user_role : FileRole
        User's role for permission checking (injected by require_view).
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    HTMLResponse
        Rendered HTML content for the specified section.

    Raises
    ------
    HTTPException
        404 error if file or section is not found.
        403 error if user lacks VIEW permission.

    Notes
    -----
    Requires authentication and VIEW permission. Uses file service for cached section rendering.
    """
    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)
    
    # Get section HTML from file service (with caching)
    html = await file_service.get_file_section(file_id, section_name, handrails)
    if not html:
        raise HTTPException(status_code=404, detail=f"Section {section_name} not found")
    
    return HTMLResponse(content=html)



class _ExportBody(BaseModel):
    """Optional request body for export routes — provides live editor source."""
    source: str = ""


class _AssetBody(BaseModel):
    """Request body for uploading a file asset (file_id comes from the URL path)."""

    filename: str
    mime_type: str
    content: str
    content_encoding: str = "plain"

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
    file_id: int,
    filename: str,
    exp: int = 0,
    sig: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Serve raw asset bytes for browser <img> rendering.

    This stays on the public router because an <img> tag cannot send a bearer
    token. Access is proved instead by the short-lived HMAC signature the renderer
    minted for a caller it had already authorized (see aris.asset_signing). The
    signature is checked before any DB lookup, so a caller without a valid one
    cannot use the 200-vs-404 response to discover which filenames exist.
    """
    import base64 as b64
    import mimetypes

    from aris.asset_signing import verify_asset_signature

    if not verify_asset_signature(file_id, filename, exp, sig):
        raise HTTPException(status_code=403, detail="Invalid or expired asset signature")

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

    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    encoding = getattr(asset, "content_encoding", "plain")
    if encoding == "base64":
        data = b64.b64decode(asset.content)
    else:
        content_str: str = asset.content  # type: ignore[assignment]
        data = content_str.encode("utf-8")

    return Response(content=data, media_type=mime)


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


@router.get("/{file_id}/events")
async def file_events(
    file_id: int,
    user: UserRead = Depends(current_user),
    user_role: FileRole = Depends(require_view),
    broker: FileEventBroker = Depends(get_event_broker),
):
    """Stream this file's events to the caller's browser as Server-Sent Events.

    A general per-file channel (see aris.services.file_events): any backend code
    can publish a typed event to a file and every open tab viewing it receives
    it. The first consumer is the asset-change notification (std-iu0n) that tells
    the tab to recompile when an asset changes out of band. Gate is require_view.

    Consumed from the browser with fetch() rather than EventSource, which cannot
    send the bearer token. Auth resolves before streaming, so an unauthorized
    caller is rejected up front instead of opening a stream.
    """

    return StreamingResponse(
        sse_event_stream(broker, file_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Stop nginx/Fly from buffering so events flush to the client at once.
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{file_id}/download/pdf")
async def download_file_pdf(
    file_id: int,
    body: Optional[_ExportBody] = None,
    user_role: FileRole = Depends(require_view),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Download file as a PDF document via Typst.

    Accepts an optional JSON body with ``source`` containing the live editor
    content.  When omitted, falls back to the Y.js collaboration client or the
    database.
    """
    import asyncio
    import os
    import re
    import subprocess
    import tempfile

    from rsm.app import pandoc_export as rsm_pandoc_export

    await file_service.sync_from_database(db)
    file_data = await file_service.get_file(file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")

    # Priority: request body > Y.js client > DB
    source = (body.source if body and body.source else None)
    if not source:
        manager = get_collaboration_manager()
        client = manager.clients.get(file_id)
        if client and client.text and len(client.text) > 0:
            source = str(client.text)
    if not source:
        source = file_data.source
    if not source:
        raise HTTPException(status_code=404, detail="File has no content")

    try:
        typst_source = await asyncio.to_thread(
            rsm_pandoc_export,
            source,
            to_format="typst",
        )
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"PDF export is not yet supported for this document. The RSM-to-PDF pipeline encountered an error: {e}",
        )

    # Cross-references and citations are now handled by the RSM Pandoc
    # translator with proper labels — no post-processing needed

    with tempfile.TemporaryDirectory() as tmpdir:
        typ_path = os.path.join(tmpdir, "manuscript.typ")
        pdf_path = os.path.join(tmpdir, "manuscript.pdf")
        with open(typ_path, "w", encoding="utf-8") as f:
            f.write(typst_source)

        # Write file assets (images, SVGs, static fallbacks) to temp dir
        import base64
        import binascii

        from sqlalchemy import select

        from ..models.models import FileAsset
        asset_result = await db.execute(
            select(FileAsset)
            .where(FileAsset.file_id == file_id)
            .where(FileAsset.deleted_at.is_(None))
        )
        for asset in asset_result.scalars().all():
            asset_path = os.path.join(tmpdir, asset.filename)
            try:
                encoding = getattr(asset, "content_encoding", "plain")
                if encoding == "base64":
                    data = base64.b64decode(asset.content)
                    with open(asset_path, "wb") as af:
                        af.write(data)
                else:
                    with open(asset_path, "w", encoding="utf-8") as af:
                        af.write(asset.content)
            except (binascii.Error, OSError):
                logger.warning("Failed to write asset %s for file %s", asset.filename, file_id, exc_info=True)
        # First compilation attempt
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                ["typst", "compile", typ_path, pdf_path],
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="typst not found; install typst")

        # If compilation had errors, strip broken image references and retry
        if result.returncode != 0 and result.stderr:
            import re as _re
            fixed_source = typst_source
            # Match filenames from Typst errors like:
            #   "searched at /tmp/.../file.svg)"  or  "/file.svg:"
            for m in _re.finditer(r'/([^\s/]+\.\w+)[):\s]', result.stderr):
                bad_file = m.group(1)
                fixed_source = fixed_source.replace(
                    f'image("{bad_file}")',
                    f'text(fill: rgb("#888"))[Figure: {bad_file} — could not render]',
                )
            with open(typ_path, "w", encoding="utf-8") as f:
                f.write(fixed_source)
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            try:
                await asyncio.to_thread(
                    subprocess.run,
                    ["typst", "compile", typ_path, pdf_path],
                    capture_output=True,
                )
            except FileNotFoundError:
                logger.error("typst binary not found during retry compilation for file %s", file_id)

        if not os.path.exists(pdf_path):
            stderr = getattr(result, 'stderr', '') or ''
            # Filter out font warnings to show actual errors
            error_lines = [line for line in stderr.splitlines() if 'error' in line.lower() and 'unknown font' not in line.lower()]
            error_msg = '\n'.join(error_lines[:10]) if error_lines else stderr[:1000]
            raise HTTPException(
                status_code=422,
                detail=f"PDF compilation failed: {error_msg}" if error_msg else "PDF compilation produced no output",
            )
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

    title = await file_service.get_file_title(file_id)
    if not title:
        title = str(file_data.title) if file_data.title else "manuscript"
    filename = re.sub(r'[<>:"/\\|?*]', '_', title) + ".pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/{file_id}/download")
async def download_file(
    file_id: int,
    body: Optional[_ExportBody] = None,
    user_role: FileRole = Depends(require_view),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Download file as a complete standalone HTML document.

    Accepts an optional JSON body with ``source`` containing the live editor
    content.  When omitted, falls back to the Y.js collaboration client or the
    database.
    """
    import asyncio
    import re

    import rsm

    await file_service.sync_from_database(db)
    file_data = await file_service.get_file(file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")

    # Priority: request body > Y.js client > DB
    source = (body.source if body and body.source else None)
    if not source:
        manager = get_collaboration_manager()
        client = manager.clients.get(file_id)
        if client and client.text and len(client.text) > 0:
            source = str(client.text)
    if not source:
        source = file_data.source
    if not source:
        raise HTTPException(status_code=404, detail="File has no content")

    # Create asset resolver to load file assets from database
    from ..services.asset_resolver import FileAssetResolver
    asset_resolver = await FileAssetResolver.create_for_file(file_id, db)
    asset_resolver._standalone = True

    html = await asyncio.to_thread(
        rsm.build,
        source,
        handrails=False,
        lint=False,
        standalone=True,
        asset_resolver=asset_resolver
    )

    # Get file title for filename
    title = await file_service.get_file_title(file_id)
    if not title:
        title = str(file_data.title) if file_data.title else "manuscript"

    # Sanitize filename (remove invalid characters)
    filename = re.sub(r'[<>:"/\\|?*]', '_', title) + '.html'

    # Return as downloadable file
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

