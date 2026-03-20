# Aris Development Task Runner
# Set environment variables from .env
set dotenv-load

# Default recipe - show help
default:
    @just --list

# Development Commands
# ====================

# Start development containers (uses current directory name as project)
dev *args="":
    ./scripts/start-dev.sh {{args}}

# Run database migrations (both PROD and LOCAL)
migrate:
    cd backend && export ENV=PROD && alembic upgrade head && export ENV=LOCAL && alembic upgrade head

# Stop development containers
stop:
    @echo "Stopping containers for $(basename $(pwd))..."
    docker compose --env-file .env -p $(basename $(pwd)) -f docker/docker-compose.dev.yml down
    @echo "Cleaning up any orphaned containers on dev ports..."
    @docker ps --filter "publish=8001" --format "{{{{.ID}}" | xargs -r docker stop 2>/dev/null || true
    @docker ps --filter "publish=${BACKEND_PORT}" --format "{{{{.ID}}" | xargs -r docker stop 2>/dev/null || true
    @docker ps --filter "publish=${FRONTEND_PORT}" --format "{{{{.ID}}" | xargs -r docker stop 2>/dev/null || true
    @docker ps --filter "publish=${SITE_PORT}" --format "{{{{.ID}}" | xargs -r docker stop 2>/dev/null || true
    @docker ps --filter "publish=${STORYBOOK_PORT}" --format "{{{{.ID}}" | xargs -r docker stop 2>/dev/null || true
    @docker ps --filter "publish=${MULTIPLAYER_PORT}" --format "{{{{.ID}}" | xargs -r docker stop 2>/dev/null || true
    @docker ps --filter "publish=${DB_PORT}" --format "{{{{.ID}}" | xargs -r docker stop 2>/dev/null || true
    @echo "All containers stopped"

# View logs for development containers
logs:
    docker compose -p $(basename $(pwd)) -f docker/docker-compose.dev.yml logs

# Testing Commands
# ================

# Run all tests locally (Docker is for dev server only, not tests)
# Backend tests run on macOS with macOS binaries (no binary conflicts)
# CI runs tests on Linux separately
test:
    cd backend && uv run pytest -n8 -m "not slow"
    cd cli && uv run pytest -v
    cd site && npm run test:all
    cd frontend && npm run test:run

# Run Y.js collaboration E2E tests (requires 'just dev' running)
# Tests spawn multiple browsers and must run sequentially (--workers=1)
# Usage: just test-collab [browser] [reporter] (defaults: all browsers, line reporter)
test-collab browser="" reporter="line":
    #!/usr/bin/env bash
    cd frontend
    if [ -n "{{browser}}" ]; then
        npx playwright test --grep "@collab" --project={{browser}} --reporter={{reporter}} --workers=1
    else
        npx playwright test --grep "@collab" --reporter={{reporter}} --workers=1
    fi

# Run E2E content tests (files, versions, rendering)
test-e2e-content:
    cd frontend && npx playwright test src/tests/e2e/content/ --grep "@auth" --reporter=line

# Run E2E interface tests (account, navigation, settings)
test-e2e-interface:
    cd frontend && npx playwright test src/tests/e2e/interface/ --grep "@auth" --reporter=line

# Run all E2E auth tests (content + interface)
test-e2e:
    just test-e2e-content
    just test-e2e-interface

# Run all linters
lint:
    cd backend && uv run ruff check --fix
    cd backend && uv run mypy aris/
    cd cli && uv run ruff check --fix
    cd cli && uv run mypy .
    cd site && npm run lint
    cd frontend && npm run lint

# Run lint then test
check:
    just lint
    just test

# Development Setup
# =================

# Initial setup for new development environment
init:
    @echo "Setting up development environment..."
    @if [ ! -f .env ]; then echo "Copying .env.example to .env"; cp .env.example .env; echo "Please edit .env with your desired configuration"; else echo ".env already exists"; fi
    @if [ ! -f frontend/.env ]; then echo "Copying frontend/.env.example to frontend/.env"; cp frontend/.env.example frontend/.env; else echo "frontend/.env already exists"; fi
    @if [ ! -f site/.env ]; then echo "Copying site/.env.example to site/.env"; cp site/.env.example site/.env; else echo "site/.env already exists"; fi
    @if [ ! -f docker/backend/.env ]; then echo "Copying docker/backend/.env.example to docker/backend/.env"; cp docker/backend/.env.example docker/backend/.env; else echo "docker/backend/.env already exists"; fi
    cd backend && uv sync --all-groups
    cd backend && if [ -d "../../rsm" ]; then uv pip install -e ../../rsm; echo "Installed local RSM package"; else echo "No local RSM found, using PyPI version"; fi
    cd frontend && npm install
    cd site && npm install
    cd cli && uv sync
    @echo "Setup complete! Edit .env files if needed, then run 'just dev' to start"

# Deployment Commands
# ===================

# Deploy all services (backend to Fly.io, frontend/site via git push)
deploy:
    @echo "🚀 Deploying all services..."
    @echo ""
    just deploy-backend
    @echo ""
    just deploy-netlify
    @echo ""
    @echo "✅ Deployment complete!"

