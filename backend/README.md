# RSM Studio Backend

FastAPI backend for the RSM Studio scientific publishing platform. Provides a REST API for users, manuscripts, authentication, and real-time collaboration.

## Stack

- **Python 3.13+**
- **FastAPI** + **Uvicorn**
- **SQLAlchemy** (async) + **Alembic** migrations
- **PostgreSQL** — primary database
- **PyJWT** — authentication
- **pycrdt** + **websockets** — Y.js collaboration client

## Quick Start

```bash
uv sync
alembic upgrade head
uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`.

## Testing

```bash
uv run pytest -n8                      # SQLite locally (fast)
uv run pytest tests/integration/ -v   # integration tests
./simulate-ci -- uv run pytest -n8    # PostgreSQL (CI fidelity)
```

Tests use SQLite locally and PostgreSQL in CI automatically — no config needed for local dev.

## Deployment

```bash
# Deploy from the project root (build needs both backend/ and styles/)
fly deploy --config backend/fly.toml --ignorefile backend/.dockerignore
```

Database hosted on Supabase, managed via Alembic.

## Utility Scripts

| Script | Description |
|--------|-------------|
| `scripts/init_db.py` | Create all tables |
| `scripts/add_mock_data.py` | Seed database with mock users and files |
| `scripts/add_example_data.py` | Load example RSM documents |
| `scripts/sync_columns.py` | Sync columns between Postgres databases |
