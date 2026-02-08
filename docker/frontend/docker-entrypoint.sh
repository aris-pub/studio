#!/bin/sh
set -e

# Install platform-specific optional dependencies
# These are needed for Vite/Rollup/esbuild but aren't installed with --ignore-scripts
# We install them here (after volume mount) rather than in Dockerfile
echo "Installing platform-specific dependencies..."
npm install --no-save --no-audit --no-fund @rollup/rollup-linux-arm64-musl @esbuild/linux-arm64 || true

# Patch y-codemirror.next to fix echo prevention in Docker
echo "Patching y-codemirror.next for Docker echo prevention..."
if [ -d "node_modules/y-codemirror.next" ]; then
  node /app/scripts/patch-y-codemirror.cjs
  if [ $? -ne 0 ]; then
    echo "❌ CRITICAL: Patch failed! Cannot continue without patched y-codemirror.next"
    exit 1
  fi
else
  echo "❌ CRITICAL: y-codemirror.next not found in node_modules"
  exit 1
fi

# Execute the command passed to docker run
exec "$@"
