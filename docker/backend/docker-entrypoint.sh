#!/bin/bash
set -e

# Wait for database to be ready
echo "Waiting for database to be ready..."
until pg_isready -h postgres -p 5432 -U postgres; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready!"

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

# Run migrations
echo "Running database migrations..."
uv run alembic upgrade head

# Reset test user to known state (matches CI setup)
echo "Setting up test user..."
uv run python scripts/reset_test_user.py || echo "Warning: Could not reset test user (may not be an issue in production)"

# Start the application
echo "Starting FastAPI application..."
exec "$@"