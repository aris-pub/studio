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

### Show Session Info

```bash
uv run python -m cli session
```

Displays current session data (access token, refresh token, and user info). Useful for debugging or manual token extraction.

### Open File in Browser

```bash
# For humans: opens browser and exits immediately
uv run python -m cli ui 200

# For agents: outputs ready-to-use Playwright script
uv run python -m cli ui 200 --playwright
```

**Default behavior (humans):**
- Opens browser with file already loaded and session injected
- Exits immediately (no blocking)
- Browser stays open for manual interaction

**With `--playwright` flag (agents/automation):**
- Outputs a complete Playwright script to stdout
- Agent can save it to a file or pipe it directly
- Script includes session injection and navigation boilerplate
- Reduces test script boilerplate significantly

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
- `cli` - Click command group with 5 commands: login, logout, session, files, ui

**Browser automation:**
- Uses Playwright to launch browser
- Injects tokens into `localStorage`
- Navigates to file URL
- Two modes:
  - Default: Opens browser for human use (no blocking, exits immediately)
  - `--playwright`: Outputs script template for agent/automation use

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
