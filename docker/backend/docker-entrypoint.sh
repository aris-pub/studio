#!/bin/bash
set -e

# Wait for database to be ready
echo "Waiting for database to be ready..."
until pg_isready -h postgres -p 5432 -U postgres; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready!"

# Install local RSM package if workspace exists (dev environment)
#
# IMPORTANT: The /workspace/rsm mount includes tree-sitter-rsm compiled binaries
# from the host machine (macOS .dylib/.so files). These binaries are architecture-
# specific and will fail when loaded in the Linux container with:
#   ImportError: invalid ELF header
#
# Solution:
#   1. Clean all host-compiled binaries from the mount (.so, .dylib, build/)
#   2. Install RSM in editable mode (which won't rebuild tree-sitter-rsm yet)
#   3. Force reinstall tree-sitter-rsm from PyPI to get Linux pre-built wheels
#
# This allows local RSM development while using Linux-compatible tree-sitter binaries.
if [ -d "/workspace/rsm" ] && [ -f "/workspace/rsm/pyproject.toml" ]; then
    echo "Cleaning macOS-compiled binaries from mounted RSM package..."
    find /workspace/rsm -name "*.so" -delete
    find /workspace/rsm -name "*.dylib" -delete
    rm -rf /workspace/rsm/tree-sitter-rsm/build/

    echo "Installing local RSM package in editable mode..."
    uv pip install -e /workspace/rsm

    echo "Installing tree-sitter-rsm with Linux pre-built wheels..."
    uv pip install --force-reinstall tree-sitter-rsm
fi

# Run migrations
echo "Running database migrations..."
alembic upgrade head

# Start the application
echo "Starting FastAPI application..."
exec "$@"