"""Internal infrastructure endpoints — NOT for end-user clients.

These endpoints are called by trusted infrastructure (the multi-player
WebSocket server) running adjacent to the backend. They are authenticated
via a shared secret in the ``X-Internal-Secret`` header rather than user JWTs.

Security boundary: never expose ``/internal/*`` to the public internet. In
local dev / Docker, both the backend and multi-player run in the same
container so the route stays loopback-bound; in PROD/STAGING they should
be on a private network behind the load balancer.
"""

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import get_db, get_file_service
from ..collaboration import get_collaboration_manager
from ..config import settings
from ..logging_config import get_logger
from ..services.file_service import InMemoryFileService


logger = get_logger(__name__)


router = APIRouter(prefix="/internal", tags=["internal"])


async def verify_internal_secret(
    x_internal_secret: str | None = Header(default=None, alias="X-Internal-Secret"),
) -> None:
    """Reject requests that don't present the shared secret.

    Constant-time comparison prevents timing oracles. Returns 401 (not 403) so
    the failure mode is identical regardless of whether the header is missing,
    empty, or wrong — no leakage of "header present but wrong" vs "header missing".
    """
    if x_internal_secret is None or not hmac.compare_digest(
        x_internal_secret, settings.INTERNAL_SHARED_SECRET
    ):
        raise HTTPException(status_code=401, detail="Invalid internal secret")


class CollabStartRequest(BaseModel):
    file_id: int


@router.post("/collab/start", dependencies=[Depends(verify_internal_secret)])
async def internal_collab_start(
    body: CollabStartRequest,
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Ensure a backend YDocClient is running and in the room for ``file_id``.

    Idempotent: if the client is already running and ready, this is a no-op
    that still awaits the readiness signal so the caller is guaranteed the
    YDocClient is in the room when this returns 200.

    Returns 404 if the file doesn't exist.
    Returns 503 if the YDocClient cannot be brought to readiness within the
    configured timeout (``YJS_READY_TIMEOUT_SECS``, default 10s).
    """
    await file_service.sync_from_database(db)
    doc = await file_service.get_file(body.file_id)
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    manager = get_collaboration_manager()
    ok = await manager.start_client(body.file_id)
    if not ok:
        raise HTTPException(
            status_code=503,
            detail=f"YDocClient for file {body.file_id} did not become ready",
        )
    return {"status": "ok"}
