#!/bin/sh
set -e

# For frontend-test: Remove .env file so docker-compose env vars take precedence
# Vite loads .env files which override environment variables, but we want
# frontend-test to use VITE_API_BASE_URL from docker-compose (backend-test)
echo "DEBUG: VITE_API_BASE_URL=$VITE_API_BASE_URL"
echo "DEBUG: .env exists=$(test -f /workspace/.env && echo yes || echo no)"
if [ "$VITE_API_BASE_URL" = "http://localhost:8001" ]; then
  if [ -f "/workspace/.env" ]; then
    echo "Test environment detected - removing .env to use docker-compose env vars"
    rm -f /workspace/.env
  fi
fi

# Patch y-codemirror.next to fix echo prevention in Docker
echo "Patching y-codemirror.next for Docker echo prevention..."
# With hoisted node-linker, packages are in /workspace/node_modules/
YCODEMIRROR_DIR="/workspace/node_modules/y-codemirror.next"
if [ -d "$YCODEMIRROR_DIR" ]; then
  node /workspace/frontend/scripts/patch-y-codemirror.cjs
  if [ $? -ne 0 ]; then
    echo "CRITICAL: Patch failed! Cannot continue without patched y-codemirror.next"
    exit 1
  fi
else
  echo "CRITICAL: y-codemirror.next not found in node_modules"
  exit 1
fi

# Execute the command passed to docker run
exec "$@"
