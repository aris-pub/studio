import pytest
from pydantic import ValidationError

from aris.config import Settings


def test_settings_defaults_and_env_override(monkeypatch):
    env = {
        "DB_URL_LOCAL": "sqlite:///:memory:",
        "DB_URL_PROD": "postgresql://user:pass@host/db",
        "ALEMBIC_DB_URL_LOCAL": "sqlite:///:memory:",
        "ALEMBIC_DB_URL_PROD": "postgresql://user:pass@host/db",
        "JWT_SECRET_KEY": "secret",
        "TEST_USER_EMAIL": "test@example.com",
        "TEST_USER_PASSWORD": "testpassword123",
    }
    for key, val in env.items():
        monkeypatch.setenv(key, val)
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("JWT_ALGORITHM", raising=False)
    monkeypatch.delenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", raising=False)
    monkeypatch.delenv("JWT_REFRESH_TOKEN_EXPIRE_MINUTES", raising=False)

    s = Settings(_env_file=None)
    assert s.DB_URL_LOCAL == env["DB_URL_LOCAL"]
    assert s.DB_URL_PROD == env["DB_URL_PROD"]
    assert s.ALEMBIC_DB_URL_LOCAL == env["ALEMBIC_DB_URL_LOCAL"]
    assert s.ALEMBIC_DB_URL_PROD == env["ALEMBIC_DB_URL_PROD"]
    assert s.JWT_SECRET_KEY == env["JWT_SECRET_KEY"]
    assert s.ENV == "LOCAL"
    assert s.JWT_ALGORITHM == "HS256"
    assert s.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 120
    assert s.JWT_REFRESH_TOKEN_EXPIRE_MINUTES == 10080


def test_missing_required_env_vars(monkeypatch):
    # Remove all required env vars to trigger validation error
    for key in (
        "DB_URL_LOCAL",
        "DB_URL_PROD",
        "ALEMBIC_DB_URL_LOCAL",
        "ALEMBIC_DB_URL_PROD",
        "JWT_SECRET_KEY",
        "TEST_USER_EMAIL",
        "TEST_USER_PASSWORD",
    ):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
