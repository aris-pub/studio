# Aris Backend

This is the backend service for **Aris**, a web-native scientific publishing platform.
Built with **FastAPI**, it provides a RESTful API for managing users, manuscripts,
authentication, and metadata.

## Tech Stack

- **Python 3.13+**
- **FastAPI** – web framework
- **SQLAlchemy** – ORM
- **PostgreSQL** – primary database
- **Alembic** – migrations
- **PyJWT** – token-based authentication
- **Pydantic** – data validation
- **Uvicorn** – ASGI server

## Features

- JWT-based authentication with access and refresh tokens
- CRUD operations for users, manuscripts, tags, and metadata
- Soft-delete support
- Role-free user model (for now)
- Versioned database migrations via Alembic (soon)

## Running Locally

1. **Install dependencies**

   ```bash
   uv sync
   ```

2. **Run migrations**

   ```bash
   alembic upgrade head
   ```

3. **Start the server**

   ```bash
   uvicorn main:app --reload
   ```

4. **API**

   Once running, the API docs are available at `http://localhost:8000/docs`.

## Testing

The backend uses a dual-database testing strategy for optimal development speed and CI fidelity.

### Quick Development Testing

For fast iteration during development:

```bash
uv run pytest -n8                     # SQLite, 8 parallel workers
uv run pytest tests/test_routes/       # Test specific module
uv run pytest -k "test_login"         # Run tests matching pattern
```

### CI Simulation

For 100% CI fidelity using PostgreSQL (requires local PostgreSQL server):

```bash
./simulate-ci -- uv run pytest -n8              # Full test suite 
./simulate-ci -- uv run pytest tests/integration/ # Integration tests only
./simulate-ci -- uv run pytest -k "database"     # Database-specific tests
```

#### Setting Up CI Simulation

1. **Copy the template script:**
   ```bash
   cp simulate-ci.example simulate-ci
   ```

2. **Edit `simulate-ci` with your actual credentials:**
   ```bash
   # Replace placeholders with your actual values
   export JWT_SECRET_KEY=your_actual_jwt_secret
   export TEST_USER_PASSWORD=your_test_password
   # Other environment variables as needed
   ```
   
   **Note**: PostgreSQL credentials are automatically detected:
   - **Local simulation**: Uses your local PostgreSQL username (e.g., `your_username@localhost`)
   - **GitHub Actions CI**: Uses `postgres:postgres@localhost` (matches CI service)

3. **Make it executable:**
   ```bash
   chmod +x simulate-ci
   ```

The script automatically:
- Sets CI environment variables
- Uses PostgreSQL with worker-specific database isolation
- Runs your command
- Cleans up environment variables on exit

### Database Strategy

| Environment | Database | Isolation | Use Case |
|-------------|----------|-----------|----------|
| **Local Dev** | SQLite | File-based per worker | Fast iteration, development |
| **CI / Simulation** | PostgreSQL | Database per worker | Production-like testing |

**Worker Isolation**: Each pytest worker gets a unique database named `test_aris_{worker_id}_{uuid}` to prevent conflicts during parallel execution.

### Environment Variables

- `TEST_DB_URL`: Override database URL completely
- `CI=true` or `ENV=CI`: Force PostgreSQL usage with worker isolation
- `PYTEST_XDIST_WORKER`: Set automatically by pytest-xdist for worker identification


## Deployment

### Fly.io Deployment

The FastAPI app is deployed on fly.io using a **monorepo-aware build configuration**:

```bash
# Deploy from the PROJECT ROOT directory (not backend/)
cd /path/to/aris  # Navigate to monorepo root
fly deploy --config backend/fly.toml --ignorefile backend/.dockerignore
```

**Why deploy from root?**
- The build needs access to both `backend/` and `styles/` directories
- This mirrors the development container setup in `docker-compose.dev.yml`
- The Dockerfile copies: `COPY backend/ .` and `COPY styles/ ./styles`
- The `.dockerignore` file excludes large frontend/site directories (~1GB) for faster uploads

### Build Context Architecture

```
aris/                           # ← Deploy from here
├── backend/
│   ├── fly.toml               # ← Configuration file
│   ├── Dockerfile             # ← Build instructions  
│   └── main.py                # ← FastAPI app
├── styles/             # ← Static assets served at /styles
│   ├── css/
│   └── logos/
└── frontend/
```

The deployment uses:
- **Build context**: Root directory (for access to styles)
- **Dockerfile**: `backend/Dockerfile` (relative to root)  
- **Working directory**: `/app` (contains backend code + styles)

### Monitoring

Use `fly logs` to stream live logs and `fly status` to check deployment status.

The database is hosted on Supabase, and `alembic` is used to control its schema.

## Utility Scripts

Helper scripts are available in the `scripts/` directory for common maintenance tasks:

| Script               | Description                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `init_db.py`         | Create all tables in the database using the models’ metadata (i.e., `Base.metadata.create_all`).        |
| `add_mock_data.py`   | Populate the database with mock users, files, and tags for testing purposes.                            |
| `add_example_data.py`| Load example `.rsm` documents into the database from the `rsm-examples` package.                        |
| `sync_columns.py`    | Sync specified columns from one Postgres database to another, skipping duplicates.                      |
