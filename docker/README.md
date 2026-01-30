# Aris Docker Development Environment

This directory contains Docker-based development infrastructure for Aris.

## 🎯 Purpose

Provide containerized development environment with:
- **Production-like setup** with PostgreSQL database
- **Instant file sync** - edit locally, changes appear immediately in containers
- **Hot reloading** for both frontend (Vite) and backend (FastAPI)

## 📁 Directory Structure

```
docker/
├── README.md                 # This documentation
├── docker-compose.dev.yml    # Multi-service development stack
├── .env                      # Environment configuration
├── backend/
│   ├── Dockerfile.dev        # Backend development container
│   ├── docker-entrypoint.sh  # Database migration & startup script
│   └── init_test_db.sql      # Test database initialization
├── frontend/
│   └── Dockerfile.dev        # Frontend development container
├── multi-player/
│   └── Dockerfile.dev        # Multi-player collaboration server container
└── docs/
    └── troubleshooting.md    # Common issues & solutions
```

## 🚀 Quick Start

```bash
# Initial setup
just init

# Start the development stack
just dev
```

**Access your services:**
- 🌐 **Frontend**: http://localhost:5173
- 📚 **Storybook**: http://localhost:6006
- 🔧 **Backend API**: http://localhost:8000/docs
- 📊 **Health Check**: http://localhost:8000/health
- 🔌 **Multi-player Server**: ws://localhost:1234
- 🗄️ **Database**: localhost:5432

**Login credentials (auto-seeded):**
- 📧 **Email**: `foo@bar.com`
- 🔑 **Password**: `admin`

## 🏗️ Architecture

### Services

- **Backend**: FastAPI with hot reload, async PostgreSQL connection
- **Frontend**: Vue.js + Vite with hot module replacement
- **Storybook**: Component library and design system documentation
- **Multi-player**: Y.js WebSocket server for real-time collaboration
- **Database**: PostgreSQL 16 with automatic migrations and health checks

### Development Features

- **Volume Mounts**: Source code changes sync instantly
- **Database Migrations**: Run automatically on container startup
- **Auto-Seeding**: Pre-populated with user and sample data
- **Development Tools**: Built-in debuggers, dev servers, and monitoring

## 🎲 Auto-Seeding

Every fresh container automatically includes a complete development dataset:

### Pre-loaded User Account
- **Email**: `foo@bar.com`
- **Password**: `admin`
- **Name**: Leo Torres
- **Initials**: LT
- **Avatar Color**: Blue

### Sample Content
- **18 Files**: Realistic documents with actual RSM content, including mathematical notation and formatted text
- **18 Tags**: Various categories like 'math2', 'rsm', 'nb', 'journal', 'research', etc.
- **26 File-Tag Relationships**: Files properly categorized with multiple tags

### Data Persistence
- **Persistent Storage**: Data survives container restarts
- **Fresh Start Option**: Use `just stop && docker compose -f docker/docker-compose.dev.yml down -v` to reset to clean state

### Seeding Process
The auto-seeding happens automatically during container startup:
1. Database migrations run first
2. User and sample data inserted with conflict handling
3. Sequences updated to prevent ID conflicts
4. Application starts with ready-to-use data

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | 8000 | FastAPI server port |
| `FRONTEND_PORT` | 5173 | Vite dev server port |
| `STORYBOOK_PORT` | 6006 | Storybook server port |
| `MULTIPLAYER_PORT` | 1234 | Y.js WebSocket server port |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | aris | Database name |
| `TEST_DB_NAME` | aris_test | Test database name |

### File Synchronization

Your local source code is mounted into containers with instant sync:
- **Backend**: `../backend` → `/app` (Python FastAPI)
- **Frontend**: `../frontend` → `/app` (Vue.js + Vite)
- **Multi-player**: `../multi-player` → `/app` (Node.js WebSocket server)

Changes to your local files appear immediately in running containers.

## 📋 Common Commands

### Start Development Environment
```bash
just dev
```

### Stop Services
```bash
just stop
```

### View Logs
```bash
just logs [service-name]
```

### Check Status
```bash
just status
```

### Run Database Migrations
```bash
just migrate
```

### Rebuild After Dependency Changes
```bash
docker compose -f docker/docker-compose.dev.yml up --build
```

### Run Database Commands
```bash
# Connect to database
docker compose -f docker/docker-compose.dev.yml exec postgres psql -U aris -d aris

# Run backend commands
docker compose -f docker/docker-compose.dev.yml exec backend python -m pytest
```

## 🐛 Troubleshooting

### Port Already in Use
Check your `.env` file and ensure ports are not in use by other processes.

### Database Connection Issues
1. Verify PostgreSQL container is healthy: `docker compose ps`
2. Check environment variables match in both services
3. Ensure migrations completed: `docker compose logs backend`

### File Changes Not Syncing
1. Verify volume mounts in `docker-compose.dev.yml`
2. Check file permissions on host system
3. Restart containers if needed

## 🔄 Data Migration

### Export User Data
```bash
# Export specific user and related data
psql -d aris -c "COPY (...) TO STDOUT" > user_export.sql
```

### Import into Container
```bash
docker compose -f docker/docker-compose.dev.yml exec -T postgres psql -U aris -d aris < user_export.sql
```

## 📚 Related Documentation

- [Backend Setup](../backend/README.md)
- [Frontend Setup](../frontend/README.md)
- [CLAUDE.md](../.claude/CLAUDE.md) - Project development guidelines
