"""Test JWT management."""

from datetime import UTC, datetime, timedelta

import pytest
from freezegun import freeze_time
from jose import jwt

from aris.config import settings
from aris.jwt import (
    LSP_TOKEN_EXPIRE_SECONDS,
    create_access_token,
    create_lsp_token,
    create_refresh_token,
    decode_token,
)


@pytest.fixture
def test_payload():
    return {"sub": "123", "role": "user"}


def test_create_access_token_contains_expected_claims(test_payload):
    token = create_access_token(test_payload)
    decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    assert decoded["sub"] == test_payload["sub"]
    assert decoded["role"] == test_payload["role"]
    assert "exp" in decoded
    assert "type" not in decoded  # access tokens should not include "type"


def test_create_refresh_token_contains_expected_claims(test_payload):
    token = create_refresh_token(test_payload)
    decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    assert decoded["sub"] == test_payload["sub"]
    assert decoded["role"] == test_payload["role"]
    assert decoded["type"] == "refresh"
    assert "exp" in decoded


@freeze_time("2025-01-01 12:00:00")
def test_access_token_expiration_uses_access_config(test_payload):
    token = create_access_token(test_payload)
    decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    expected_exp = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    actual_exp = datetime.fromtimestamp(decoded["exp"], tz=UTC)

    assert actual_exp == expected_exp


@freeze_time("2025-01-01 12:00:00")
def test_refresh_token_expiration_uses_refresh_config(test_payload):
    token = create_refresh_token(test_payload)
    decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    expected_exp = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC) + timedelta(
        minutes=settings.JWT_REFRESH_TOKEN_EXPIRE_MINUTES
    )
    actual_exp = datetime.fromtimestamp(decoded["exp"], tz=UTC)

    assert actual_exp == expected_exp


@freeze_time("2025-01-01 12:00:00")
def test_refresh_token_lives_longer_than_access_token(test_payload):
    access = create_access_token(test_payload)
    refresh = create_refresh_token(test_payload)
    access_decoded = jwt.decode(access, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    refresh_decoded = jwt.decode(refresh, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    assert refresh_decoded["exp"] > access_decoded["exp"]


def test_create_lsp_token_has_lsp_scope_and_subject():
    token = create_lsp_token({"sub": "42"})
    decoded = decode_token(token)

    assert decoded is not None
    assert decoded["scope"] == "lsp"
    assert decoded["sub"] == "42"
    assert decoded.get("type") != "refresh"


@freeze_time("2025-01-01 12:00:00")
def test_create_lsp_token_uses_short_ttl():
    token = create_lsp_token({"sub": "42"})
    decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    expected_exp = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC) + timedelta(
        seconds=LSP_TOKEN_EXPIRE_SECONDS
    )
    actual_exp = datetime.fromtimestamp(decoded["exp"], tz=UTC)

    assert actual_exp == expected_exp


@freeze_time("2025-01-01 12:00:00")
def test_lsp_token_lives_far_shorter_than_access_token():
    lsp = create_lsp_token({"sub": "42"})
    access = create_access_token({"sub": "42"})
    lsp_decoded = jwt.decode(lsp, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    access_decoded = jwt.decode(access, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    assert lsp_decoded["exp"] < access_decoded["exp"]


@freeze_time("2025-01-01 12:00:00")
def test_lsp_token_expires_and_decode_returns_none():
    with freeze_time("2025-01-01 12:00:00"):
        token = create_lsp_token({"sub": "42"})

    with freeze_time("2025-01-01 12:00:00") as frozen:
        frozen.tick(delta=timedelta(seconds=LSP_TOKEN_EXPIRE_SECONDS + 1))
        result = decode_token(token)

    assert result is None


def test_decode_token_valid_token(test_payload):
    token = create_access_token(test_payload)
    decoded = decode_token(token)

    assert decoded["sub"] == test_payload["sub"]
    assert "exp" in decoded


def test_decode_token_invalid_token_returns_none():
    # tampered token (last char removed)
    bad_token = create_access_token({"sub": "123"})[:-1]
    result = decode_token(bad_token)

    assert result is None


@freeze_time("2025-01-01 12:00:00")
def test_decode_token_expired_returns_none(test_payload):
    with freeze_time("2025-01-01 12:00:00"):
        token = create_access_token(test_payload)

    # fast forward past expiration
    minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    with freeze_time("2025-01-01 12:00:00") as frozen:
        frozen.tick(delta=timedelta(minutes=minutes + 1))
        result = decode_token(token)

    assert result is None
