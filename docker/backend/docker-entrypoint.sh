#!/bin/bash
set -e

# Wait for database to be ready (skip for SQLite in TEST env)
if [ "$ENV" != "TEST" ]; then
  echo "Waiting for database to be ready..."
  until pg_isready -h postgres -p 5432 -U postgres; do
    echo "Database is unavailable - sleeping"
    sleep 1
  done
  echo "Database is ready!"
else
  echo "Using SQLite - skipping PostgreSQL wait"
fi

# Build RSM from local source for Linux (dev server only, not tests)
#
# IMPORTANT: The /workspace/rsm mount includes tree-sitter-rsm compiled binaries
# from the host machine (macOS). Python C extensions now use platform-specific
# filenames (py_limited_api=False), allowing macOS and Linux binaries to coexist:
#   - macOS: _binding.cpython-313-darwin.so
#   - Linux: _binding.cpython-313-aarch64-linux-gnu.so (or x86_64)
#
# Solution:
#   1. Build tree-sitter-rsm for Linux from local source (no cleaning needed)
#   2. Sync backend dependencies (which includes rsm-lang)
#
# Tests run locally on macOS (not in Docker), so no binary conflicts.
if [ -d "/workspace/rsm" ] && [ -f "/workspace/rsm/pyproject.toml" ]; then
    echo "Building tree-sitter-rsm for Linux from local source..."
    cd /workspace/rsm && uv sync --quiet

    echo "Syncing backend dependencies (includes local RSM)..."
    cd /workspace/studio/backend && uv sync --all-groups --quiet
fi

# Install Node.js dependencies for multiplayer and rsm-lsp
if [ -d "/workspace/studio/multi-player" ]; then
    echo "Installing multiplayer server dependencies..."
    cd /workspace/studio/multi-player
    if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
        npm ci --quiet
    else
        echo "Multiplayer dependencies already installed"
    fi
fi

if [ -d "/workspace/rsm/packages/rsm-lsp" ]; then
    # Build tree-sitter-rsm Node.js bindings for Linux first
    echo "Building tree-sitter-rsm Node.js bindings for Linux..."
    cd /workspace/rsm/tree-sitter-rsm
    # Always run npm ci to ensure correct versions from package-lock.json
    echo "Running npm ci for tree-sitter-rsm..."
    npm ci --foreground || { echo "ERROR: npm ci failed for tree-sitter-rsm"; exit 1; }
    # Rebuild native bindings for current platform
    echo "Rebuilding tree-sitter-rsm bindings..."
    npm rebuild || { echo "ERROR: npm rebuild failed for tree-sitter-rsm"; exit 1; }

    echo "Installing and building rsm-lsp server..."
    cd /workspace/rsm/packages/rsm-lsp
    # Always run npm ci to ensure correct versions from package-lock.json
    # This prevents stale dependencies from cached volumes/layers
    echo "Running npm ci for rsm-lsp..."
    npm ci --foreground || { echo "ERROR: npm ci failed for rsm-lsp"; exit 1; }
    echo "Building rsm-lsp TypeScript..."
    npm run build || { echo "ERROR: npm run build failed for rsm-lsp"; exit 1; }
    cd /workspace/studio/backend
    echo "RSM dependencies installation complete"
fi

# Run migrations
echo "Running database migrations..."
uv run alembic upgrade head

# Reset test user to known state (TEST and CI environments)
# This script deletes all test user data including files and versions!
# Runs in TEST (local E2E with SQLite) and CI (automated testing)
if [ "$ENV" = "TEST" ] || [ "$ENV" = "CI" ]; then
    echo "Test environment detected - resetting test user to known state..."
    uv run python scripts/reset_test_user.py
else
    echo "Skipping test user reset (only runs in TEST/CI environments)"
fi

# Start the application
echo "Starting FastAPI application..."
exec "$@"