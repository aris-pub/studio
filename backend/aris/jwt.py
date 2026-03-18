"""JWT management."""

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from .config import settings


def create_access_token(data: dict) -> str:
    """Create a JWT access token with expiration.

    Parameters
    ----------
    data : dict
        Dictionary containing user data to encode in the token.
        Typically includes user ID and other identifying information.

    Returns
    -------
    str
        Encoded JWT access token string.

    Notes
    -----
    The token will expire after the configured JWT_ACCESS_TOKEN_EXPIRE_MINUTES.
    The expiration time is added to the payload as 'exp' claim.
    """
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token with expiration and type marker.

    Parameters
    ----------
    data : dict
        Dictionary containing user data to encode in the token.
        Typically includes user ID and other identifying information.

    Returns
    -------
    str
        Encoded JWT refresh token string.

    Notes
    -----
    The refresh token includes a 'type': 'refresh' claim to distinguish it
    from access tokens. Uses JWT_REFRESH_TOKEN_EXPIRE_MINUTES (default: 7 days).
    """
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT token.

    Parameters
    ----------
    token : str
        The JWT token string to decode.

    Returns
    -------
    dict or None
        Dictionary containing the token payload if valid, None if invalid.

    Notes
    -----
    Returns None on any JWT error (expired, invalid signature, malformed, etc.).
    The caller should handle None return values appropriately.
    """
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
