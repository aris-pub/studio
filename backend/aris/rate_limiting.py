"""Application-wide rate limiting for the public abuse surface.

Protects the endpoints that are cheap to hammer and expensive or sensitive to
serve: login (credential stuffing), register (spam signups), and the public
render endpoint (cost/DoS on unauthenticated work). Uses slowapi over an
in-memory store.

In-memory storage is correct for this deployment: production runs on a single
auto-stop machine, so there is no second process to share a bucket with. A
shared store (Redis) would only matter with horizontal scale, which we do not
have.

Behind Fly's proxy ``request.client.host`` is the proxy address, identical for
every caller, so keying on it would put all users in one bucket. The limiter
keys on the real client IP instead (see ``get_real_client_ip``).
"""

import os

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded


# Per-IP limits. Kept as named constants so they are easy to find and tune.
LOGIN_RATE_LIMIT = "10/minute"
REGISTER_RATE_LIMIT = "5/minute"
PUBLIC_RENDER_RATE_LIMIT = "30/minute"

RATE_LIMIT_MESSAGE = "Too many requests. Please slow down and try again shortly."


def _rate_limiting_enabled() -> bool:
    """On by default; opt-out only where per-IP keying is meaningless.

    In the Docker compose stack (local dev and CI e2e) every browser reaches the
    backend from a single source IP, so a per-IP limiter would throttle the whole
    run and the compose env sets RATE_LIMITING_ENABLED=false. Production behind
    Fly does not set it, so limiting stays on there.
    """
    return os.getenv("RATE_LIMITING_ENABLED", "true").strip().lower() not in (
        "false",
        "0",
        "no",
    )


def get_real_client_ip(request: Request) -> str:
    """Return the real client IP to key the limiter on.

    Fly terminates TLS at its proxy, so ``request.client.host`` is the proxy and
    is the same for everyone. Fly sets ``Fly-Client-IP`` to the true client
    address; fall back to the first hop of ``X-Forwarded-For``, then the socket
    peer. Distinct callers must map to distinct keys or they share one bucket.
    """
    fly_ip = request.headers.get("fly-client-ip")
    if fly_ip:
        return fly_ip.strip()
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


limiter = Limiter(key_func=get_real_client_ip, enabled=_rate_limiting_enabled())


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Return a clean 429 JSON body, keeping slowapi's rate-limit headers.

    CORS headers are added by CORSMiddleware, which wraps the whole app, so this
    response still carries them on the way back out to the browser.
    """
    response = JSONResponse(status_code=429, content={"detail": RATE_LIMIT_MESSAGE})
    # app.state.limiter is dynamically typed, so annotate the injected result to
    # keep mypy's no-any-return happy.
    injected: Response = request.app.state.limiter._inject_headers(
        response, request.state.view_rate_limit
    )
    return injected
