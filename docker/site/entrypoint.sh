#!/bin/sh
set -e

# nuxt prepare generates .nuxt/ (types, virtual modules) which nuxt dev requires.
# It is normally run by postinstall, but --ignore-scripts skips it during docker build.
# It must run at startup (not build time) because the volume mount overlays the build layer.
pnpm exec nuxt prepare

# Override SITE_PORT for container-internal use.
# docker-compose maps host SITE_PORT (2999) to container SITE_CONTAINER_PORT (3000),
# but nuxt.config.ts reads SITE_PORT for its listen port. Inside the container,
# nuxt must listen on 3000 (the container port), not 2999 (the host port).
export SITE_PORT=${SITE_CONTAINER_PORT:-3000}

# Run env check then start nuxt dev
node ../docker/env-check.js
exec pnpm exec nuxt dev
