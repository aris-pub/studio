"""Importing a file from an uploaded document (Markdown, LaTeX, docx)."""


from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crud, current_user, get_db
from ..deps import UserRead
from ..logging_config import get_logger


logger = get_logger(__name__)


router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(current_user)])


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

    # crud.create_file also creates the OWNER permission for the creator.
    result = await crud.create_file(
        source=rsm_source,
        owner_id=user.id,
        title=title,
        abstract="",
        db=db,
    )

    return {"id": result.id}