# Deploy only backend to Fly.io
deploy-backend:
    @echo "🚀 Deploying backend to Fly.io..."
    cd .. && fly deploy --config studio/backend/fly.toml --dockerfile studio/backend/Dockerfile
    @echo "✅ Backend deployed: https://aris-backend.fly.dev"

# Push to GitHub to trigger Netlify deployments
deploy-netlify:
    @echo "🚀 Pushing to GitHub to trigger Netlify deployments..."
    git push origin main
    @echo "✅ Pushed to GitHub"
    @echo "   - Frontend: https://app.rsm.studio"
    @echo "   - Site: https://rsm.studio"
    @echo "⏳ Netlify builds typically take 2-3 minutes"

# Utility Commands
# ================

# Check container status
status:
    docker compose -p $(basename $(pwd)) ps

# Show environment configuration
env:
    @echo "Current environment configuration:"
    @if [ -f .env ]; then cat .env; else echo "No .env file found"; fi

# Rebuild frontend-test with fresh environment variables
# Use this when environment variables change and aren't propagating
rebuild-frontend-test:
    @echo "🔄 Rebuilding frontend-test with fresh environment..."
    @echo "1. Stopping and removing container + volumes..."
    docker compose -p $(basename $(pwd)) -f docker/docker-compose.dev.yml down frontend-test -v
    @echo "2. Rebuilding image..."
    docker compose -p $(basename $(pwd)) -f docker/docker-compose.dev.yml build frontend-test
    @echo "3. Starting fresh container..."
    docker compose -p $(basename $(pwd)) -f docker/docker-compose.dev.yml up -d frontend-test
    @echo "4. Waiting for container to be ready..."
    sleep 3
    @echo "✅ Rebuild complete!"
    @echo ""
    @echo "⚠️  IMPORTANT: Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R)"
    @echo "    Or open DevTools > Network tab > Check 'Disable cache' > Refresh"
    @echo ""
    @echo "🔍 Verify the new environment variable:"
    @echo "    docker exec docker-frontend-test-1 printenv | grep VITE"
    @osascript -e "display notification \"Frontend-test rebuilt. Hard refresh your browser!\" with title \"Claude Code\""

# Versioning & Release
# ====================

# Generate a CHANGELOG entry for the given version and prepend to CHANGELOG.md.
# If no version is given, uses "Unreleased".
changelog version="Unreleased":
    #!/usr/bin/env bash
    set -euo pipefail
    VERSION="{{version}}"
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -z "$LAST_TAG" ]; then COMMITS=$(git log --oneline --no-merges); else COMMITS=$(git log --oneline --no-merges "${LAST_TAG}..HEAD"); fi
    DATE=$(date +%Y-%m-%d)
    PROMPT="Generate a CHANGELOG entry for version $VERSION (date: $DATE). Commits since last tag: $COMMITS. Rules: Skip ci/test/chore/docs commits and submodule updates. Group into Keep-a-Changelog sections: Added (feat:), Fixed (fix:), Changed (other). Rewrite as user-friendly prose. Omit empty sections. If no user-visible changes output: _No user-visible changes._ Output only raw markdown (no preamble, no code fences): ## [$VERSION] - $DATE, then ### Added, ### Fixed, ### Changed sections as needed."
    entry=$(claude --print "$PROMPT")
    if [ -f CHANGELOG.md ]; then { head -1 CHANGELOG.md; printf "\n%s\n" "$entry"; tail -n +2 CHANGELOG.md; } > CHANGELOG.tmp && mv CHANGELOG.tmp CHANGELOG.md; else printf "# Changelog\n\n%s\n" "$entry" > CHANGELOG.md; fi
    echo "==> CHANGELOG.md updated for $VERSION"

# Release: bump version, generate changelog, tag, push
# Usage: just release <major|minor|patch>
release level:
    #!/usr/bin/env bash
    set -euo pipefail

    LEVEL="{{level}}"
    if [[ "$LEVEL" != "major" && "$LEVEL" != "minor" && "$LEVEL" != "patch" ]]; then
        echo "Error: level must be 'major', 'minor', or 'patch', got '$LEVEL'"
        exit 1
    fi

    CURRENT=$(node -p "require('./package.json').version")
    IFS='.' read -r major minor patch <<< "$CURRENT"
    case "$LEVEL" in
        major) major=$((major + 1)); minor=0; patch=0 ;;
        minor) minor=$((minor + 1)); patch=0 ;;
        patch) patch=$((patch + 1)) ;;
    esac
    NEXT="${major}.${minor}.${patch}"

    echo "==> Bumping $CURRENT -> $NEXT"
    node -e "const p=require('./package.json'); p.version='$NEXT'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n')"

    echo "==> Generating changelog"
    just changelog "$NEXT"

    git add package.json CHANGELOG.md
    git commit -m "Release v${NEXT}"
    git tag "v${NEXT}"
    git push origin main --tags

    echo "==> Released v${NEXT}"
