# CLAUDE.md

## Project Overview
Aris is a web-native scientific publishing platform. FastAPI backend + Vue.js frontend
for RSM (Readable Research Markup) manuscripts.

## Structure
```
aris/
├── backend/    # FastAPI backend
├── frontend/   # Vue.js frontend
├── cli/        # CLI tool for local development
└── CLAUDE.md
```

## Architecture: Services in Docker, Tests from Outside

**Critical Architecture Decision:**
- **DEV/CI**: Docker Compose runs services (backend, frontend, site, storybook, collab), tests run from OUTSIDE containers
- **Production**: Services containerized, requests come from outside (mirrors DEV/CI pattern)

**Why tests run from outside containers:**
- Mirrors production: containerized services receive requests from external clients/browsers
- E2E tests (Playwright): Browser runs on host, loads frontend from Docker
- Backend tests (pytest): Run on host (macOS locally, Linux in CI)

**Platform-specific binaries (tree-sitter-rsm):**
- `rsm/` and `rsm/tree-sitter-rsm` must be installed from local source (never PyPI/GitHub)
- tree-sitter-rsm compiles platform-specific binaries (macOS .dylib vs Linux .so)
- `py_limited_api=False` generates platform-specific names so both coexist in the same directory
- Docker builds Linux binaries once on startup; local tests use macOS binaries

```bash
just dev     # Start Docker Compose services
just test    # Run tests from host (connects to Docker services)
```

## CLI Tool (Studio CLI)

Accelerates UI testing by generating Playwright scripts with session injection pre-configured.

```bash
# All commands run from cli/ directory
uv run python -m cli login -u user@example.com -p password
uv run python -m cli files
uv run python -m cli ui 200 --playwright   # Output ready-to-use Playwright script
uv run python -m cli session
uv run python -m cli logout
```

See [cli/README.md](cli/README.md) for full documentation.

## Y.js Real-Time Collaboration

Backend-as-client architecture: Y.js WebSocket server (port 1234) relays between frontend clients and a backend client that persists to PostgreSQL.

**Key components:**
- WebSocket server: `multi-player/server.js` (pure relay, no DB logic)
- Backend client: `backend/aris/collaboration/` (loads from DB on connect, persists on change with 500ms debounce)
- Frontend client: `frontend/src/views/workspace/EditorCodeMirror.vue`

**Configuration:**
```bash
MULTIPLAYER_HOST=multiplayer   # or localhost for local dev
MULTIPLAYER_PORT=1234
VITE_MULTIPLAYER_URL=ws://localhost:1234
```

**Known patch — y-codemirror.next echo prevention:**
Remote edits echo back in Docker because object identity checks fail across module boundaries. Patch uses `tr.local` flag instead:
```javascript
// Patched (frontend/scripts/patch-y-codemirror.cjs) — applied via npm postinstall
if (tr.origin !== ySyncOrigin && !tr.local) { ... }
```

See [backend/aris/collaboration/README.md](../backend/aris/collaboration/README.md) for full architecture docs.

## Just Commands

```bash
just init      # Initial setup — copies .env files, installs dependencies
just dev       # Start development containers
just migrate   # Run database migrations
just stop      # Stop containers
just logs      # View container logs
just status    # Check container status

just test      # Run all tests (backend + frontend + site)
just lint      # Run all linters
just check     # lint + typecheck + test

just env       # Show environment configuration
just notify "message"  # Send macOS notification
```

## Environment Configuration

All environment variables in `.env` are **REQUIRED**. The system crashes immediately if any are missing — no fallbacks.

```bash
cp .env.example .env   # Development: configure all variables before starting services
```

For CI/STAGING/PROD: set `ENV=CI/STAGING/PROD` and provide all vars directly in deployment config (`BACKEND_PORT`, `FRONTEND_PORT`, `SITE_PORT`, `STORYBOOK_PORT`, `DB_PORT`, `DB_NAME`, `TEST_DB_NAME`).

## Critical Rules

### Development Practices
- **ALWAYS use `osascript` for macOS notifications** (allowed in any directory)
- **ALWAYS use `git mv` to move files** (preserve history)
- **ALWAYS add blank line at end of files**
- **NEVER leave whitespace at the end of lines**
- **Run tests after changes** (`npm test` and `uv run pytest -n8`)
- **Run linters before terminating a task**
- **Global Components**: All components in `src/components/` auto-registered via `main.js`
- **For user interaction bugs: ALWAYS use `debug/debug-bug-template.js` to replicate**
- **Always run e2e tests with --reporter=line**
- Before starting any service, check if it is already running
- **Send notifications when tasks complete or need user input**: `osascript -e "display notification \"message\" with title \"Claude Code\""`

## Language Guidelines
- Stop using the word 'absolutely'

## AI Collaboration Guidelines
