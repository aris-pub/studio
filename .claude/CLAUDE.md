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
- **DEV**: Docker Compose runs services (backend, frontend, site, storybook, collab), tests run from OUTSIDE containers
- **CI**: Same Docker Compose setup as DEV, tests run from OUTSIDE containers
- **Production**: Services containerized, requests/interactions come from outside (mirrors DEV/CI pattern)

**Why tests run from outside containers:**
- Mirrors production: containerized services receive requests from external clients/browsers
- E2E tests (Playwright): Browser runs on host, loads frontend from Docker, tests real client behavior
- Backend tests (pytest): Can run on host (macOS locally, Linux in CI) or inside container as needed
- Eliminates Docker-in-Docker complexity for test execution

**Platform-specific binaries (tree-sitter-rsm):**
- `rsm/` and `rsm/tree-sitter-rsm` must be installed from local source (never PyPI/GitHub)
- tree-sitter-rsm compiles platform-specific binaries (macOS .dylib vs Linux .so)
- Solution: Platform-specific binary filenames allow macOS and Linux binaries to coexist
  - setup.py uses `py_limited_api=False` to generate platform-specific names
  - macOS: `_binding.cpython-313-darwin.so`
  - Linux: `_binding.cpython-313-aarch64-linux-gnu.so` (or x86_64)
  - Python's import system automatically loads the correct binary for each platform
- Docker builds Linux binaries once on startup, local tests use macOS binaries
- No rebuilding, no switching, no conflicts - both binaries coexist in the same directory

**Commands:**
```bash
just dev     # Start Docker Compose services (same as CI)
just test    # Run tests from host (connects to Docker services)
```

## CLI Tool (Studio CLI)

**Purpose**: Accelerate UI testing by eliminating authentication boilerplate and generating Playwright test templates.

**Use case**: When implementing UI-heavy features (e.g., real-time collaboration), agents can use the CLI to skip writing repetitive login/navigation code and jump straight to testing the actual feature.

### Commands

**All commands run from `cli/` directory**: `cd cli && uv run python -m cli <command>`

```bash
# Login once (session stored in ~/.studio/session.json)
uv run python -m cli login -u user@example.com -p password

# List files for logged-in user
uv run python -m cli files

# For humans: Open browser to file (exits immediately, browser stays open)
uv run python -m cli ui 200

# For agents: Output ready-to-use Playwright script with session injection
uv run python -m cli ui 200 --playwright

# Show current session data (tokens, user info)
uv run python -m cli session

# Logout
uv run python -m cli logout
```

### Agent Workflow

**Old way (avoid this boilerplate)**:
```python
# Agent had to write all this every time
browser = await puppeteer.launch()
page = await browser.newPage()
await page.goto('http://localhost:5173/login')
await page.type('#email', 'test@example.com')
await page.type('#password', 'password')
await page.click('#login-button')
await page.waitForNavigation()
# Navigate to file...
# FINALLY test the actual feature
```

**New way with CLI**:
```bash
# Step 1: Login once
uv run python -m cli login -u test@example.com -p password

# Step 2: Get Playwright script template
uv run python -m cli ui 123 --playwright > test_collab.py

# Step 3: Add test code to generated script
# The script already includes session injection and navigation boilerplate
```

**Complete Example**:
```python
# Generated script includes this boilerplate automatically:
# - Browser launch with headless mode
# - Session injection (tokens + user data)
# - Navigation to file URL

# Agent only needs to add test code at the end:
page.goto('http://localhost:5173/file/264', wait_until='domcontentloaded')

# Verify authentication
page.wait_for_selector('[data-testid="user-avatar"]', timeout=5000)
print("✓ User authenticated")

# Verify manuscript loaded
page.wait_for_selector('[data-testid="manuscript-container"]', timeout=5000)
print("✓ Manuscript container loaded")

# Example: Open source editor (CodeMirror) for testing Y.js collaboration
# IMPORTANT: Click the button element, not the label text
page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
page.wait_for_selector('.cm-container', timeout=5000)
print("✓ Source editor opened")

browser.close()
```

Run with: `cd cli && uv run python test_collab.py`

### Security & Environment

- **Local-only**: Refuses to run in PROD/CI/STAGING environments
- **Secure storage**: Session stored with 600 permissions in `~/.studio/session.json`
- **JWT validation**: Checks token expiration before operations

