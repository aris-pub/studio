"""Auth tokens for the Y.js multi-player WebSocket server.

The multi-player WebSocket service has no DB access and no user JWTs to
inspect — anyone who could reach the WS port could previously enumerate
rooms (e.g. ``file-1-prod``) and read/inject Y.js updates. This module
mints short-lived tokens that the backend hands to the frontend/CLI/agent
on ``/collab/start``; the multi-player server verifies them on the first
WebSocket frame and only then proceeds with the Y.js handshake.

The token is signed with ``INTERNAL_SHARED_SECRET`` — the same secret the
multi-player server already uses to authenticate ``/internal/collab/start``
calls back to the backend — so it can be verified without sharing a
database or the user-facing ``JWT_SECRET_KEY``.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from ..config import settings
from ..models.models import FileRole


COLLAB_TOKEN_TTL_SECS: int = 300
COLLAB_TOKEN_ALGORITHM: str = "HS256"

VALID_ROLES: frozenset[str] = frozenset(
    {role.value for role in FileRole} | {"backend"}
)


def mint_collab_token(
    user_id: int | str,
    file_id: int,
    role: str,
    ttl_secs: int = COLLAB_TOKEN_TTL_SECS,
) -> str:
    """Mint a short-lived JWT for the multi-player WebSocket connection.

    Parameters
    ----------
    user_id : int | str
        Subject of the token. For role='backend', a stable string like
        "backend" is acceptable (no associated user).
    file_id : int
        The numeric file id; the multi-player server checks this against
        the ``file-{id}-{env}`` docName the client connected to.
    role : str
        One of ``OWNER`` / ``EDITOR`` / ``COMMENTER`` (matching
        ``FileRole``) or ``backend``. The multi-player server passes this
        through; downstream services may use it.
    ttl_secs : int
        Token lifetime in seconds. Default 300s; short by design so a
        stolen token expires before it's interesting.
    """
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role for collab token: {role!r}")

    now = datetime.now(UTC)
    expire = now + timedelta(seconds=ttl_secs)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "file_id": int(file_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(
        payload, settings.INTERNAL_SHARED_SECRET, algorithm=COLLAB_TOKEN_ALGORITHM
    )


def decode_collab_token(token: str) -> dict[str, Any] | None:
    """Decode and verify a collab token. Returns None on any failure."""
    try:
        return jwt.decode(
            token,
            settings.INTERNAL_SHARED_SECRET,
            algorithms=[COLLAB_TOKEN_ALGORITHM],
        )
    except JWTError:
        return None
