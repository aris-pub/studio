"""Rate limiting on the public abuse surface: /login, /register, /render.

The limiter state is app-global and in-memory. The autouse ``reset_rate_limiter``
fixture in conftest.py clears it between tests, so each test here starts from a
clean per-IP bucket. Distinct client IPs are simulated with the ``Fly-Client-IP``
header, which the limiter's key function reads first (see get_real_client_ip).

These tests assert immediate over-limit behavior (the (N+1)th request is blocked);
there is no waiting on window resets.
"""

from conftest import TestDataFactory
from httpx import AsyncClient
from starlette.requests import Request

from aris.rate_limiting import (
    LOGIN_RATE_LIMIT,
    PUBLIC_RENDER_RATE_LIMIT,
    RATE_LIMIT_MESSAGE,
    REGISTER_RATE_LIMIT,
    get_real_client_ip,
)


def _limit_count(limit_str: str) -> int:
    """The N in an 'N/minute' limit string."""
    return int(limit_str.split("/")[0])


LOGIN_LIMIT = _limit_count(LOGIN_RATE_LIMIT)
REGISTER_LIMIT = _limit_count(REGISTER_RATE_LIMIT)
RENDER_LIMIT = _limit_count(PUBLIC_RENDER_RATE_LIMIT)

BAD_LOGIN = {"email": "nobody@example.com", "password": "wrong-password"}


def _ip(addr: str) -> dict:
    """Headers that make the limiter treat the request as coming from ``addr``."""
    return {"Fly-Client-IP": addr}


def _make_request(headers: dict | None = None, client: tuple | None = None) -> Request:
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw_headers, "client": client})


# --------------------------------------------------------------------------- #
# Key function: keying must use the real client IP, not Fly's proxy, or every
# caller shares one bucket.
# --------------------------------------------------------------------------- #


def test_key_function_prefers_fly_client_ip():
    req = _make_request(
        headers={"Fly-Client-IP": "1.2.3.4", "X-Forwarded-For": "9.9.9.9"},
        client=("10.0.0.1", 5000),
    )
    assert get_real_client_ip(req) == "1.2.3.4"


def test_key_function_falls_back_to_forwarded_for():
    req = _make_request(
        headers={"X-Forwarded-For": "5.6.7.8, 9.9.9.9"}, client=("10.0.0.1", 5000)
    )
    assert get_real_client_ip(req) == "5.6.7.8"


def test_key_function_falls_back_to_socket_peer():
    req = _make_request(client=("10.0.0.1", 5000))
    assert get_real_client_ip(req) == "10.0.0.1"


def test_key_function_distinct_ips_yield_distinct_keys():
    a = _make_request(headers={"Fly-Client-IP": "1.1.1.1"})
    b = _make_request(headers={"Fly-Client-IP": "2.2.2.2"})
    assert get_real_client_ip(a) != get_real_client_ip(b)


# --------------------------------------------------------------------------- #
# /login: credential stuffing surface. Every request counts toward the limit,
# even the failed (400) ones, which is the point.
# --------------------------------------------------------------------------- #


async def test_login_allows_requests_under_limit(client: AsyncClient):
    for _ in range(LOGIN_LIMIT):
        resp = await client.post("/login", json=BAD_LOGIN, headers=_ip("203.0.113.1"))
        assert resp.status_code == 400, resp.text


async def test_login_blocks_over_limit_with_clean_message(client: AsyncClient):
    ip = _ip("203.0.113.2")
    for _ in range(LOGIN_LIMIT):
        resp = await client.post("/login", json=BAD_LOGIN, headers=ip)
        assert resp.status_code != 429

    blocked = await client.post("/login", json=BAD_LOGIN, headers=ip)
    assert blocked.status_code == 429
    assert blocked.json() == {"detail": RATE_LIMIT_MESSAGE}


async def test_login_buckets_are_per_ip(client: AsyncClient):
    attacker = _ip("203.0.113.3")
    for _ in range(LOGIN_LIMIT):
        await client.post("/login", json=BAD_LOGIN, headers=attacker)
    blocked = await client.post("/login", json=BAD_LOGIN, headers=attacker)
    assert blocked.status_code == 429

    # A different IP is unaffected: independent bucket, so still just a 400.
    other = await client.post("/login", json=BAD_LOGIN, headers=_ip("203.0.113.4"))
    assert other.status_code == 400, other.text


# --------------------------------------------------------------------------- #
# /register: spam signups. Reusing one email keeps the test cheap (one real
# insert, then 409s), and every attempt still consumes quota.
# --------------------------------------------------------------------------- #


async def test_register_blocks_over_limit_with_clean_message(client: AsyncClient):
    ip = _ip("203.0.113.5")
    payload = TestDataFactory.user_registration_data()
    for _ in range(REGISTER_LIMIT):
        resp = await client.post("/register", json=payload, headers=ip)
        assert resp.status_code != 429, resp.text

    blocked = await client.post("/register", json=payload, headers=ip)
    assert blocked.status_code == 429
    assert blocked.json() == {"detail": RATE_LIMIT_MESSAGE}


# --------------------------------------------------------------------------- #
# /render: unauthenticated and expensive. The real render is patched out so the
# test drives the limit, not the RSM engine.
# --------------------------------------------------------------------------- #


async def test_render_blocks_over_limit_with_clean_message(client: AsyncClient, monkeypatch):
    async def fast_render(src: str) -> str:
        return "<div>ok</div>"

    monkeypatch.setattr("aris.crud.render", fast_render)

    ip = _ip("203.0.113.6")
    payload = {"source": "hello", "format": "html"}
    for _ in range(RENDER_LIMIT):
        resp = await client.post("/render", json=payload, headers=ip)
        assert resp.status_code == 200, resp.text

    blocked = await client.post("/render", json=payload, headers=ip)
    assert blocked.status_code == 429
    assert blocked.json() == {"detail": RATE_LIMIT_MESSAGE}


async def test_render_buckets_are_per_ip(client: AsyncClient, monkeypatch):
    async def fast_render(src: str) -> str:
        return "<div>ok</div>"

    monkeypatch.setattr("aris.crud.render", fast_render)

    payload = {"source": "hello", "format": "html"}
    exhausted = _ip("203.0.113.7")
    for _ in range(RENDER_LIMIT):
        await client.post("/render", json=payload, headers=exhausted)
    blocked = await client.post("/render", json=payload, headers=exhausted)
    assert blocked.status_code == 429

    other = await client.post("/render", json=payload, headers=_ip("203.0.113.8"))
    assert other.status_code == 200, other.text