See [cli/README.md](cli/README.md) for architecture details and full documentation.

## Y.js Real-Time Collaboration

Aris implements real-time collaborative editing using **Y.js CRDT** (Conflict-free Replicated Data Type) with a **backend-as-client architecture**.

### Architecture Overview

```
┌────────────────────────────────────────┐
│    Y.js WebSocket Server (Port 1234)   │
│    - Pure message relay                 │
│    - In-memory Y.Doc per room           │
│    - No database logic                  │
└──────┬───────────────────┬──────────────┘
       │                   │
   ┌───▼────┐       ┌──────▼──────┐
   │Frontend│       │   Backend   │
   │Clients │       │   Client    │
   │        │       │             │
   │Edit    │       │Observe      │
   │        │       │Persist      │
   └────────┘       └──────┬──────┘
                          │
                    ┌─────▼──────┐
                    │ PostgreSQL │
                    └────────────┘
```

### Key Components

1. **WebSocket Server** (`multi-player/server.js`)
   - Pure relay server using `y-websocket`
   - Broadcasts updates between all connected peers
   - 59 lines of code (y-websocket handles everything else)
   - No persistence or database logic

2. **Backend Client** (`backend/aris/collaboration/`)
   - Connects to WebSocket server as a Y.js peer
   - Loads file content from database on connect
   - Observes Y.Doc changes and persists to database (500ms debounce)
   - Auto-reconnects on disconnect with exponential backoff

3. **Frontend Client** (`frontend/src/views/workspace/EditorCodeMirror.vue`)
   - CodeMirror 6 editor with `y-codemirror.next` binding
   - Connects to WebSocket server for real-time sync
   - No direct database access (gets content via Y.js sync)

### How It Works

1. **User Opens File**
   - Frontend creates Y.Doc and connects to `ws://multiplayer:1234/file-{id}`
   - Backend creates Y.Doc, loads content from database, connects to same room
   - Server syncs state between all clients

2. **User Edits Content**
   - Frontend applies edit to Y.Doc (via CodeMirror)
   - Y.Doc generates update message
   - Frontend sends update to WebSocket server
   - Server broadcasts to all peers (other frontends + backend)
   - Backend receives update, persists to database after 500ms

3. **Multi-User Collaboration**
   - Multiple users connect to same room (`file-{id}`)
   - All send/receive updates through server
   - Y.js CRDT resolves conflicts automatically
   - Backend persists merged state to database

### Permission System

Collaboration respects file permissions:

- **OWNER/EDITOR**: Can edit in real-time
- **COMMENTER**: Read-only mode (CodeMirror set to read-only)
- **Unauthorized**: Redirected to 404 page

Backend checks permissions before starting Y.js client:
```python
from aris.collaboration import get_collaboration_manager
from aris.authorization import has_permission, PermissionLevel

if await has_permission(file_id, user_id, PermissionLevel.EDIT, db):
    manager = get_collaboration_manager()
    await manager.start_client(file_id)
```

### Configuration

```bash
# Environment variables
MULTIPLAYER_HOST=multiplayer  # Or localhost for local dev
MULTIPLAYER_PORT=1234
VITE_MULTIPLAYER_URL=ws://localhost:1234  # Frontend WebSocket URL
```

### Known Issues & Patches

**y-codemirror.next Echo Prevention Bug**

**Problem**: Remote edits echo back to their origin, causing duplicates in Docker environments.

**Root cause**: Object identity checks fail in Docker (`tr.origin !== ySyncOrigin` doesn't work because objects aren't identical across module boundaries).

**Solution**: Patch to use `tr.local` flag instead of object identity:
```javascript
// Before (broken in Docker)
if (tr.origin !== ySyncOrigin) { ... }

// After (patched)
if (tr.origin !== ySyncOrigin && !tr.local) { ... }
```

**Patch location**: `frontend/scripts/patch-y-codemirror.cjs`

**Applied**: Automatically via npm postinstall hook and Docker entrypoint

### Development & Debugging

**Start collaboration services:**
```bash
just dev  # Starts backend, frontend, multiplayer server
```

**Check backend collaboration:**
```bash
docker compose logs -f backend | grep collaboration
```

**Expected logs:**
```
[aris.collaboration] Starting YDocClient for file 123
[aris.collaboration] WebSocket connected for file 123
[aris.collaboration] Loaded 1234 chars from DB for file 123
[aris.collaboration] Saved: 1250 chars to DB for file 123
```

