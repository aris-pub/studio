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
    docker compose -p $(basename $(pwd)) -f docker/docker-compose.dev.yml down

# View logs for development containers
logs:
    docker compose -p $(basename $(pwd)) -f docker/docker-compose.dev.yml logs

# Testing Commands
# ================

# Run all tests
test:
    cd backend && uv run pytest -n8
    cd frontend && npm run test:all
    cd site && npm run test:all

# Run all linters
lint:
    cd backend && uv run ruff check --fix
    cd backend && uv run mypy aris/
    cd frontend && npm run lint
    cd site && npm run lint

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
    @echo "Setup complete! Edit .env files if needed, then run 'just dev' to start"

# Deployment Commands
# ===================

# Deploy all services (backend to Fly.io, frontend/site via git push)
deploy:
    @echo "🚀 Deploying all services..."
    @echo ""
    @echo "1️⃣  Deploying backend to Fly.io..."
    fly deploy --config backend/fly.toml
    @echo ""
    @echo "2️⃣  Pushing to GitHub to trigger Netlify deployments..."
    git push origin main
    @echo ""
    @echo "✅ Deployment complete!"
    @echo "   - Backend: https://aris-backend.fly.dev"
    @echo "   - Frontend: https://app.rsm.studio (deploys from main branch)"
    @echo "   - Site: https://rsm.studio (deploys from main branch)"
    @echo ""
    @echo "⏳ Netlify builds typically take 2-3 minutes"

# Deploy only backend to Fly.io
deploy-backend:
    @echo "🚀 Deploying backend to Fly.io..."
    fly deploy --config backend/fly.toml
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

# Send macOS notification
notify message:
    osascript -e "display notification \"{{message}}\" with title \"Claude Code\""
