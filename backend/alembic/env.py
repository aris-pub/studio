"""Alembic environment settings.

Will read ../alembic.ini and whatever is inside .env files in this dir or up.

"""

import os
from logging.config import fileConfig
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

from alembic import context
from aris.models import Base


# Load the appropriate .env files based on environment
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

# Load root .env first (for DB_PORT, DB_NAME, etc.)
root_env_file = ROOT_DIR / ".env"
if root_env_file.exists():
    load_dotenv(root_env_file)

# Load backend .env second (for backend-specific settings, can override root)
env_file = BASE_DIR / (".env.ci" if os.getenv("ENV") == "CI" else ".env")
if env_file.exists():
    load_dotenv(env_file, override=True)

config = context.config


def get_database_url() -> str:
    """Select the database URL based on the ENV environment variable.

    If ENV=LOCAL, use DB_URL_LOCAL.
    If ENV=PROD, use DB_URL_PROD.
    If ENV=CI, use ALEMBIC_DB_URL_PROD (PostgreSQL test instance).
    Defaults to DB_URL_LOCAL if ENV is unset or unrecognized.

    :return: The selected database URL.
    """
    env = os.getenv("ENV", "LOCAL").upper()
    if env == "PROD":
        # Prefer ALEMBIC_DB_URL_PROD, but fall back to DB_URL_PROD with driver conversion
        url = os.getenv("ALEMBIC_DB_URL_PROD")
        if not url:
            url = os.getenv("DB_URL_PROD")
            if url and "+asyncpg://" in url:
                url = url.replace("+asyncpg://", "+psycopg2://")
    elif env == "CI":
        # In CI, use the production DB URL which points to PostgreSQL test instance
        url = os.getenv("ALEMBIC_DB_URL_PROD")
    else:
        url = os.getenv("ALEMBIC_DB_URL_LOCAL")
        # If not set, construct from DB_PORT and DB_NAME
        if not url:
            db_port = os.getenv("DB_PORT")
            db_name = os.getenv("DB_NAME")
            if db_port and db_name:
                url = f"postgresql+psycopg2://postgres:postgres@localhost:{db_port}/{db_name}"

    if not url:
        raise RuntimeError(f"Database URL not found for environment '{env}'")

    return url


# Set sqlalchemy.url dynamically based on ENV
database_url = get_database_url()

config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    Uses a URL to configure the context without creating an Engine.

    :return: None
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        future=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    Creates an Engine and connects for running migrations.

    :return: None
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            future=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
