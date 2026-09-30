"""Collaboration session signals: start, stop, and flush the Y.js client."""


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crud, current_user, get_db
from ..authorization import (
    require_edit,
    require_view,
)
from ..collaboration import get_collaboration_manager, mint_collab_token
from ..deps import UserRead
from ..logging_config import get_logger
from ..models import FileRole


logger = get_logger(__name__)


router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(current_user)])


@router.post("/{file_id}/collab/start")
async def collab_start(
    file_id: int,
    user: UserRead = Depends(current_user),
    user_role: FileRole = Depends(require_view),
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
    doc = await crud.get_file(file_id, db)
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
    await get_collaboration_manager().flush(file_id)
    return {"status": "ok"}


