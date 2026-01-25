# RSM Studio: The collaborative editor for RSM (Readable Science Markup).

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

## Testing

Tests use SQLite locally for fast iteration and PostgreSQL in CI for production-like testing. Backend tests run with 8 parallel workers for maximum speed.

```bash
# Run all tests
just test

# Run all checks (lint + typecheck + tests)
just check

# Backend tests only
cd backend && uv run pytest -n8

# Frontend unit tests
cd frontend && npm test

# E2E tests (requires both servers running)
cd frontend && npm run test:e2e
```

For detailed testing documentation, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

Ensure all tests pass and code is linted before submitting PRs:

```bash
just check     # Run all checks
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Authors
Made with <3 by [leotrs](https://leotrs.com).

---

Aris, empowering researchers, one draft at a time.
