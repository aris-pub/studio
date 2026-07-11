"""Auth and concurrency-cap tests for the LSP WebSocket (std-5smn).

/ws/lsp spawns a node subprocess per connection, so it must prove the caller is
logged in and cap concurrent sessions before spending anything. The access JWT is
passed as a WebSocket subprotocol ["lsp", <token>] so it never lands in a URL or
access log, and it is checked during the handshake before the socket is accepted.
"""

import asyncio
import time

from fastapi import WebSocketDisconnect
from jose import jwt as jose_jwt

from aris import jwt as jwt_helpers
from aris.config import settings
from aris.routes import lsp as lsp_module
from aris.routes.lsp import (
    LSPProxy,
    _extract_lsp_user_id,
    _release_lsp_slot,
    _try_acquire_lsp_slot,
    lsp_websocket,
)


class _FakeWS:
    def __init__(self, subprotocols):
        self.scope = {"subprotocols": subprotocols}


class _RecordingWS:
    """A minimal WebSocket stand-in that records accept/close instead of using a socket."""

    def __init__(self, subprotocols):
        self.scope = {"subprotocols": subprotocols}
        self.accepted_subprotocol = "UNSET"
        self.closed_code = None

    async def accept(self, subprotocol=None):
        self.accepted_subprotocol = subprotocol

    async def close(self, code=1000):
        self.closed_code = code


def _access(user_id: int) -> str:
    return jwt_helpers.create_access_token({"sub": str(user_id)})


class TestExtractLspUserId:
    def test_valid_access_token_returns_user_id(self):
        assert _extract_lsp_user_id(_FakeWS(["lsp", _access(7)])) == 7

    def test_missing_subprotocols_returns_none(self):
        assert _extract_lsp_user_id(_FakeWS([])) is None
        assert _extract_lsp_user_id(_FakeWS(None)) is None

    def test_marker_without_token_returns_none(self):
        assert _extract_lsp_user_id(_FakeWS(["lsp"])) is None

    def test_wrong_marker_returns_none(self):
        assert _extract_lsp_user_id(_FakeWS(["notlsp", _access(1)])) is None

    def test_garbage_token_returns_none(self):
        assert _extract_lsp_user_id(_FakeWS(["lsp", "not-a-jwt"])) is None

    def test_refresh_token_rejected(self):
        refresh = jwt_helpers.create_refresh_token({"sub": "5"})
        assert _extract_lsp_user_id(_FakeWS(["lsp", refresh])) is None

    def test_expired_token_rejected(self):
        payload = {"sub": "5", "exp": int(time.time()) - 10}
        tok = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        assert _extract_lsp_user_id(_FakeWS(["lsp", tok])) is None

    def test_token_without_sub_rejected(self):
        payload = {"exp": int(time.time()) + 60}
        tok = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        assert _extract_lsp_user_id(_FakeWS(["lsp", tok])) is None


class TestLspConcurrencyCaps:
    def setup_method(self):
        lsp_module._active_global = 0
        lsp_module._active_per_user.clear()

    def teardown_method(self):
        lsp_module._active_global = 0
        lsp_module._active_per_user.clear()

    def test_per_user_cap_rejects_excess(self, monkeypatch):
        monkeypatch.setattr(settings, "LSP_MAX_SESSIONS_PER_USER", 2)
        monkeypatch.setattr(settings, "LSP_MAX_CONCURRENT_SESSIONS", 100)
        assert _try_acquire_lsp_slot(1) is True
        assert _try_acquire_lsp_slot(1) is True
        assert _try_acquire_lsp_slot(1) is False  # third for same user
        assert _try_acquire_lsp_slot(2) is True   # a different user is unaffected

    def test_global_cap_rejects_excess(self, monkeypatch):
        monkeypatch.setattr(settings, "LSP_MAX_SESSIONS_PER_USER", 100)
        monkeypatch.setattr(settings, "LSP_MAX_CONCURRENT_SESSIONS", 2)
        assert _try_acquire_lsp_slot(1) is True
        assert _try_acquire_lsp_slot(2) is True
        assert _try_acquire_lsp_slot(3) is False  # global ceiling

    def test_release_frees_a_slot(self, monkeypatch):
        monkeypatch.setattr(settings, "LSP_MAX_SESSIONS_PER_USER", 1)
        monkeypatch.setattr(settings, "LSP_MAX_CONCURRENT_SESSIONS", 100)
        assert _try_acquire_lsp_slot(1) is True
        assert _try_acquire_lsp_slot(1) is False
        _release_lsp_slot(1)
        assert _try_acquire_lsp_slot(1) is True

    def test_release_is_floored_and_cleans_up(self, monkeypatch):
        monkeypatch.setattr(settings, "LSP_MAX_SESSIONS_PER_USER", 5)
        monkeypatch.setattr(settings, "LSP_MAX_CONCURRENT_SESSIONS", 5)
        _release_lsp_slot(99)  # release with nothing held must not go negative
        assert lsp_module._active_global == 0
        assert 99 not in lsp_module._active_per_user


