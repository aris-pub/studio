# CLAUDE.md

## Project Overview
Aris is a web-native scientific publishing platform. FastAPI backend + Vue.js frontend
for RSM (Readable Research Markup) manuscripts.

## Structure
```
aris/
├── backend/    # FastAPI backend
├── frontend/   # Vue.js frontend
└── CLAUDE.md
```

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
npm run dev                           # Run dev server
npm run test:all                      # Run all tests
npm test                              # Run tests
npm run lint                          # Lint code
```

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

### Standard Development
```bash
just init                             # Sets up all .env files and installs all dependencies
just dev                              # Start development containers
```

### Containerized Development (Multi-Clone Setup)
```bash
# Quick setup for any clone
just init                             # Sets up all .env files and installs dependencies
just dev                              # Start containers (uses directory name as project name)

# For additional clones, use the setup script
./docker/scripts/setup-clone.sh

# Access services (using your configured ports):
# Frontend: http://localhost:{FRONTEND_PORT}
# Storybook: http://localhost:{STORYBOOK_PORT}
# Backend API: http://localhost:{BACKEND_PORT}/docs
# Database: localhost:{DB_PORT}
```

See [docker/README.md](docker/README.md) for detailed multi-clone setup instructions.

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

## CI Debugging and Analysis

### Custom Claude Code Commands

#### CI Reporting
```bash
/ci-report                    # Analyze CI for current branch's PR
/ci-report 123               # Analyze CI for specific PR number
```

The `/ci-report` command provides comprehensive CI failure analysis:
- **Automatic PR detection**: Finds open PR for current branch or uses specified PR number
- **CI cancellation**: Automatically cancels running CI to get fresh logs
- **Failure pattern analysis**: Categorizes failures (unit tests, E2E, site tests, browser-specific)
- **Structured reporting**: Provides summary with job counts and actionable recommendations

**Implementation**: 
- Command: `.claude/commands/ci-report.md`
- Data collection: `scripts/get-ci-data.sh`
- Uses GitHub CLI (`gh`) for PR and workflow data retrieval

#### Manual CI Data Collection
```bash
./scripts/get-ci-data.sh [PR_NUMBER]    # Standalone script for CI data gathering
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
```

## Language Guidelines
- Stop using the word 'absolutely'
- **Playwright MUST always be used in headless mode**

## AI Collaboration Guidelines
- **AI Interaction Principles**:
  - Never start the dev server yourself, always ask me to do it
