#!/bin/sh
set -e

# Install platform-specific optional dependencies
# These are needed for Vite/Rollup/esbuild but aren't installed with --ignore-scripts
# We install them here (after volume mount) rather than in Dockerfile
echo "Installing platform-specific dependencies..."
pnpm add --save-dev @rollup/rollup-linux-arm64-musl @esbuild/linux-arm64 || true

# For frontend-test: Remove .env file so docker-compose env vars take precedence
# Vite loads .env files which override environment variables, but we want
# frontend-test to use VITE_API_BASE_URL from docker-compose (backend-test)
echo "DEBUG: VITE_API_BASE_URL=$VITE_API_BASE_URL"
echo "DEBUG: .env exists=$(test -f ../.env && echo yes || echo no)"
if [ "$VITE_API_BASE_URL" = "http://localhost:8001" ]; then
  if [ -f "../.env" ]; then
    echo "🧪 Test environment detected - removing .env to use docker-compose env vars"
    rm -f ../.env
    echo "DEBUG: .env removed=$(test -f ../.env && echo no-still-there || echo yes-deleted)"
  else
    echo "DEBUG: .env file not found"
  fi
else
  echo "DEBUG: Not test environment (VITE_API_BASE_URL != http://localhost:8001)"
fi

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
