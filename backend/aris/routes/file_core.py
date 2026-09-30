"""File CRUD, content rendering, and the per-file event stream."""


from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crud, current_user, get_db
from ..authorization import (
    list_user_accessible_files,
    require_edit,
    require_manage,
    require_view,
)
from ..crud.permissions import create_permission
from ..deps import UserRead
from ..logging_config import get_logger
from ..models import File, FileRole
from ..rate_limiting import FILE_CREATE_RATE_LIMIT, limiter
from ..services.file_events import FileEventBroker, get_event_broker, sse_event_stream


logger = get_logger(__name__)


router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(current_user)])


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
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    list of dict
        Non-deleted files the user can access, ordered by last edited descending.
    """
    files_with_roles = await list_user_accessible_files(user.id, db)

    result = []
    for f, role in files_with_roles:
        title = await crud.get_file_title(f.id, db)
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
    db: AsyncSession = Depends(get_db),
):
    """Create a new file with RSM source content.

    Parameters
    ----------
    doc : FileCreate
        File creation data including source, title, and abstract.
    user : UserRead
        Current authenticated user; owns the new file.
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

    # crud.create_file also creates the OWNER permission for the creator.
    result = await crud.create_file(
        source=doc.source,
        owner_id=user.id,
        title=doc.title,
        abstract=doc.abstract,
        db=db,
    )

    return {"id": result.id}


@router.get("/{file_id}")
async def get_file(
    file_id: int,
    user_role: FileRole = Depends(require_view),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a specific file by ID.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to retrieve.
    user_role : FileRole
        User's role for permission checking (injected by require_view).
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
    Requires authentication and VIEW permission.
    """
    doc = await crud.get_file(file_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    # Get extracted title
    title = await crud.get_file_title(file_id, db)

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


@router.put("/{file_id}")
async def update_file(
    file_id: int,
    file_data: FileUpdate,
    user_role: FileRole = Depends(require_edit),
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
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        The updated file object.

    Raises
    ------
    HTTPException
        404 error if file is not found.
        403 error if user lacks EDIT permission.

    Notes
    -----
    Requires authentication and EDIT permission. Empty request fields leave the
    stored value unchanged, so a direct read of the current row supplies the
    defaults (get_file would substitute the RSM-extracted title).
    """
    # Validation happens automatically via Pydantic field_validator

    current = (
        await db.execute(
            select(File).where(File.id == file_id, File.deleted_at.is_(None))
        )
    ).scalars().first()
    if not current:
        raise HTTPException(status_code=404, detail="File not found")

    # An empty request field means "leave unchanged", preserving the previous
    # partial-update semantics.
    title = file_data.title if file_data.title else current.title
    source = file_data.source if file_data.source else current.source
    abstract = file_data.abstract if file_data.abstract else current.abstract

    doc = await crud.update_file(file_id, title, source, db, abstract=abstract)
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    # Get extracted title
    extracted = await crud.get_file_title(file_id, db)

    return {
        "id": doc.id,
        "title": extracted or doc.title,  # Use extracted title or fallback to original
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
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(current_user),
):
    """Soft delete a file by setting deleted_at timestamp.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to delete.
    user_role : FileRole
        User's role for permission checking (injected by require_manage).
    db : AsyncSession
        SQLAlchemy async database session dependency.
    user : UserRead
        Current authenticated user; recorded as the actor.

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
    Requires authentication and OWNER permission.
    """
    result = await crud.soft_delete_file(file_id, db, deleted_by=user.id)
    if not result:
        raise HTTPException(status_code=404, detail="File not found")

    return {"message": f"File {file_id} soft deleted"}


@router.post("/{file_id}/duplicate")
async def duplicate_file(
    file_id: int,
    user_role: FileRole = Depends(require_view),
    user: UserRead = Depends(current_user),
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
    Requires authentication and VIEW permission. crud.duplicate_file copies the
    original's tags; the OWNER permission for the duplicating user is created
    here. User becomes OWNER of the duplicated file.
    """
    try:
        new_doc = await crud.duplicate_file(file_id, user.id, db)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    # Create OWNER permission for the duplicating user
    await create_permission(
        file_id=new_doc.id,
        user_id=user.id,
        role=FileRole.OWNER,
        granted_by=user.id,
        db=db,
    )

    return {"id": new_doc.id, "message": "File duplicated successfully"}


@router.get("/{file_id}/content")
async def get_file_content(
    file_id: int,
    format: str = "html",
    user_role: FileRole = Depends(require_view),
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
    Requires authentication and VIEW permission.
    Structured format enables tooltip support by providing head dependencies and init scripts.
    """
    # Validate format parameter
    if format not in ["html", "structured"]:
        raise HTTPException(status_code=400, detail="Format must be 'html' or 'structured'")

    if format == "structured":
        # Get structured content with head, body, and init_script
        doc = await crud.get_file(file_id, db)
        if not doc:
            raise HTTPException(status_code=404, detail="File not found")
        return await crud.render_structured(doc.source, file_id, db)
    else:
        # Get HTML content (backward compatibility)
        html = await crud.get_file_html(file_id, db)
        if not html:
            raise HTTPException(status_code=404, detail="File not found")
        return HTMLResponse(content=html)


@router.get("/{file_id}/content/{section_name}", response_class=HTMLResponse)
async def get_file_section(
    file_id: int,
    section_name: str,
    handrails: bool = True,
    user_role: FileRole = Depends(require_view),
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
    Requires authentication and VIEW permission.
    """
    html = await crud.get_file_section(file_id, section_name, db, handrails)
    if not html:
        raise HTTPException(status_code=404, detail=f"Section {section_name} not found")

    return HTMLResponse(content=html)



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
