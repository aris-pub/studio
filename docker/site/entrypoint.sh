#!/bin/sh
set -e

# nuxt prepare generates .nuxt/ which nuxt dev requires.
pnpm exec nuxt prepare

# Match the old working CMD exactly: force port and host via CLI args
# and set SITE_PORT for env-check.js validation
export SITE_PORT=${SITE_CONTAINER_PORT:-3000}
node ../docker/env-check.js

exec npx nuxt dev --host 0.0.0.0 --port ${SITE_CONTAINER_PORT:-3000}
