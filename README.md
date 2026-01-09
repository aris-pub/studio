# RSM Studio: The collaborative editor for RSM (Readable Science Markup).

<p align="center">
  <img src="design-assets/logos/logotype.svg" alt="Aris Logo" width="300">
</p>

[![CI](https://github.com/leotrs/aris/actions/workflows/ci.yml/badge.svg)](https://github.com/leotrs/aris/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/leotrs/aris/branch/main/graph/badge.svg)](https://codecov.io/gh/leotrs/aris)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 23+](https://img.shields.io/badge/node.js-23+-green.svg)](https://nodejs.org/)

**RSM Studio** is the reference implementation and collaborative editor for RSM (Readable
Science Markup). Write documents that preserve semantic meaning, render beautifully on
any device, and enable true interactivity. Real-time collaboration, universal device
support, planned Pandoc integration for import/export.

**Governance**: Studio is community-maintained—open source, bug reports and maintenance
contributions accepted. Part of the Aris Program, supported by community donations and
academic grants.

See more at [](https://aris.pub).


## Getting Started

### Prerequisites

- Frontend: Node.js `>=23`, NPM `>=10`
- Backend: Python `>=3.13`, PostgreSQL `>=14`, FastAPI `>=0.115`

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/leotrs/aris.git
   cd aris
   ```

2. **Install Just (task runner)**

   ```bash
   # macOS
   brew install just
   
   # Or download from: https://github.com/casey/just/releases
   ```

3. **Initialize development environment**

   ```bash
   just init     # Sets up all .env files and installs dependencies
   ```
   
   **CRITICAL**: All environment variables are REQUIRED. The system will crash immediately if any are missing.

4. **Start development containers**

   ```bash
   just dev      # Starts all services in Docker containers
   ```

### Project Structure

```
aris/
│
├── backend/
├──── main.py        # FastAPI app
├──── aris           # package that contains routes, CRUD operations, etc
├──── scripts        # DB management scripts
├──── tests          # backend tests
│
├── frontend/
├──── index.html     # mounting point for the app
├──── src            # Vue 3 frontend source
├────── App.vue      # Vue App component
├────── router.js    # Vue Router component
├────── main.js      # script that mounts the app
├────── File.js      # object to hold a RSM file in memory
├────── FileStore.js # manage File objects
├────── login        # login view: auth via JWT
├────── home         # home view: view all files
├────── main         # main view: read and edit a file
├────── assets       # static resources
├────── common       # common components
├────── components   # legacy dir
├────── composables  # Vue composables
│
├── docs/            # Project documentation
│
├── docker/          # Dockerfiles
│
└── README.md
```

## Testing Infrastructure

Aris features a robust dual-database testing infrastructure with automatic database selection and per-worker isolation for reliable parallel test execution.

### Database Strategy

**Local Development**
- **Database**: SQLite (fast iteration, no setup required)
- **Command**: `uv run pytest -n8`
- **Features**: Automatic in-memory databases, instant test execution

**CI Environment** 
- **Database**: PostgreSQL 15 (production-like testing)
- **Isolation**: Per-worker databases (`test_aris_gw0_abc123`, `test_aris_gw1_def456`, etc.)
- **Workers**: 8 parallel test workers for maximum speed
- **Features**: Automatic database creation, cleanup, and worker isolation

**Local CI Simulation**
- **Database**: PostgreSQL (matches CI exactly)
- **Command**: `./simulate-ci -- uv run pytest -n8`
- **Features**: 100% CI fidelity for debugging CI-specific issues

### Test Types

**Backend Tests**
- **Unit Tests**: `uv run pytest -n8` - Test individual functions and API endpoints
- **Integration Tests**: `tests/integration/` - RSM processing, database constraints
- **Coverage**: Generated in `htmlcov/` directory
- **Database Selection**: Automatic (SQLite locally, PostgreSQL in CI)

**Frontend Tests**  
- **Unit Tests**: `npm test` - Component and utility testing with Vitest
- **E2E Tests**: `npm run test:e2e` - End-to-end browser testing with Playwright

### E2E Test Setup

E2E tests require both backend and frontend servers running with a complete test environment.

#### Prerequisites
1. **PostgreSQL Database**: Running locally with `aris` database created
2. **Environment Variables**: 
   - **Local Development**: Both frontend and backend `.env` files should contain test user credentials
   - **CI Environment**: Requires GitHub repository secret `TEST_USER_PASSWORD`
   - **Test User**: `testuser@aris.pub` (password stored securely in environment variables)

#### Complete E2E Setup Process
```bash
# 1. Setup Backend
cd backend
uv sync --all-groups                    # Install dependencies
alembic upgrade head                    # Run database migrations
uv run python scripts/reset_test_user.py  # Create stable test data
uvicorn main:app --reload               # Start backend server (localhost:8000)

# 2. Setup Frontend (in new terminal)
cd frontend  
npm install                             # Install dependencies
npm run dev                             # Start frontend server (localhost:5173)

# 3. Run E2E Tests (in new terminal)
cd frontend
npm run test:e2e                        # Run Playwright tests
```

#### Test Data Management
- **Test User**: `testuser@aris.pub` with stable test files and tags
- **Reset Script**: Use `scripts/reset_test_user.py` to reset test environment to known state
- **Credential Security**: Test user password stored in environment variables (never in version control)
- **Single Source of Truth**: All E2E tests use centralized credentials from `frontend/src/tests/e2e/setup/test-data.js`
- **Visual Regression**: Test data designed for consistent visual regression testing

#### E2E Test Environment
- **Backend**: FastAPI server on `http://localhost:8000`
- **Frontend**: Vue.js dev server on `http://localhost:5173`  
- **Database**: Local PostgreSQL with test user and stable data
- **Authentication**: JWT-based auth with test user credentials
- **CI Requirements**: GitHub repository secret `TEST_USER_PASSWORD` must be configured

### Parallel Testing Architecture

**Worker Isolation**
- Each test worker gets an isolated database to prevent conflicts
- Database names include worker ID and unique hash: `test_aris_gw2_a1b2c3d4`
- Automatic cleanup after test completion

**Performance Benefits**
- **Local**: 8x speedup with SQLite (in-memory databases)
- **CI**: 8x speedup with PostgreSQL (isolated databases)
- **Reliability**: No flaky tests due to database conflicts

**Environment Detection**
```python
# Automatic database selection based on environment
if ENV == "CI" or os.environ.get("CI"):
    # Use PostgreSQL with per-worker databases
    return f"postgresql+asyncpg://postgres:postgres@localhost:5432/test_aris_{worker_id}_{unique_id}"
else:
    # Use SQLite for fast local development
    return f"sqlite+aiosqlite:///./test_{worker_id}_{unique_id}.db"
```

### CI Configuration

**PostgreSQL Service Container**
```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: test_aris
      POSTGRES_HOST_AUTH_METHOD: trust
```

#### Required GitHub Repository Secrets
For E2E tests to run in CI, the following repository secret must be configured:

- **`TEST_USER_PASSWORD`**: The password for `testuser@aris.pub` (secure test user credentials)

#### Setting Up GitHub Secrets
1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `TEST_USER_PASSWORD` with the test user password value

#### CI Test Coverage

**Backend Testing**
- **Tests**: 352 tests with 8 parallel workers
- **Database**: PostgreSQL 15 with per-worker isolation
- **Quality**: Linting (ruff), type checking (mypy)
- **Coverage**: Generated in `htmlcov/` directory

**Frontend Testing**
- **Unit Tests**: Component and utility testing with Vitest
- **Linting**: ESLint for code quality
- **E2E Tests**: 7 mutually exclusive job categories for comprehensive coverage

**E2E Test Architecture**
- **Total Coverage**: 122 tests across 7 specialized job categories
- **Authentication Control**: Uses public demo routes for auth-free testing
- **Tag-Based Selection**: Precise test categorization with `@tag` patterns
- **Mutually Exclusive**: Each test runs exactly once, no overlap
- **Parallel Execution**: All 7 jobs run simultaneously for maximum speed

**E2E Job Categories**
1. **e2e-auth** (27 tests): `@auth[^-]` - Core authentication-required functionality
2. **e2e-auth-flows** (22 tests): `@auth-flows` - Login, registration, redirects
3. **e2e-demo-content** (37 tests): `@demo-content` - Content rendering, navigation
4. **e2e-demo-ui** (33 tests): `@demo-ui` - Workspace, annotations, interactions
5. **e2e-core** (3 tests): `@core` - Critical smoke tests

### Running Individual Test Suites

```bash
# Backend tests (automatic database selection)
cd backend && uv run pytest -n8              # SQLite locally, fast iteration
cd backend && ./simulate-ci -- uv run pytest -n8  # PostgreSQL locally, CI simulation

# Frontend unit tests only  
cd frontend && npm test

# E2E tests only (requires both servers running)
cd frontend && npm run test:e2e

# E2E tests by category (with both servers running)
cd frontend && npm run test:e2e -- --grep "@auth[^-]"      # Auth-required tests
cd frontend && npm run test:e2e -- --grep "@auth-flows"     # Auth flow tests  
cd frontend && npm run test:e2e -- --grep "@demo-content"   # Demo content tests
cd frontend && npm run test:e2e -- --grep "@demo-ui"        # Demo UI tests
cd frontend && npm run test:e2e -- --grep "@core"           # Core smoke tests

# Run all tests
cd backend && uv run pytest -n8
cd frontend && npm test && npm run test:e2e

# Debug CI issues locally
cd backend && ./simulate-ci -- uv run pytest tests/integration/ -v

# Analyze CI failures for GitHub PRs (requires Claude Code)
/ci-report                    # Analyze CI for current branch's PR
/ci-report 123               # Analyze CI for specific PR number
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

Please ensure all tests pass and code is linted before submitting PRs:

```bash
# Run all checks (lint + typecheck + tests)
just check-all

# Or run individual commands:
just lint-all                           # Check code quality
just test-all                           # Run all tests
```

**Testing Infrastructure Notes**
- **Backend**: Local development uses SQLite for fast iteration; CI uses PostgreSQL with per-worker database isolation
- **E2E**: Uses tag-based test selection for precise categorization and mutually exclusive execution
- **Authentication**: E2E tests use public demo routes for authentication-free testing
- **Performance**: Backend tests run with 8 parallel workers; E2E tests run in 7 parallel job categories
- **Debug**: Use `./simulate-ci` to debug CI-specific issues locally with 100% fidelity; use `/ci-report` (Claude Code) to analyze GitHub PR CI failures

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Authors
Made with <3 by [leotrs](https://leotrs.com).

---

Aris, empowering researchers, one draft at a time.
# Trigger CI run
