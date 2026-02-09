# Docker Development Troubleshooting

## Common Issues & Solutions

### 🔌 Port Conflicts

**Problem**: `Error: Port 8000 is already in use`

**Solutions**:
1. **Check your `.env` file** - ensure ports are not in use
2. **Kill existing processes**:
   ```bash
   lsof -ti:8000 | xargs kill -9  # Replace 8000 with your port
   ```
3. **Check Docker containers**:
   ```bash
   docker ps  # See what's running
   docker stop $(docker ps -q)  # Stop all containers
   ```

### 🗄️ Database Connection Issues

**Problem**: `ConnectionRefusedError: Connection refused`

**Solutions**:
1. **Check PostgreSQL container health**:
   ```bash
   docker compose -f docker-compose.dev.yml ps
   # postgres should show "healthy"
   ```

2. **Verify environment variables**:
   ```bash
   docker compose -f docker-compose.dev.yml exec backend env | grep DB
   ```

3. **Check database logs**:
   ```bash
   docker compose -f docker-compose.dev.yml logs postgres
   ```

4. **Test direct connection**:
   ```bash
   docker compose -f docker-compose.dev.yml exec postgres psql -U aris -d aris -c "SELECT 1;"
   ```

### 🔄 File Changes Not Syncing

**Problem**: Code changes don't appear in running containers

**Solutions**:
1. **Verify volume mounts**:
   ```bash
   docker compose -f docker-compose.dev.yml config
   # Check volumes section shows correct paths
   ```

2. **Check file permissions**:
   ```bash
   ls -la ../backend ../frontend
   # Ensure you own the files
   ```

3. **Restart containers**:
   ```bash
   docker compose -f docker-compose.dev.yml restart
   ```

### 🐛 Migration Failures

**Problem**: Alembic migrations fail on startup

**Solutions**:
1. **Check migration logs**:
   ```bash
   docker compose -f docker-compose.dev.yml logs backend | grep alembic
   ```

2. **Manual migration**:
   ```bash
   docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
   ```

3. **Reset database** (⚠️ destroys data):
   ```bash
   docker compose -f docker-compose.dev.yml down -v
   docker compose -f docker-compose.dev.yml up --build
   ```

### 📦 Build Issues

**Problem**: `Docker build failed`

**Solutions**:
1. **Clean Docker cache**:
   ```bash
   docker system prune -a
   ```

2. **Rebuild without cache**:
   ```bash
   docker compose -f docker-compose.dev.yml build --no-cache
   ```

3. **Check Dockerfile syntax**:
   ```bash
   docker build -f docker/backend/Dockerfile.dev ../backend
   ```

### 🌐 Frontend Issues

**Problem**: Frontend not accessible or showing errors

**Solutions**:
1. **Check Vite logs**:
   ```bash
   docker compose -f docker-compose.dev.yml logs frontend
   ```

2. **Verify environment variables**:
   ```bash
   docker compose -f docker-compose.dev.yml exec frontend env | grep VITE
   ```

3. **Test backend connectivity**:
   ```bash
   curl http://localhost:8000/health
   ```

### 🔐 Permission Issues

**Problem**: Permission denied errors in containers

**Solutions**:
1. **Fix file ownership**:
   ```bash
   sudo chown -R $USER:$USER ../backend ../frontend
   ```

2. **Check Docker daemon permissions**:
   ```bash
   groups $USER  # Should include 'docker'
   sudo usermod -aG docker $USER  # Add if missing
   ```

### 💾 Data Persistence Issues

**Problem**: Data disappears between container restarts

**Solutions**:
1. **Check volume status**:
   ```bash
   docker volume ls
   docker volume inspect docker_postgres_data
   ```

2. **Backup important data**:
   ```bash
   docker compose -f docker-compose.dev.yml exec postgres pg_dump -U aris aris > backup.sql
   ```

3. **Verify volume mounts** in `docker-compose.dev.yml`

## 🔍 Debugging Commands

### Container Information
```bash
# Service status
docker compose -f docker-compose.dev.yml ps

# View all logs
docker compose -f docker-compose.dev.yml logs

# Follow specific service logs
docker compose -f docker-compose.dev.yml logs -f backend

# Execute commands in containers
docker compose -f docker-compose.dev.yml exec backend bash
docker compose -f docker-compose.dev.yml exec frontend sh
```

### Network Debugging
```bash
# Test container connectivity
docker compose -f docker-compose.dev.yml exec backend ping postgres
docker compose -f docker-compose.dev.yml exec frontend ping backend

# Check exposed ports
docker compose -f docker-compose.dev.yml port frontend 5173
docker compose -f docker-compose.dev.yml port backend 8000
```

### Database Debugging
```bash
# Connect to database
docker compose -f docker-compose.dev.yml exec postgres psql -U aris -d aris

# Check database contents
docker compose -f docker-compose.dev.yml exec postgres psql -U aris -d aris -c "\dt"

# View recent migrations
docker compose -f docker-compose.dev.yml exec postgres psql -U aris -d aris -c "SELECT * FROM alembic_version;"
```

## 🆘 Getting Help

If none of these solutions work:

1. **Check the main README**: `docker/README.md`
2. **Search existing issues**: GitHub repository issues
3. **Clean slate approach**:
   ```bash
   docker compose -f docker-compose.dev.yml down -v
   docker system prune -a
   docker compose -f docker-compose.dev.yml up --build
   ```

4. **Gather debug information**:
   ```bash
   docker --version
   docker compose version
   docker compose -f docker-compose.dev.yml config
   docker compose -f docker-compose.dev.yml logs > debug.log
   ```