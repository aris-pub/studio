# Contributing to Aris

## Setup

```bash
git clone https://github.com/leotrs/aris.git
cd aris
just init   # copies .env files, installs all dependencies
just dev    # starts all services in Docker
```

Services start at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/docs
- Dev login: `foo@bar.com` / `admin`

## Workflow

```bash
git checkout -b feat/your-feature

# make changes, then:
just check   # lint + typecheck + tests
git push origin feat/your-feature
```

Open a PR against `main`. All CI checks must pass.

## Code Standards

**Backend (Python 3.13+)**
- `ruff` for linting, `mypy` for type checks
- Type hints required on all public functions
- Use async SQLAlchemy; soft deletes via `deleted_at`

**Frontend (Vue 3)**
- ESLint + Prettier (auto-applied)
- Composition API, `<script setup>`
- Vitest for unit tests, Playwright for E2E

**Tests**
- Each test must be independent — no shared state
- Use `data-testid` attributes for E2E element selection
- No `waitForTimeout()` — use state-based waits

## Reporting Issues

Use GitHub Issues. For bugs include steps to reproduce, expected vs actual behavior, and environment details.

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Contributions are licensed under the same license as the project.