**Check WebSocket server:**
```bash
docker compose logs -f multiplayer
```

**Monitor active connections:**
```bash
# Should show backend + frontend clients
[Y.js Server] Client connected (total: 2)
```

**Test multi-user collaboration:**
```bash
cd frontend
npx playwright test yjs-multi-user.spec.js --project=chromium
```

### Testing

- **Unit tests**: Backend Y.js client logic
- **E2E tests**: Real collaboration scenarios
  - Single-tab: 4 tests (basic functionality)
  - Multi-tab: 7 tests (same user, multiple tabs)
  - Multi-user: 8 tests (permissions, multi-user editing)
  - All run in CI on every PR

### Documentation

- [Backend-as-Client Architecture](../backend/aris/collaboration/README.md)
- [WebSocket Server](../multi-player/README.md)
- [y-codemirror.next Patch](../frontend/scripts/patch-y-codemirror.cjs)

### Future Enhancements

- **Cursor awareness**: Show where other users are typing
- **Presence indicators**: Display active users
- **Version history**: Leverage Y.js history for undo/redo
- **Offline support**: Queue updates when disconnected

## Just Commands (Task Runner)

### Development
```bash
just init                             # Initial setup - copies .env files, installs dependencies
just dev                              # Start development containers (uses current directory name)
just migrate                          # Run database migrations (both PROD and LOCAL)
just stop                             # Stop development containers
just logs                             # View container logs
just status                           # Check container status
```

### Testing & Quality
```bash
just test                             # Run all tests (backend + frontend + site)
just lint                             # Run all linters (backend + frontend + site)
just check                            # Complete check: lint + typecheck + test
```

### Utility Commands
```bash
just init                             # Initial setup - copies .env files, installs dependencies
just env                              # Show environment configuration
just notify "message"                 # Send macOS notification
```

### Individual Service Commands (run inside containers)
```bash
# Backend (inside container)
uv sync --all-groups                  # Install dependencies
uvicorn main:app --reload             # Run dev server
uv run pytest -n8                     # Run tests (SQLite locally, PostgreSQL in CI)
uv run ruff check                     # Lint
uv run mypy aris/                     # Type check

# Frontend (inside container)
npm install                           # Install dependencies
npm run dev                           # Run dev server
npm run test:all                      # Run all tests (unit + E2E)
npm test                              # Run unit tests
npm run test:e2e                      # Run E2E tests
npm run lint                          # Lint code
npm run storybook                     # Run Storybook

# Site (inside container)
npm install                           # Install dependencies
npm run dev                           # Run dev server (auto-copies brand assets)
npm run build                         # Build for production (auto-copies brand assets)
npm run copy-assets                   # Manually copy brand assets to public/brand/
npm run test:all                      # Run all tests
npm test                              # Run tests
npm run lint                          # Lint code

# CLI (local machine - NOT containerized)
cd cli
uv sync                               # Install dependencies
uv run python -m cli <command>        # Run CLI commands
uv run pytest -v                      # Run tests
uv run ruff check --fix               # Lint
uv run mypy cli/                      # Type check
```

**Note on Brand Assets**: The site automatically copies brand assets from `brand/logos/studio/` to `site/public/brand/` during `npm run dev` and `npm run build` via pre-hooks. This avoids symlink issues in Docker containers. The copied files are gitignored.

## AI Copilot Setup
```bash
cp backend/.env.example backend/.env  # Configure API keys
# Add your ANTHROPIC_API_KEY to backend/.env
# See backend/AI_SETUP.md for detailed instructions
```

**CI Cost Prevention**: The codebase includes automatic cost protection for CI environments. E2E tests use mock AI responses instead of real API calls, preventing charges during automated testing while still validating frontend-backend communication workflows.

## Testing Infrastructure

### Backend Testing
- **Local Development**: Tests use SQLite for fast development iterations
- **CI Environment**: Tests automatically use PostgreSQL for production-like testing
- **Dual Database Support**: Same test suite runs on both databases
- **Integration Tests**: `tests/integration/` contains RSM processing and database constraint tests
- **Environment Variables**:
  - `TEST_DB_URL`: Override test database URL
  - `CI=true` or `ENV=CI`: Forces PostgreSQL usage
  - `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`: Credentials for E2E test user
- **Local CI Simulation**: Use `./simulate-ci -- <command>` for 100% CI fidelity

