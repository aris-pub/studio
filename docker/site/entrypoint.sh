#!/bin/sh
set -e

# nuxt prepare generates .nuxt/ (types, virtual modules) which nuxt dev requires.
# It is normally run by postinstall, but --ignore-scripts skips it during docker build.
# It must run at startup (not build time) because the volume mount overlays the build layer.
pnpm exec nuxt prepare

exec pnpm run dev
