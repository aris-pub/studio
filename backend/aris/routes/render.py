"""Routes for rendering RSM into HTML."""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crud, current_user
from ..authorization import PermissionLevel, has_permission
from ..deps import get_db
from ..exceptions import forbidden_exception
from ..logging_config import get_logger
from ..rate_limiting import PUBLIC_RENDER_RATE_LIMIT, limiter


logger = get_logger(__name__)


router = APIRouter(prefix="/render", tags=["files"])


class RenderObject(BaseModel):
    source: str = ""
    format: str = "html"


class FileRenderObject(BaseModel):
    source: str = ""
    file_id: int
    format: str = "html"


@router.post("")
@limiter.limit(PUBLIC_RENDER_RATE_LIMIT)
async def render(request: Request, data: RenderObject):
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
            structured_content = rsm.build(data.source, handrails=True, structured=True, theme_toggle=False)
            if not isinstance(structured_content, dict):
                # Fallback if structured format fails
                html = await crud.render(data.source)
                return {"head": "", "body": html, "init_script": ""}
            return structured_content
        except Exception:
            logger.exception("Structured render failed, falling back to HTML")
            html = await crud.render(data.source)
            return {"head": "", "body": html, "init_script": ""}
    else:
        return await crud.render(data.source)


@router.post("/private", dependencies=[Depends(current_user)])
async def render_private(data: FileRenderObject, db: AsyncSession = Depends(get_db), user=Depends(current_user)):
    """Private endpoint for rendering RSM with database assets.

    Renders the request body's RSM source for a specific file with access to
    uploaded assets. This endpoint is render-only: it does NOT write source to
    the database. The Y.js collaboration loop is the sole writer of files.source.

    ``file_id`` arrives in the body, so the ``require_view`` path dependency
    cannot be used; the VIEW check is enforced inline. Without it, any
    authenticated caller could pass another user's ``file_id`` and receive that
    file's private assets embedded in the rendered HTML.
    """
    if not await has_permission(data.file_id, user.id, PermissionLevel.VIEW, db):
        raise forbidden_exception("You do not have access to this file")
    return await crud.render_with_assets(data.source, data.file_id, db, user.id)
