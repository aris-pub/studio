#!/bin/bash
# Health check script for multi-service container
# Verifies that critical services (backend, multiplayer) are running
# NOTE: LSP excluded until tree-sitter-rsm native bindings work in production

set -e

# Check if supervisorctl is available
if ! command -v supervisorctl &> /dev/null; then
    echo "ERROR: supervisorctl not found"
    exit 1
fi

# Get status of all programs (|| true because supervisorctl exits non-zero if any service is not RUNNING)
STATUS=$(supervisorctl -c /etc/supervisor/conf.d/supervisord.conf status 2>&1 || true)

# Check each service
check_service() {
    local service=$1
    if echo "$STATUS" | grep -q "^${service}.*RUNNING"; then
        return 0
    else
        echo "ERROR: $service is not running"
        echo "$STATUS" | grep "^${service}"
        return 1
    fi
}

# Check all services
FAILED=0
check_service "backend" || FAILED=1
check_service "multiplayer" || FAILED=1

if [ $FAILED -eq 0 ]; then
    echo "All services are healthy"
    exit 0
else
    echo "Some services are not running"
    exit 1
fi
