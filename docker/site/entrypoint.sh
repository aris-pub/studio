#!/bin/sh
set -e

# nuxt prepare generates .nuxt/ (types, virtual modules) which nuxt dev requires.
# It is normally run by postinstall, but --ignore-scripts skips it during docker build.
# It must run at startup (not build time) because the volume mount overlays the build layer.
pnpm exec nuxt prepare

# Run env check then start nuxt dev bound to all interfaces
node ../docker/env-check.js
exec pnpm exec nuxt dev --host 0.0.0.0 --port 3000
