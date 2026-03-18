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
CACHE_DIR="/workspace/studio/.entrypoint-cache"
mkdir -p "$CACHE_DIR"

if [ -d "/workspace/rsm" ] && [ -f "/workspace/rsm/pyproject.toml" ]; then
    # Python deps: only re-sync when lockfiles change
    RSM_LOCK_HASH=$(md5sum /workspace/rsm/uv.lock 2>/dev/null | cut -d' ' -f1)
    BACKEND_LOCK_HASH=$(md5sum /workspace/studio/backend/uv.lock 2>/dev/null | cut -d' ' -f1)
    COMBINED_HASH="${RSM_LOCK_HASH}-${BACKEND_LOCK_HASH}"

    if [ "$(cat "$CACHE_DIR/python-deps" 2>/dev/null)" != "$COMBINED_HASH" ]; then
        echo "Syncing Python dependencies..."
        cd /workspace/rsm && uv sync --quiet
        cd /workspace/studio/backend && uv sync --all-groups --quiet
        echo "$COMBINED_HASH" > "$CACHE_DIR/python-deps"
    else
        echo "Python dependencies up to date (cached)"
    fi
fi

# Install Node.js dependencies for multiplayer (pre-installed in Docker image,
# anonymous volume preserves node_modules across bind mount)
if [ -d "/workspace/studio/multi-player" ]; then
    cd /workspace/studio/multi-player
    if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
        echo "Installing multiplayer server dependencies..."
        npm ci --quiet 2>/dev/null || npm install --quiet
    else
        echo "Multiplayer dependencies already installed"
    fi
fi

# Build RSM Node.js deps in parallel (tree-sitter + rsm-lsp are independent installs)
if [ -d "/workspace/rsm/packages/rsm-lsp" ]; then
    TS_RSM_DIR="/workspace/rsm/tree-sitter-rsm"
    LSP_DIR="/workspace/rsm/packages/rsm-lsp"
    ARCH=$(uname -m)

    # Install tree-sitter-rsm and rsm-lsp deps in parallel
    (
        cd "$TS_RSM_DIR"
        if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
            npm install --quiet
        fi
        TS_SRC_HASH=$(md5sum "$TS_RSM_DIR/src/parser.c" "$TS_RSM_DIR/src/scanner.c" "$TS_RSM_DIR/bindings/node/binding.cc" 2>/dev/null | md5sum | cut -d' ' -f1)
        if [ "$(cat "$CACHE_DIR/tree-sitter-$ARCH" 2>/dev/null)" != "$TS_SRC_HASH" ]; then
            echo "Building tree-sitter-rsm Node.js bindings for Linux..."
            npm rebuild --quiet
            npm run prebuildify --quiet
            echo "$TS_SRC_HASH" > "$CACHE_DIR/tree-sitter-$ARCH"
        else
            echo "tree-sitter-rsm native bindings up to date (cached)"
        fi
    ) &

    (
        cd "$LSP_DIR"
        if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
            npm install --quiet
        fi
    ) &

    wait

    # Build rsm-lsp after both installs complete (depends on tree-sitter-rsm)
    LSP_SRC_HASH=$(find "$LSP_DIR/src" -name '*.ts' -exec md5sum {} + 2>/dev/null | sort | md5sum | cut -d' ' -f1)
    cd "$LSP_DIR"
    if [ "$(cat "$CACHE_DIR/rsm-lsp" 2>/dev/null)" != "$LSP_SRC_HASH" ]; then
        echo "Building rsm-lsp server..."
        npm run build --quiet
        echo "$LSP_SRC_HASH" > "$CACHE_DIR/rsm-lsp"
    else
        echo "rsm-lsp build up to date (cached)"
    fi

    cd /workspace/studio/backend
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