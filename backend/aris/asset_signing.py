"""HMAC-signed, cache-stable tokens for the public raw-asset endpoint (std-b4v9, std-do5t).

Rendered-manuscript images load in plain browser <img> tags, which cannot send the
app's bearer token. So instead of a session check, the backend, right after it has
already confirmed the caller may view a file, signs each asset URL with an HMAC and
the public raw-asset endpoint verifies that signature.

The signed query is `v={content_version}&exp={quantized}&sig={hmac}`:

- ``v`` is a keyed, per-file content identifier (an HMAC over file_id, filename and
  the stored content hash). It changes if and only if the bytes change, so an
  unchanged image keeps the same URL and hits the browser cache, while a changed
  image busts it. It is keyed rather than a raw content hash so it is not a
  precomputable global fingerprint, and it binds file_id and filename so the same
  bytes in two documents do not correlate.
- ``exp`` is quantized to a coarse step (``issue = now // STEP * STEP; exp = issue +
  TTL``). It is constant within a step window, so the whole URL is byte-identical
  across a debounced burst of renders and the browser stops refetching every image
  on every recompile. It still carries a bounded expiry (validity is between TTL -
  STEP and TTL).
- ``sig`` binds file_id, filename, v and exp. Verification is a pure HMAC recompute
  over the values supplied in the URL, done before any DB lookup, so a caller
  without a valid signature cannot use the 200-vs-404 response as an existence
  oracle, and cannot forge a ``v`` the renderer never minted.
"""

import base64
import hashlib
import hmac
import time

from aris.config import settings


# TTL is the leak/revocation ceiling: how long a signed URL stays valid. STEP is the
# quantization window, which is both how often the URL rotates (so the cache is
# busted) and the floor of the effective validity (TTL - STEP). STEP must never
# exceed TTL, or a URL could be minted already expired.
ASSET_URL_TTL_SECONDS = 3600
ASSET_URL_STEP_SECONDS = 900


def _secret() -> bytes:
    # Reuse the JWT key so this can ship without a new required env var. Splitting
    # out a dedicated ASSET_SIGNING_SECRET is a tracked follow-up (std-92nr) so asset
    # URLs can be rotated without invalidating everyone's login session.
    return settings.JWT_SECRET_KEY.encode()


def compute_content_hash(content: str, content_encoding: str) -> str:
    """Return the sha256 hex of the asset's decoded bytes.

    Stored on the asset row at write time so URL minting never has to rehash the
    (potentially multi-MB) content on every render. Hashing the decoded bytes makes
    the hash a true content identity, independent of how the row happens to be
    encoded.
    """
    if content_encoding == "base64":
        data = base64.b64decode(content)
    else:
        data = content.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def content_version(file_id: int, filename: str, content_hash: str) -> str:
    """Keyed, per-file content identifier exposed in the URL as ``v``."""
    message = f"{file_id}:{filename}:{content_hash}".encode()
    return hmac.new(_secret(), message, hashlib.sha256).hexdigest()


def asset_etag(file_id: int, filename: str, content_hash: str) -> str:
    """The ETag for an asset's current bytes. Same value the URL carries as ``v``."""
    return content_version(file_id, filename, content_hash)


def _quantized_exp(now: int) -> int:
    issue = (now // ASSET_URL_STEP_SECONDS) * ASSET_URL_STEP_SECONDS
    return issue + ASSET_URL_TTL_SECONDS


def _compute_sig(file_id: int, filename: str, v: str, exp: int) -> str:
    message = f"{file_id}:{filename}:{v}:{exp}".encode()
    return hmac.new(_secret(), message, hashlib.sha256).hexdigest()


def sign_asset_path(
    file_id: int, filename: str, content_hash: str, now: int | None = None
) -> str:
    """Return the ``v=...&exp=...&sig=...`` query string for one asset URL.

    ``now`` is injectable for deterministic tests; production passes None.
    """
    if now is None:
        now = int(time.time())
    v = content_version(file_id, filename, content_hash)
    exp = _quantized_exp(now)
    sig = _compute_sig(file_id, filename, v, exp)
    return f"v={v}&exp={exp}&sig={sig}"


def verify_asset_signature(
    file_id: int, filename: str, v: str, exp: int, sig: str, now: int | None = None
) -> bool:
    """True if ``sig`` matches (file_id, filename, v, exp) and has not expired.

    Verification is a pure HMAC recompute over the URL-supplied values. It does not
    load the asset or compare ``v`` against the current bytes, which is what keeps
    the check ahead of any DB lookup (no existence oracle). ``now`` is injectable
    for deterministic expiry tests; production passes None.
    """
    if now is None:
        now = int(time.time())
    if exp < now:
        return False
    expected = _compute_sig(file_id, filename, v, exp)
    return hmac.compare_digest(expected, sig)