### E2E Testing Strategy
The E2E test suite is organized into **7 mutually exclusive jobs** for optimal parallelization:

#### **Authentication-Required Tests** (with database + test user):
1. **`e2e-auth`** (27 tests): User account, file management, authenticated features
2. **`e2e-auth-flows`** (22 tests): Login, registration, auth redirects

#### **Authentication-Disabled Tests** (public/demo content):
3. **`e2e-core`** (3 tests): Smoke tests, critical functionality
4. **`e2e-demo-content`** (37 tests): Demo content rendering, navigation, backend integration
5. **`e2e-demo-ui`** (33 tests): Demo workspace, annotations, focus mode interactions

#### **Test Selection & Tagging**:
- **Tag-based execution**: Tests use `@auth`, `@auth-flows`, `@core`, `@demo-content`, `@demo-ui` tags
- **Precise pattern matching**: `@auth[^-]` pattern prevents tag collision with `@auth-flows`
- **Mutually exclusive**: Each test runs exactly once across all jobs

#### **Authentication Control**:
- **Demo routes**: Public routes (`/demo`) provide authentication-free testing
- **Environment-aware**: Automatically detects CI vs local environments

## Development Setup

### Environment Configuration (REQUIRED)

#### Development Environment
```bash
# Copy environment template and configure ports
cp .env.example .env
# Edit .env with your desired port configuration
```

**CRITICAL**: All environment variables in `.env` are REQUIRED. The system will crash immediately if any are missing - there are NO fallbacks.

#### CI/STAGING/PROD Environments
For CI, STAGING, and PROD environments, set these environment variables directly in your deployment configuration:
- `BACKEND_PORT`, `FRONTEND_PORT`, `SITE_PORT`, `STORYBOOK_PORT`
- `DB_PORT`, `DB_NAME`, `TEST_DB_NAME`
- Set `ENV=CI`, `ENV=STAGING`, or `ENV=PROD` to enable system environment variable mode

### Development Setup
```bash
just init                             # Sets up all .env files and installs all dependencies
just dev                              # Start development containers
```

## Frontend Commands
```bash
npm install                           # Install dependencies
npm run dev                           # Run dev server
npm run storybook                     # Run Storybook component library
npm run lint                          # Lint code
npm test                              # Run unit tests
npm run test:e2e                      # Run all E2E tests (sequential)
```

### E2E Test Execution
```bash
# Run specific test suites (parallel-friendly)
npx playwright test --grep "@auth[^-]"     # Auth-required tests (27 tests)
npx playwright test --grep "@auth-flows"   # Auth flow tests (22 tests)
npx playwright test --grep "@core"         # Core functionality (4 tests)
npx playwright test --grep "@demo-content" # Demo content tests (37 tests)
npx playwright test --grep "@demo-ui"      # Demo UI tests (33 tests)

# Debug and development
npx playwright test --headless            # Run with browser visible
npx playwright test --debug               # Run in debug mode
npx playwright test --reporter=html       # Generate HTML report
```

## Critical Rules

### Environment Configuration
- **Development**: Copy `.env.example` to `.env` and configure ALL variables before starting any service
- **CI/STAGING/PROD**: Set environment variables directly in deployment configuration (`ENV=CI/STAGING/PROD`)
- **NO FALLBACKS**: Missing environment variables will crash the system immediately
- **FAIL-FAST**: All scripts validate environment before execution using `docker/env-check.js`

### Development Practices
- **ALWAYS use `osascript` for macOS notifications** (allowed in any directory)
- **ALWAYS use `git mv` to move files** (preserve history)
- **ALWAYS add blank line at end of files**
- **NEVER leave whitespace at the end of lines**
- **Follow existing code patterns and conventions**
- **Run tests after changes** (`npm test` and `uv run pytest -n8`)
- **Run linters before terminating a task**
- **Global Components**: All components in `src/components/` auto-registered via `main.js`
- **For user interaction bugs: ALWAYS use `debug/debug-bug-template.js` to replicate**
- **Whenever using puppeteer or playwright, use headless mode**
- **Always run e2e tests with --reporter=line**
- Before starting any service, check if it is already running
- **Send notifications when tasks complete or need user input**: `osascript -e "display notification \"message\" with title \"Claude Code\""`

### Testing Practices

#### Test Implementation Guidelines

