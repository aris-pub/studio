"""Tests for the short-lived JWT minted for the multi-player WebSocket.

The multi-player WS server previously had no authentication — anyone who
could reach the port could enumerate rooms and inject Y.js updates. The
backend now mints a short-lived token, scoped to a single file, that the
multi-player verifies as the first WS frame.
"""

import time
from datetime import datetime, timezone

import pytest

from aris.collaboration.auth import (
    COLLAB_TOKEN_TTL_SECS,
    decode_collab_token,
    mint_collab_token,
)


def test_mint_token_roundtrips():
    token = mint_collab_token(user_id=42, file_id=7, role="EDITOR")
    payload = decode_collab_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["file_id"] == 7
    assert payload["role"] == "EDITOR"
    assert "iat" in payload
    assert "exp" in payload


def test_default_ttl_is_five_minutes():
    before = int(datetime.now(timezone.utc).timestamp())
    token = mint_collab_token(user_id=1, file_id=1, role="OWNER")
    after = int(datetime.now(timezone.utc).timestamp())
    payload = decode_collab_token(token)
    assert payload is not None
    expected_exp_low = before + COLLAB_TOKEN_TTL_SECS
    expected_exp_high = after + COLLAB_TOKEN_TTL_SECS
    assert expected_exp_low <= payload["exp"] <= expected_exp_high


def test_expired_token_does_not_verify():
    # ttl=-1 forces an immediate-past exp
    token = mint_collab_token(user_id=1, file_id=1, role="OWNER", ttl_secs=-1)
    # Sleep a moment to clear any clock-skew leniency
    time.sleep(0.1)
    assert decode_collab_token(token) is None


def test_token_signed_with_wrong_secret_does_not_verify(monkeypatch):
    token = mint_collab_token(user_id=1, file_id=1, role="OWNER")
    # Now mutate the settings secret and try to decode
    from aris.collaboration import auth as auth_mod
    from aris.config import settings

    real = settings.INTERNAL_SHARED_SECRET
    monkeypatch.setattr(settings, "INTERNAL_SHARED_SECRET", "other-secret")
    try:
        assert auth_mod.decode_collab_token(token) is None
    finally:
        monkeypatch.setattr(settings, "INTERNAL_SHARED_SECRET", real)


def test_garbled_token_returns_none():
    assert decode_collab_token("not.a.token") is None
    assert decode_collab_token("") is None


def test_rejects_invalid_role():
    with pytest.raises(ValueError):
        mint_collab_token(user_id=1, file_id=1, role="GOD")


def test_accepts_backend_role():
    token = mint_collab_token(user_id="backend", file_id=99, role="backend")
    payload = decode_collab_token(token)
    assert payload is not None
    assert payload["role"] == "backend"


def test_accepts_all_file_roles():
    for role in ("OWNER", "EDITOR", "COMMENTER"):
        token = mint_collab_token(user_id=1, file_id=1, role=role)
        payload = decode_collab_token(token)
        assert payload is not None
        assert payload["role"] == role
