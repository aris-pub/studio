"""Backend configuration.

Implemented as a Pydantic model that is then read by FastAPI.

"""

import os
import uuid
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    :param DB_URL_LOCAL: Database URL for local development.
    :param DB_URL_PROD: Database URL for production environment.
    :param ENV: Current environment ('LOCAL', 'PROD', etc.).
    :param JWT_SECRET_KEY: Secret key used to sign JWT tokens.
    :param JWT_ALGORITHM: Algorithm used for JWT encoding (default: HS256).
    :param JWT_ACCESS_TOKEN_EXPIRE_MINUTES: Expiration time in minutes for JWT access tokens (default: 30).
    """

    DB_URL_LOCAL: str = Field(..., json_schema_extra={"env": "DB_URL_LOCAL"})
    """Database URL for local development."""

    DB_URL_PROD: str = Field(..., json_schema_extra={"env": "DB_URL_PROD"})
    """Database URL for production environment."""

    ALEMBIC_DB_URL_LOCAL: str = Field(..., json_schema_extra={"env": "ALEMBIC_DB_URL_LOCAL"})
    """Database URL for Alembic local development."""

    ALEMBIC_DB_URL_PROD: str = Field(..., json_schema_extra={"env": "ALEMBIC_DB_URL_PROD"})
    """Database URL for Alembic production environment."""

    ENV: str = Field("LOCAL", json_schema_extra={"env": "ENV"})
    """Current environment ('LOCAL', 'PROD', etc.)."""

    JWT_SECRET_KEY: str = Field(..., json_schema_extra={"env": "JWT_SECRET_KEY"})
    """Secret key used to sign JWT tokens."""

    JWT_ALGORITHM: str = Field("HS256", json_schema_extra={"env": "JWT_ALGORITHM"})
    """Algorithm used for JWT encoding (default: HS256)."""

    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        120, json_schema_extra={"env": "JWT_ACCESS_TOKEN_EXPIRE_MINUTES"}
    )
    """Expiration time in minutes for JWT access tokens (default: 120)."""

    TEST_USER_EMAIL: str = Field(..., json_schema_extra={"env": "TEST_USER_EMAIL"})
    """Test user email for visual tests."""
    
    TEST_USER_PASSWORD: str = Field(..., json_schema_extra={"env": "TEST_USER_PASSWORD"})
    """Password for test user."""

    TEST_DB_URL: str = Field("", json_schema_extra={"env": "TEST_DB_URL"})
    """Test database URL override. If empty, will auto-detect based on environment."""

    RESEND_API_KEY: str = Field("", json_schema_extra={"env": "RESEND_API_KEY"})
    """Resend API key for sending emails."""

    FROM_EMAIL: str = Field("noreply@aris.pub", json_schema_extra={"env": "FROM_EMAIL"})
    """Default from email address."""

    ADMIN_EMAIL: str = Field("", json_schema_extra={"env": "ADMIN_EMAIL"})
    """Admin email for notifications (signups, etc.)."""

    ANTHROPIC_API_KEY: str = Field("", json_schema_extra={"env": "ANTHROPIC_API_KEY"})
    """Anthropic API key for AI copilot functionality."""

    COPILOT_PROVIDER: str = Field("anthropic", json_schema_extra={"env": "COPILOT_PROVIDER"})
    """AI provider for copilot functionality (anthropic, openai, etc.)."""

    model_config = SettingsConfigDict(extra="forbid", env_file=".env")

    def get_test_database_url(self) -> str:
        """Get test database URL based on environment and configuration.
        
        Returns:
            - TEST_DB_URL if explicitly set
            - PostgreSQL URL if in CI environment (ENV=CI or CI=true)
            - SQLite URL for local development
        """
        if self.TEST_DB_URL:
            return self.TEST_DB_URL
            
        # Use PostgreSQL in CI environment (includes both real CI and local simulation)
        if self.ENV == "CI" or os.environ.get("CI"):
            worker_id = os.environ.get("PYTEST_XDIST_WORKER", "main")
            unique_id = str(uuid.uuid4())[:8]
            
            # Use different credentials for GitHub Actions vs local CI simulation
            if os.environ.get("GITHUB_ACTIONS"):
                # Real GitHub Actions CI environment - use per-worker databases for parallel test isolation
                return f"postgresql+asyncpg://postgres:postgres@localhost:5432/test_aris_{worker_id}_{unique_id}"
            else:
                # Local CI simulation (using local PostgreSQL user with worker isolation)
                return f"postgresql+asyncpg://leo.torres@localhost:5432/test_aris_{worker_id}_{unique_id}"
            
        # Use SQLite for local development
        worker_id = os.environ.get("PYTEST_XDIST_WORKER", "main")
        unique_id = str(uuid.uuid4())[:8]
        return f"sqlite+aiosqlite:///./test_{worker_id}_{unique_id}.db"


BASE_DIR = Path(__file__).resolve().parent.parent
env_file = BASE_DIR / ".env"
settings = Settings()  # type: ignore
