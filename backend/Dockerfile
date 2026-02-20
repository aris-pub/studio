# Multi-stage build for production deployment with supervisord
# Stage 1: Build Node.js services (multiplayer + rsm-lsp)
FROM node:20-slim AS node-builder

WORKDIR /build

# Build multiplayer server
COPY multi-player/package*.json ./multi-player/
RUN cd multi-player && npm ci --omit=dev

# Build rsm-lsp server
COPY rsm/packages/rsm-lsp/package*.json ./rsm-lsp/
COPY rsm/tree-sitter-rsm ./tree-sitter-rsm/
RUN cd rsm-lsp && npm ci --omit=dev

COPY multi-player/ ./multi-player/
COPY rsm/packages/rsm-lsp/ ./rsm-lsp/

# Build rsm-lsp TypeScript
RUN cd rsm-lsp && npm run build

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
COPY backend/ .
COPY styles/ ./styles

# Remove local sources section from pyproject.toml for production build
# This allows PROD to use PyPI while dev/CI use local rsm
RUN sed -i '/^\[tool\.uv\.sources\]/,/^$/d' pyproject.toml

# Install Python dependencies
RUN uv sync --frozen --no-cache
ENV PATH="/app/.venv/bin:$PATH"

# Copy Node.js services from builder stage
COPY --from=node-builder /build/multi-player /app/multi-player
COPY --from=node-builder /build/rsm-lsp /app/rsm-lsp
COPY --from=node-builder /build/tree-sitter-rsm /app/tree-sitter-rsm

# Copy supervisord configuration
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/health-check.sh /usr/local/bin/health-check.sh
RUN chmod +x /usr/local/bin/health-check.sh

# Expose ports: 8080 (HTTP), 1234 (WebSocket)
EXPOSE 8080 1234

# Run database migrations and start supervisord
CMD ["sh", "-c", "alembic upgrade head && supervisord -c /etc/supervisor/conf.d/supervisord.conf"]