**Component Mocking Rules**:
- **NEVER mock simple, fast-rendering components** in tests:
  - `Button`, `Icon`, `Toast`, `Avatar`, `Logo`, `Separator`, `Checkbox`
  - `HSeparator`, `LoadingSpinner`, `ThemeSwitch`, `Tooltip`
  - Basic form inputs: `BaseInput`, `InputText`, `TextareaInput`
- **DO mock slow or complex components**:
  - `Manuscript`, `ManuscriptWrapper` (heavy RSM rendering)
  - `Storybook` components, chart libraries, external widgets
  - Network-dependent components, file upload handlers

**Network and Timing**:
- **NEVER use `waitForTimeout()` or arbitrary time-based waits** - they waste CI time and cause flaky tests
  - Time-based waits add unnecessary delays (30-60+ seconds per test file)
  - State can change faster or slower than arbitrary timeouts
  - **ALWAYS use state/logic-based waits instead**: `waitForSelector()`, `waitForResponse()`, `waitForFunction()`, `expect(element).toBeVisible()`
- **NEVER use `networkidle`** - it's unreliable and causes flaky tests
- **Use explicit waits**: `waitForSelector()`, `waitForResponse()`, `waitForFunction()`
- **Wait for specific elements**: `await expect(locator).toBeVisible()`
- **Wait for API responses**: `await page.waitForResponse('/api/endpoint')`

**Configuration**:
- **NEVER hard-code URLs or ports** in tests
- **Use environment variables**: `process.env.VITE_API_BASE_URL`, `process.env.FRONTEND_PORT`
- **Use test config files**: `playwright.config.js`, `vitest.config.js`
- **Reference base URLs**: `baseURL` in Playwright config, `@/` aliases in Vue tests

#### Test Debugging and Maintenance

**Timeout Management**:
- **NEVER fix a failing test by simply increasing timeouts**
- **Root cause analysis required**: Find WHY the test is slow, don't mask it
- **Acceptable timeout increases ONLY when**:
  - Adding new functionality that legitimately takes longer
  - Testing slow operations (file uploads, complex renders)
  - CI environment is consistently slower than local

**Flaky Test Identification**:
- **Label tests as flaky (`@flaky` tag) when they meet 2+ criteria**:
  - Fails intermittently (< 95% pass rate over 10 runs)
  - Failure is non-deterministic (timing-dependent, race conditions)
  - Same test passes locally but fails in CI (or vice versa)
  - Failure messages vary between runs ("element not found" vs "timeout")

**Flaky Test Resolution Process**:
1. **Identify the root cause**: Race conditions, insufficient waits, external dependencies
2. **Fix the underlying issue**: Add proper waits, stabilize test data, mock unreliable services
3. **Remove `@flaky` tag** only after 10+ consecutive successful runs
4. **Document the fix**: Add comments explaining the previous flakiness and solution

**Test Isolation**:
- **Each test must be independent**: No shared state between tests
- **Clean up after tests**: Reset databases, clear localStorage, restore mocks
- **Use fresh test data**: Generate unique IDs, avoid hardcoded test user emails
- **Parallel-safe**: Tests must pass when run concurrently with others

**Element Selection Standards**:
- **ALWAYS use `data-testid` attributes for test element selection**:
  - Use `[data-testid="menu-toggle"]` instead of `.menu-toggle`
  - Use `[data-testid="mobile-menu-overlay"]` instead of `.mobile-menu-overlay`
  - CSS classes can change for styling reasons, but `data-testid` attributes are stable
- **Text-based selectors**: Use `.filter({ hasText: "..." })` for text-based element selection
- **Avoid CSS class selectors**: Only use CSS classes when no `data-testid` attribute exists
- **Component developers**: Add `data-testid` attributes to all interactive elements
- **CRITICAL: Click interactive elements, not labels**:
  - Vue components often have separate label and button elements
  - Example: SidebarItem has `.sb-item-label` (display text) and `ButtonToggle` (interactive)
  - **WRONG**: `page.click('.sb-item-label:has-text("source")')` - clicks non-interactive label
  - **CORRECT**: `page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')` - clicks the actual button
  - Always target the interactive element (`button`, `input`, `a`) within the component structure
```

## Language Guidelines
- Stop using the word 'absolutely'
- **Playwright MUST always be used in headless mode**

## AI Collaboration Guidelines
- **AI Interaction Principles**:
  - Never start the dev server yourself, always ask me to do it
