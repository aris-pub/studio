FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY backend/ .
COPY styles/ ./styles

# Remove local sources section from pyproject.toml for production build
# This allows PROD to use PyPI while dev/CI use local rsm
RUN sed -i '/^\[tool\.uv\.sources\]/,/^$/d' pyproject.toml

RUN uv sync --frozen --no-cache
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8080
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8080"]
