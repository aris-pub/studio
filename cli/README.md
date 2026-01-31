# Aris Studio CLI

Developer CLI tool for local Aris development.

**CRITICAL:** This tool ONLY works in LOCAL development environment. It refuses to run in PROD, CI, or STAGING.

## Installation

```bash
cd cli
uv sync
```

## Usage

All commands must be run from the `cli/` directory:

```bash
cd cli
uv run python -m cli login -u foo@bar.com -p admin
```

Session is stored in `~/.studio/session.json` with file permissions `600` (read/write owner only).

### List Files

```bash
uv run python -m cli files
```

Shows a table with file ID, title, and last edited timestamp for the logged-in user.

### Open File in Browser

```bash
uv run python -m cli ui 200
```

Opens your browser to the specified file with the current session automatically injected. Browser stays open until manually closed.

### Logout

```bash
uv run python -m cli logout
```

Clears the stored session.

## Architecture

**Thin API wrapper with zero business logic:**

- `check_environment()` - Validates ENV, exits if not LOCAL
- `Session` - Manages `~/.studio/session.json` (save/load/clear/validate)
- `StudioAPI` - Thin wrapper around API endpoints (POST /login, GET /me, GET /users/{id}/files)
- `cli` - Click command group with 4 commands: login, logout, files, ui

**Browser automation:**
- Uses Playwright to launch browser
- Injects tokens into `localStorage`
- Navigates to file URL
- Keeps browser open for manual interaction

## Testing

```bash
# Run tests
cd cli && uv run pytest -v

# Run with coverage
cd cli && uv run pytest --cov=cli --cov-report=html

# Lint
cd cli && uv run ruff check --fix
cd cli && uv run mypy cli/
```

## Integration

Added to `justfile`:

```makefile
# Run all tests (includes CLI)
just test

# Run all linters (includes CLI)
just lint
```

## Security

- Session file stored with permissions `600` (owner read/write only)
- Tokens are JWTs with 120-minute expiration
- Environment check prevents accidental production usage
- No API keys or secrets stored (uses backend's JWT_SECRET_KEY)
