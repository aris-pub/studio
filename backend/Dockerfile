# Multi-stage build for production deployment with supervisord
# Stage 1: Build Node.js services (multiplayer + rsm-lsp)
FROM node:20-slim AS node-builder

# Build tools for compiling tree-sitter-rsm native Node addon
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Build multiplayer server
COPY studio/multi-player/package*.json ./multi-player/
RUN cd multi-player && npm ci --omit=dev

# Mirror source tree layout so rsm-lsp's file:../../tree-sitter-rsm resolves correctly
COPY rsm/tree-sitter-rsm ./rsm/tree-sitter-rsm/

# Compile native bindings from source for the current platform
# (prebuilds from host may target a different architecture)
RUN cd rsm/tree-sitter-rsm && rm -rf prebuilds build \
    && npm install --ignore-scripts \
    && npx node-gyp rebuild

# Install rsm-lsp production deps (creates symlink for file: dep)
COPY rsm/packages/rsm-lsp/package*.json ./rsm/packages/rsm-lsp/
RUN cd rsm/packages/rsm-lsp && npm ci --omit=dev

# Copy source files for multiplayer and rsm-lsp
COPY studio/multi-player/ ./multi-player/
COPY rsm/packages/rsm-lsp/ ./rsm/packages/rsm-lsp/

# Restore tree-sitter-rsm in node_modules — the COPY above may have overwritten
# it with host files (wrong platform) or a broken symlink
RUN rm -rf rsm/packages/rsm-lsp/node_modules/tree-sitter-rsm \
    && cp -r rsm/tree-sitter-rsm rsm/packages/rsm-lsp/node_modules/tree-sitter-rsm

# Build rsm-lsp TypeScript
RUN cd rsm/packages/rsm-lsp && npm run build

# Stage 2: Python runtime + Node.js + supervisord
FROM python:3.13-slim AS runtime

# Install system dependencies including Node.js and supervisord
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

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy backend dependencies
COPY studio/backend/ .
COPY studio/styles/ ./styles

# Remove local sources section from pyproject.toml for production build
# This allows PROD to use PyPI packages (rsm-lang 1.0.0, tree-sitter-rsm 1.0.0)
RUN sed -i '/^\[tool\.uv\.sources\]/d; /^rsm-lang = /d' pyproject.toml

# Install Python dependencies (no --frozen since we removed local source)
RUN uv sync --no-cache
ENV PATH="/app/.venv/bin:$PATH"

# Copy Node.js services from builder stage (tree-sitter-rsm is embedded in rsm-lsp/node_modules)
COPY --from=node-builder /build/multi-player /app/multi-player
COPY --from=node-builder /build/rsm/packages/rsm-lsp /app/rsm-lsp

# Copy supervisord configuration
COPY studio/docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY studio/docker/health-check.sh /usr/local/bin/health-check.sh
RUN chmod +x /usr/local/bin/health-check.sh

# Expose ports: 8080 (HTTP), 1234 (WebSocket)
EXPOSE 8080 1234

# Run database migrations and start supervisord
CMD ["sh", "-c", "alembic upgrade head && supervisord -c /etc/supervisor/conf.d/supervisord.conf"]
