from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import current_user, get_db, get_file_service
from ..deps import UserRead
from ..models import FileAsset
from ..services.file_service import FileCreateData, FileUpdateData, InMemoryFileService
from .file_assets import FileAssetOut


router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(current_user)])


class FileCreate(BaseModel):
    title: str = ""
    abstract: str = ""
    owner_id: int
    source: str

    @field_validator('source')
    @classmethod
    def validate_rsm_source(cls, v: str) -> str:
        """Validate RSM source format.
        
        RSM (Research Source Markup) requires specific formatting markers.
        Empty or None source values are allowed and skip validation.
        
        Parameters
        ----------
        v : str
            The source content to validate.
            
        Returns
        -------
        str
            The validated source content.
            
        Raises
        ------
        ValueError
            If source format is invalid (must start with ':rsm:' and end with '::').
        """
        if not v:  # Allow empty sources
            return v
        if not v.strip().startswith(":rsm:"):
            raise ValueError("Malformed RSM source.")
        if not v.strip().endswith("::"):
            raise ValueError("Malformed RSM source.")
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
            
        Raises
        ------
        ValueError
            If source format is invalid (must start with ':rsm:' and end with '::').
        """
        if not v:  # Allow empty sources
            return v
        if not v.strip().startswith(":rsm:"):
            raise ValueError("Malformed RSM source.")
        if not v.strip().endswith("::"):
            raise ValueError("Malformed RSM source.")
        return v




@router.get("")
async def get_files(
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all files with extracted titles.

    Parameters
    ----------
    file_service : InMemoryFileService
        File service dependency.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    list of FileData
        List of all non-deleted files with title attributes populated.

    Notes
    -----
    Requires authentication. Uses file service for in-memory access.
    """
    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)
    
    # Get files from memory
    files = await file_service.get_all_files()
    
    # Convert to response format with extracted titles
    result = []
    for f in files:
        title = await file_service.get_file_title(f.id)
        result.append({
            "id": f.id,
            "title": title or f.title,  # Use extracted title or fallback to original
            "abstract": f.abstract,
            "last_edited_at": f.last_edited_at,
            "source": f.source,
            "owner_id": f.owner_id,
            "status": f.status.value,
            "created_at": f.created_at,
        })
    return result


@router.post("")
async def create_file(
    doc: FileCreate,
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Create a new file with RSM source content.

    Parameters
    ----------
    doc : FileCreate
        File creation data including source, owner_id, title, and abstract.
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
    Sets file status to DRAFT by default.
    """
    # Validation happens automatically via Pydantic field_validator

    # Create file data
    create_data = FileCreateData(
        title=doc.title,
        abstract=doc.abstract,
        source=doc.source,
        owner_id=doc.owner_id
    )
    
    # Create in memory
    result = await file_service.create_file(create_data)
    
    # Save to database
    await file_service.save_file_to_database(result.id, db)
    
    return {"id": result.id}


@router.get("/{file_id}")
async def get_file(
    file_id: int, 
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(current_user)
):
    """Retrieve a specific file by ID.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to retrieve.
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

    Notes
    -----
    Requires authentication. Uses file service for in-memory access.
    """
    # Check file ownership first
    from ..models.models import File
    result = await db.execute(select(File).where(File.id == file_id, File.deleted_at.is_(None)))
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_record.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    }


@router.put("/{file_id}")
async def update_file(
    file_id: int,
    file_data: FileUpdate,
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(current_user)
):
    """Update an existing file's content and metadata.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to update.
    file_data : FileUpdate
        Updated file data including title, abstract, and source.
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

    Notes
    -----
    Requires authentication. Uses file service for in-memory updates.
    """
    # Check file ownership first
    from ..models.models import File
    result = await db.execute(select(File).where(File.id == file_id, File.deleted_at.is_(None)))
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_record.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(current_user)
):
    """Soft delete a file by setting deleted_at timestamp.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to delete.
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

    Notes
    -----
    Requires authentication. Uses file service for in-memory soft delete.
    """
    # Check file ownership first
    from ..models.models import File
    result = await db.execute(select(File).where(File.id == file_id, File.deleted_at.is_(None)))
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_record.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db)
):
    """Create a duplicate copy of an existing file.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file to duplicate.
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

    Notes
    -----
    Requires authentication. Uses file service for in-memory duplication
    and copies tags from the original file.
    """
    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)
    
    # Duplicate in memory
    new_doc = await file_service.duplicate_file(file_id)
    if not new_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Save to database
    await file_service.save_file_to_database(new_doc.id, db)
    
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

    Notes
    -----
    Requires authentication. Uses file service for cached rendering.
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

    Notes
    -----
    Requires authentication. Uses file service for cached section rendering.
    """
    # Sync from database to ensure we have latest data
    await file_service.sync_from_database(db)
    
    # Get section HTML from file service (with caching)
    html = await file_service.get_file_section(file_id, section_name, handrails)
    if not html:
        raise HTTPException(status_code=404, detail=f"Section {section_name} not found")
    
    return HTMLResponse(content=html)


@router.get("/{file_id}/assets", response_model=list[FileAssetOut])
async def get_assets_for_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user),
):
    """Retrieve all assets associated with a file.

    Parameters
    ----------
    file_id : int
        The unique identifier of the file whose assets to retrieve.
    db : AsyncSession
        SQLAlchemy async database session dependency.
    user : User
        Current authenticated user dependency.

    Returns
    -------
    list of FileAssetOut
        List of file assets owned by the user for the specified file.

    Notes
    -----
    Requires authentication. Only returns assets owned by the current user.
    Excludes soft-deleted assets.
    """
    result = await db.execute(
        select(FileAsset).where(
            FileAsset.file_id == file_id,
            FileAsset.owner_id == user.id,
            FileAsset.deleted_at.is_(None),
        )
    )
    assets = result.scalars().all()
    return assets

