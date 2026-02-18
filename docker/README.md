# Aris Docker Development Environment

Containerized development stack with hot reload for all services.

## Quick Start

```bash
just init   # first-time setup
just dev    # start all services
```

Services:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000/docs |
| Storybook | http://localhost:6006 |
| Multiplayer | ws://localhost:1234 |
| Database | localhost:5432 |

Default dev credentials: `foo@bar.com` / `admin`

## Common Commands

```bash
just dev      # start
just stop     # stop
just logs     # view logs
just status   # check status
just migrate  # run migrations

# Rebuild after dependency changes
docker compose -f docker/docker-compose.dev.yml up --build

# Connect to database
docker compose -f docker/docker-compose.dev.yml exec postgres psql -U aris -d aris
```

## Config

All env vars are defined in the root `.env` file (copied from `.env.example` via `just init`). Ports, database names, and service config all live there.

## Troubleshooting

See `docker/docs/troubleshooting.md` for common issues.

- **Port conflicts**: Check `.env` and ensure ports aren't in use
- **DB connection issues**: `docker compose ps` to verify postgres is healthy
- **File changes not syncing**: Check volume mounts in `docker-compose.dev.yml`
