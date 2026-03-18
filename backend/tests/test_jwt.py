"""Test JWT management."""

from datetime import UTC, datetime, timedelta

import pytest
from freezegun import freeze_time
from jose import jwt

from aris.config import settings
from aris.jwt import create_access_token, create_refresh_token, decode_token


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
