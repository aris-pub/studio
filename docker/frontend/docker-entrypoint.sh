#!/bin/sh
set -e

# Install platform-specific optional dependencies
# These are needed for Vite/Rollup/esbuild but aren't installed with --ignore-scripts
# We install them here (after volume mount) rather than in Dockerfile
echo "Installing platform-specific dependencies..."
npm install --no-save --no-audit --no-fund @rollup/rollup-linux-arm64-musl @esbuild/linux-arm64 || true

# Patch y-codemirror.next to fix "update in progress" bug
echo "Patching y-codemirror.next..."
if [ -d "node_modules/y-codemirror.next" ]; then
  echo "Found y-codemirror.next, checking structure..."
  ls -la node_modules/y-codemirror.next/ || true
  sh /app/scripts/patch-y-codemirror.sh || echo "Patch failed, continuing..."
else
  echo "Warning: y-codemirror.next not found, skipping patch"
fi

# Execute the command passed to docker run
exec "$@"
