#!/usr/bin/env python3
"""End-to-end smoke test for preview deployments.

Verifies the multi-player WebSocket auth handshake works against a deployed
backend. Catches deploy-config drift like:

  - INTERNAL_SHARED_SECRET not forwarded to the multi-player process
    (every WS connection 4401s; editor goes offline).
  - port 1234 missing a TLS handler in fly.toml (wss:// handshake fails
    before auth even runs).
  - /collab/start route returning a token the multi-player can't verify
    (secret mismatch between backend and multi-player processes).

Usage:
    python smoke-test-preview.py <backend-url>

    e.g.  python smoke-test-preview.py https://aris-backend-pr-405.fly.dev

Exits 0 if the round-trip works, non-zero with a diagnostic message
otherwise. Designed to run as the final CI step after a preview deploy.
"""

from __future__ import annotations

import asyncio
import json
import secrets
import sys
from urllib.parse import urlparse

import httpx
import websockets


async def run(backend_url: str, env: str = "prod") -> int:
    parsed = urlparse(backend_url)
    if parsed.scheme != "https":
        print(f"FAIL: backend_url must be https://, got {backend_url!r}")
        return 2
    ws_url_base = f"wss://{parsed.netloc}:1234"

    suffix = secrets.token_hex(4)
    email = f"smoke-{suffix}@aris.pub"
    password = f"pw{secrets.token_hex(12)}"

    async with httpx.AsyncClient(base_url=backend_url, timeout=30.0) as client:
        print(f"[register] {email}")
        r = await client.post(
            "/register",
            json={
                "email": email,
                "name": "Smoke",
                "initials": "SM",
                "password": password,
            },
        )
        if r.status_code != 200:
            print(f"FAIL: /register returned {r.status_code}: {r.text[:200]}")
            return 1
        access_token = r.json()["access_token"]

        print("[create file]")
        r = await client.post(
            "/files",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "title": "smoke",
                "abstract": "",
                "source": ":manuscript:\n\n  smoke\n\n::",
            },
        )
        if r.status_code != 200:
            print(f"FAIL: POST /files returned {r.status_code}: {r.text[:200]}")
            return 1
        file_id = r.json()["id"]

        print("[collab/start]")
        r = await client.post(
            f"/files/{file_id}/collab/start",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if r.status_code != 200:
            print(f"FAIL: /collab/start returned {r.status_code}: {r.text[:200]}")
            return 1
        body = r.json()
        token = body.get("token")
        if not isinstance(token, str) or not token:
            print(f"FAIL: /collab/start did not return a token: {body!r}")
            return 1

    room = f"file-{file_id}-{env}"
    ws_url = f"{ws_url_base}/{room}"
    print(f"[ws connect] {ws_url}")
    try:
        async with websockets.connect(
            ws_url, open_timeout=10, close_timeout=5
        ) as ws:
            await ws.send(json.dumps({"type": "auth", "token": token}))
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            try:
                payload = json.loads(
                    raw if isinstance(raw, str) else raw.decode("utf-8")
                )
            except json.JSONDecodeError:
                print(f"FAIL: first WS frame was not JSON: {raw[:120]!r}")
                return 1
            if payload.get("type") != "auth_ok":
                print(f"FAIL: expected auth_ok, got {payload!r}")
                return 1
            print("PASS: auth handshake completed")
            return 0
    except websockets.exceptions.ConnectionClosed as e:
        print(f"FAIL: WS closed code={e.code} reason={e.reason!r}")
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {type(e).__name__}: {e}")
        return 1


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: smoke-test-preview.py <backend-url>")
        return 2
    return asyncio.run(run(sys.argv[1]))


if __name__ == "__main__":
    raise SystemExit(main())