class TestLspEndpointWiring:
    """The endpoint must never spawn a subprocess without auth + a free slot."""

    def setup_method(self):
        lsp_module._active_global = 0
        lsp_module._active_per_user.clear()

    def teardown_method(self):
        lsp_module._active_global = 0
        lsp_module._active_per_user.clear()

    def _no_spawn_proxy(self, monkeypatch):
        started = {"n": 0}

        async def fake_start(_self):
            started["n"] += 1

        async def fake_cleanup(_self):
            pass

        monkeypatch.setattr(LSPProxy, "start", fake_start)
        monkeypatch.setattr(LSPProxy, "cleanup", fake_cleanup)
        return started

    async def test_unauthenticated_rejected_before_accept(self, monkeypatch):
        started = self._no_spawn_proxy(monkeypatch)
        ws = _RecordingWS([])  # no token offered
        await lsp_websocket(ws)
        assert ws.closed_code == 1008
        assert ws.accepted_subprotocol == "UNSET"  # never accepted
        assert started["n"] == 0  # never reached the spawn path

    async def test_cap_reached_rejected_with_1013_no_spawn(self, monkeypatch):
        started = self._no_spawn_proxy(monkeypatch)
        monkeypatch.setattr(settings, "LSP_MAX_CONCURRENT_SESSIONS", 0)
        ws = _RecordingWS(["lsp", _access(1)])
        await lsp_websocket(ws)
        assert ws.closed_code == 1013
        assert started["n"] == 0

    async def test_authenticated_accepts_spawns_and_releases(self, monkeypatch):
        started = self._no_spawn_proxy(monkeypatch)
        ws = _RecordingWS(["lsp", _access(42)])
        await lsp_websocket(ws)
        assert ws.accepted_subprotocol == "lsp"
        assert started["n"] == 1
        # slot released after the session ends
        assert lsp_module._active_global == 0
        assert 42 not in lsp_module._active_per_user


class TestLspProxyReleasesOnDisconnect:
    """start() must return when the client disconnects even if the LSP process
    stdout blocks, so the caller's finally releases the session slot. Without the
    fix (plain asyncio.gather) start() hangs on the blocking stdout read and the
    slot leaks until the per-user cap is hit (std-5smn)."""

    async def test_start_returns_on_disconnect_despite_blocking_stdout(self, monkeypatch):
        class _WS:
            scope = {"subprotocols": ["lsp"]}

            async def receive_text(self):
                raise WebSocketDisconnect()

            async def send_text(self, _msg):
                pass

            async def close(self, code=1000):
                pass

        class _Blocking:
            async def read(self, _n):
                await asyncio.sleep(3600)

            async def readline(self):
                await asyncio.sleep(3600)

        class _Stdin:
            def write(self, _b):
                pass

            async def drain(self):
                pass

        class _Proc:
            pid = 4242
            returncode = None
            stdin = _Stdin()
            stdout = _Blocking()
            stderr = _Blocking()

            def terminate(self):
                pass

            def kill(self):
                pass

            async def wait(self):
                return 0

        async def _fake_exec(*_args, **_kwargs):
            return _Proc()

        monkeypatch.setattr(lsp_module.os.path, "exists", lambda _p: True)
        monkeypatch.setattr(lsp_module.asyncio, "create_subprocess_exec", _fake_exec)

        proxy = LSPProxy(_WS())
        # Would hang here (and TimeoutError) without the FIRST_COMPLETED fix.
        await asyncio.wait_for(proxy.start(), timeout=5)
