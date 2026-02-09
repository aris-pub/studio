#!/bin/sh
set -e

# Install dependencies if node_modules is empty or missing
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "Installing dependencies..."
    npm ci
else
    echo "Dependencies already installed"
fi

# Start the application
echo "Starting Y.js WebSocket server..."
exec "$@"
