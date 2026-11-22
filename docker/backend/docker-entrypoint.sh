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

# Dependency install (uv sync + tree-sitter-rsm Linux build + rsm-lsp build).
#
# In the dev image these run here at startup because /workspace/rsm is bind-mounted
# from the host and can change between runs. In the CI/prod image everything below
# is already baked into image layers at build time, so SKIP_DEP_INSTALL=1 is set and
# this whole block is skipped (startup is then just migrations + uvicorn).
if [ "$SKIP_DEP_INSTALL" = "1" ]; then
  echo "Dependencies baked into image - skipping startup install"
else

# Build RSM from local source for Linux (dev server only, not tests)
#
# /workspace/rsm is the host's rsm checkout. The grammar's compiled files have
# the same names on macOS and Linux (_binding.abi3.so, build/Release/...), so the
# container must not write them into the shared tree-sitter-rsm folder:
#   - The backend installs rsm-lang editable, but tree-sitter-rsm as a normal
#     (non-editable) install. An editable install would compile _binding.abi3.so
#     next to the host's copy and overwrite it. The normal install leaves only
#     Linux-named folders under tree-sitter-rsm/build.
#   - rsm-lsp loads the grammar from its node_modules, which is a container-only
#     volume (docker-compose.dev.yml). npm links that entry to the shared folder,
#     so it is replaced with a packed copy, and the addon is compiled in there.
#
# Tests run locally on macOS (not in Docker), so they use the host's files.
CACHE_DIR="/workspace/studio/.entrypoint-cache"
mkdir -p "$CACHE_DIR"
TS_RSM_DIR="/workspace/rsm/tree-sitter-rsm"
LSP_DIR="/workspace/rsm/packages/rsm-lsp"
GRAMMAR_SRC_HASH=$(md5sum "$TS_RSM_DIR/src/parser.c" "$TS_RSM_DIR/src/scanner.c" "$TS_RSM_DIR/bindings/node/binding.cc" "$TS_RSM_DIR/bindings/python/tree_sitter_rsm/binding.c" 2>/dev/null | md5sum | cut -d' ' -f1)

if [ -d "/workspace/rsm" ] && [ -f "/workspace/rsm/pyproject.toml" ]; then
    # Python deps: only re-sync when lockfiles or the grammar change
    RSM_LOCK_HASH=$(md5sum /workspace/rsm/uv.lock 2>/dev/null | cut -d' ' -f1)
    BACKEND_LOCK_HASH=$(md5sum /workspace/studio/backend/uv.lock 2>/dev/null | cut -d' ' -f1)
    COMBINED_HASH="${RSM_LOCK_HASH}-${BACKEND_LOCK_HASH}-${GRAMMAR_SRC_HASH}"

    if [ "$(cat "$CACHE_DIR/python-deps" 2>/dev/null)" != "$COMBINED_HASH" ]; then
        echo "Syncing Python dependencies..."
        cd /workspace/studio/backend
        uv sync --all-groups --quiet --no-install-package tree-sitter-rsm
        uv pip install --quiet --no-deps --reinstall "$TS_RSM_DIR"
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

# Install rsm-lsp's packages with the grammar's Node addon compiled for Linux.
if [ -d "$LSP_DIR" ]; then
    ARCH=$(uname -m)
    ADDON="$LSP_DIR/node_modules/tree-sitter-rsm/build/Release/tree_sitter_rsm_binding.node"

    cd "$LSP_DIR"
    if [ ! -f "$ADDON" ] || [ "$(cat "$CACHE_DIR/tree-sitter-$ARCH" 2>/dev/null)" != "$GRAMMAR_SRC_HASH" ]; then
        echo "Installing rsm-lsp packages and building the tree-sitter-rsm addon for Linux..."
        # Without --ignore-scripts, npm would compile the addon in the shared folder.
        npm ci --quiet --ignore-scripts
        PACKED=$(cd "$TS_RSM_DIR" && npm pack --silent --ignore-scripts --pack-destination /tmp)
        rm node_modules/tree-sitter-rsm
        mkdir node_modules/tree-sitter-rsm
        tar -xzf "/tmp/$PACKED" --strip-components=1 -C node_modules/tree-sitter-rsm
        rm "/tmp/$PACKED"
        npm rebuild --quiet
        echo "$GRAMMAR_SRC_HASH" > "$CACHE_DIR/tree-sitter-$ARCH"
    else
        echo "rsm-lsp packages and tree-sitter-rsm addon up to date (cached)"
    fi

    LSP_SRC_HASH=$(find "$LSP_DIR/src" -name '*.ts' -exec md5sum {} + 2>/dev/null | sort | md5sum | cut -d' ' -f1)
    if [ ! -f "$LSP_DIR/dist/server.js" ] || [ "$(cat "$CACHE_DIR/rsm-lsp" 2>/dev/null)" != "$LSP_SRC_HASH" ]; then
        echo "Building rsm-lsp server..."
        npm run build --quiet
        echo "$LSP_SRC_HASH" > "$CACHE_DIR/rsm-lsp"
    else
        echo "rsm-lsp build up to date (cached)"
    fi

    cd /workspace/studio/backend
fi

fi  # end SKIP_DEP_INSTALL guard

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