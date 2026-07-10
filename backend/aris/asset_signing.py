"""HMAC-signed, short-lived tokens for the public raw-asset endpoint (std-b4v9).

Rendered-manuscript images load in plain browser <img> tags, which cannot send
the app's bearer token. So instead of a session check, the backend, right after
it has already confirmed the caller may view a file, signs each asset URL with a
short-lived HMAC bound to (file_id, filename, exp). The public raw-asset endpoint
verifies that signature. Binding the signature to file_id and filename together
stops a token minted for one asset from unlocking another.
"""

import hashlib
import hmac
import time

from aris.config import settings


# Long enough to open a document and scroll through it, short enough to bound the
# damage if a signed URL leaks (query strings can land in proxy logs or a Referer
# header). Renders happen on a debounce, so fresh URLs are minted often anyway.
ASSET_URL_TTL_SECONDS = 3600


def _secret() -> bytes:
    # Reuse the JWT key so this can ship without a new required env var. Splitting
    # out a dedicated ASSET_SIGNING_SECRET is a tracked follow-up so asset URLs can
    # be rotated without invalidating everyone's login session.
    return settings.JWT_SECRET_KEY.encode()


def _compute_sig(file_id: int, filename: str, exp: int) -> str:
    message = f"{file_id}:{filename}:{exp}".encode()
    return hmac.new(_secret(), message, hashlib.sha256).hexdigest()


def sign_asset_path(file_id: int, filename: str, ttl_seconds: int = ASSET_URL_TTL_SECONDS) -> str:
    """Return the ``exp=<ts>&sig=<hmac>`` query string for one asset URL."""
    exp = int(time.time()) + ttl_seconds
    return f"exp={exp}&sig={_compute_sig(file_id, filename, exp)}"


def verify_asset_signature(
    file_id: int, filename: str, exp: int, sig: str, now: int | None = None
) -> bool:
    """True if ``sig`` matches (file_id, filename, exp) and has not expired.

    ``now`` is injectable for deterministic expiry tests; production passes None.
    """
    if now is None:
        now = int(time.time())
    if exp < now:
        return False
    expected = _compute_sig(file_id, filename, exp)
    return hmac.compare_digest(expected, sig)
