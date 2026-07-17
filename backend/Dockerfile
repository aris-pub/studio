# Multi-stage build for production deployment with supervisord.
#
# The build context is the studio repo. rsm is fetched at a pinned version via
# git (see the RSM_VERSION build arg), not COPYed from a local sibling checkout,
# so nothing outside studio/ is needed and the build never runs from ~/aris.
# Set the version in fly.toml [build.args] (and pass --build-arg for local builds).

# Stage 1: Build Node.js services (multiplayer + rsm-lsp)
FROM node:20-slim AS node-builder

# build-essential + python3 compile the tree-sitter-rsm native Node addon; git
# + ca-certificates fetch rsm at the pinned tag over HTTPS (node:slim ships no
# CA bundle, so git clone fails cert verification without ca-certificates).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Multiplayer server (lives in the studio repo)
COPY multi-player/package*.json ./multi-player/
RUN cd multi-player && npm ci --omit=dev
COPY multi-player/ ./multi-player/

# Fetch rsm at the pinned version instead of COPYing a local sibling. aris-pub/rsm
# and its tree-sitter-rsm submodule are public, so no credentials are needed.
# rsm-lsp depends on tree-sitter-rsm via file:../../tree-sitter-rsm, so it is
# built from inside the cloned monorepo layout. The version check turns a
# mismatched grammar into a build failure instead of silent version skew.
ARG RSM_VERSION
RUN git clone --depth 1 --branch "v${RSM_VERSION}" --recurse-submodules --shallow-submodules \
        https://github.com/aris-pub/rsm.git /rsm-src \
    && grep -q "^version = \"${RSM_VERSION}\"" /rsm-src/pyproject.toml \
       || { echo "rsm version mismatch: /rsm-src/pyproject.toml is not ${RSM_VERSION}"; exit 1; }

# Compile the tree-sitter-rsm native addon for linux (prebuilds may target a
# different arch; binding.gyp may be absent, regenerate it).
RUN cd /rsm-src/tree-sitter-rsm && rm -rf prebuilds build \
    && npm install --ignore-scripts \
    && if [ ! -f binding.gyp ]; then npx -y tree-sitter-cli generate; fi \
    && npx node-gyp rebuild

# Build rsm-lsp inside the monorepo so its file:../../tree-sitter-rsm resolves,
# then replace the installed addon with the freshly compiled one.
RUN cd /rsm-src/packages/rsm-lsp && npm ci \
    && rm -rf node_modules/tree-sitter-rsm \
    && cp -r /rsm-src/tree-sitter-rsm node_modules/tree-sitter-rsm \
    && npm run build

# Stage 2: Python runtime + Node.js + supervisord
FROM python:3.13-slim AS runtime

# System dependencies including Node.js and supervisord
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql-client \
        build-essential \
        pandoc \
        curl \
        supervisor \
        ca-certificates \
        gnupg \
        && rm -rf /var/lib/apt/lists/* \
        && apt-get clean

# Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Backend + styles (studio repo is the build context)
COPY backend/ .
# Never ship a .env in the image (std-mzhg). backend/.env may be present in the
# build context (other studio images COPY it), so strip it here rather than via
# the shared .dockerignore. Prod config comes only from Fly secrets + fly.toml
# [env] at runtime.
RUN rm -f .env .env.*
COPY styles/ ./styles

# Install Python dependencies from PyPI, pinned to the rsm release. The dev
# pyproject points rsm-lang at an editable ../../rsm checkout; strip that source
# override and pin the exact version so prod resolves rsm-lang (and its
# tree-sitter-rsm dependency) from PyPI, with no rsm checkout in the context.
ARG RSM_VERSION
RUN sed -i '/rsm-lang = { path =/d' pyproject.toml \
    && sed -i "s|rsm-lang>=[0-9.]*|rsm-lang==${RSM_VERSION}|" pyproject.toml \
    && rm -f uv.lock \
    && uv sync --no-cache
ENV PATH="/app/.venv/bin:$PATH"

# Node.js services from the builder stage (rsm-lsp bundles the compiled addon)
COPY --from=node-builder /build/multi-player /app/multi-player
COPY --from=node-builder /rsm-src/packages/rsm-lsp /app/rsm-lsp

# supervisord configuration (studio repo)
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/health-check.sh /usr/local/bin/health-check.sh
RUN chmod +x /usr/local/bin/health-check.sh

# Commit the image was built from, surfaced as the Sentry `release` tag by both
# the backend (inherits this env) and multiplayer (supervisord forwards it). Set
# via `--build-arg GIT_COMMIT=$(git rev-parse --short HEAD)` at deploy; defaults
# to "dev" so an un-plumbed build still resolves rather than reporting no release.
# Declared late so a changed commit only busts these cheap trailing layers, not
# the expensive uv sync / node build above.
ARG GIT_COMMIT=dev
ENV GIT_COMMIT=$GIT_COMMIT

# Expose ports: 8080 (HTTP), 1234 (WebSocket)
EXPOSE 8080 1234

# Run database migrations and start supervisord
CMD ["sh", "-c", "alembic upgrade head && supervisord -c /etc/supervisor/conf.d/supervisord.conf"]
