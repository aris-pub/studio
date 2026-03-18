#!/bin/sh
set -e

# nuxt prepare generates .nuxt/ (types, virtual modules) which nuxt dev requires.
# It is normally run by postinstall, but --ignore-scripts skips it during docker build.
# It must run at startup (not build time) because the volume mount overlays the build layer.
pnpm exec nuxt prepare

# Bind to all interfaces so the container is reachable via Docker port mapping
export NUXT_HOST=0.0.0.0
export NUXT_PORT=3000

# Run env check then start nuxt dev
node ../docker/env-check.js
exec pnpm exec nuxt dev
