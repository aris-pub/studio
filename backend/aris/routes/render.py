"""Routes for rendering RSM into HTML."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crud, current_user
from ..deps import get_db


router = APIRouter(prefix="/render", tags=["files"])


class RenderObject(BaseModel):
    source: str = ""
    format: str = "html"


class FileRenderObject(BaseModel):
    source: str = ""
    file_id: int
    format: str = "html"


@router.post("")
async def render(data: RenderObject):
    """Public endpoint for rendering RSM source to HTML or structured format.
    
    This endpoint accepts any RSM source and renders it to HTML or structured format.
    No authentication required. Assets must be referenced by URL or inline.
    
    Parameters
    ----------
    data : RenderObject
        Contains source RSM content and optional format parameter.
        format: "html" returns plain HTML, "structured" returns {head, body, init_script}
    """
    if data.format == "structured":
        # Import rsm here to avoid circular imports
        import rsm
        try:
            structured_content = rsm.make(data.source, handrails=True, structured=True)
            if not isinstance(structured_content, dict):
                # Fallback if structured format fails
                html = await crud.render(data.source)
                return {"head": "", "body": html, "init_script": ""}
            return structured_content
        except Exception:
            # Fallback to regular HTML on error
            html = await crud.render(data.source)
            return {"head": "", "body": html, "init_script": ""}
    else:
        return await crud.render(data.source)


@router.post("/private", dependencies=[Depends(current_user)])
async def render_private(data: FileRenderObject, db: AsyncSession = Depends(get_db), user=Depends(current_user)):
    """Private endpoint for rendering RSM with database assets.
    
    This endpoint renders RSM source for a specific file, with access to
    the file's uploaded assets stored in the database.
    """
    return await crud.render_with_assets(data.source, data.file_id, db, user.id)
