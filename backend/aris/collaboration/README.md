# Backend-as-Client Architecture for Y.js Collaboration

## Overview

The backend acts as a Y.js client/peer that connects to the WebSocket server alongside frontend clients. This architecture eliminates complex persistence logic from the WebSocket server and treats the backend as just another collaborative peer.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Y.js WebSocket Server                     │
│                     (multi-player/)                          │
│                                                              │
│  - Pure message relay between clients                        │
│  - In-memory Y.Doc storage                                   │
│  - No database logic                                         │
│  - No persistence concerns                                   │
└──────────────┬────────────────────────────┬─────────────────┘
               │                            │
       ┌───────▼──────┐            ┌────────▼────────┐
       │   Frontend   │            │   Frontend      │
       │   Client 1   │            │   Client 2      │
       │              │            │                 │
       │ - CodeMirror │            │ - CodeMirror    │
       │ - Y.js Doc   │            │ - Y.js Doc      │
       │ - Edit only  │            │ - Edit only     │
       └──────────────┘            └─────────────────┘
               │                            │
               └─────────┬──────────────────┘
                         │
                  ┌──────▼──────┐
                  │   Backend   │
                  │   Client    │
                  │             │
                  │ - Y.js Doc  │
                  │ - Observer  │
                  │ - Persists  │
                  │   to DB     │
                  └─────┬───────┘
                        │
                  ┌─────▼────────┐
                  │  PostgreSQL  │
                  │   Database   │
                  └──────────────┘
```

## Message Flow

### Initial Connection

1. Frontend client connects to WebSocket server
2. Server creates in-memory Y.Doc for room `file-{id}`
3. Backend client connects to same room
4. Backend loads file content from database
5. Backend inserts content into Y.Text
6. Server syncs state between all clients
7. All clients now have identical Y.Doc state

### Editing Flow

1. User types in frontend CodeMirror editor
2. Change propagates to frontend Y.Doc
3. Frontend sends update to WebSocket server
4. Server relays update to all connected peers
5. Backend receives update via WebSocket
6. Backend Y.Doc applies update
7. Backend observer fires on Y.Text change
8. Backend debounces and persists to database (500ms)

### Multi-User Flow

1. Multiple frontend clients connect to same room
2. Each has independent CodeMirror + Y.Doc
3. All send updates through server
4. Server broadcasts to all peers (including backend)
5. Y.js CRDT algorithm resolves conflicts automatically
6. Backend persists merged state to database

## Components

### YDocClient (`yjs_client.py`)

A WebSocket client that connects to the Y.js server as a peer.

**Responsibilities:**
- Connect to WebSocket server for a specific file
- Load initial content from database
- Apply database content to Y.Doc
- Observe Y.Text changes
- Debounce and persist changes to database
- Reconnect on disconnection (exponential backoff)

**Key Methods:**
- `run()` - Main loop with auto-reconnection
- `_load_from_db()` - Initialize Y.Doc from database
- `_on_text_change()` - Observer callback for persistence
- `_save_to_db()` - Write Y.Text to database

**Configuration:**
- `debounce_ms` - Time to wait before persisting (default: 500ms)
- `websocket_url` - Full WS URL including room name
- `file_id` - Database file ID

### CollaborationManager (`manager.py`)

Manages multiple YDocClient instances for different files.

**Responsibilities:**
- Create clients on-demand when files are accessed
- Track active collaboration sessions
- Shutdown clients when no longer needed
- Provide global manager singleton

**Key Methods:**
- `start_client(file_id)` - Start collaboration for a file
- `stop_client(file_id)` - Stop collaboration for a file
- `is_running(file_id)` - Check if file has active client
- `get_active_files()` - List files with active collaboration
- `shutdown_all()` - Graceful shutdown of all clients

**Usage:**
```python
from aris.collaboration import get_collaboration_manager

manager = get_collaboration_manager()

# Start collaboration for file 123
await manager.start_client(123)

# Check if running
if manager.is_running(123):
    print("File 123 has active collaboration")

# Stop collaboration
await manager.stop_client(123)
```

## Dependencies

### Python Packages
- `pycrdt` - Python implementation of Y.js CRDT
- `websockets` - WebSocket client library
- `sqlalchemy` - Database access

### Y.js Protocol
The backend uses pycrdt's native sync protocol which is compatible with JavaScript y-websocket. Messages are exchanged using the y-websocket wire protocol:

```
[message_type: u8][payload: bytes]
```

Message types:
- `0x00` - Sync message (SyncStep1, SyncStep2, Update)
- `0x01` - Awareness message (not used by backend)

## Performance Considerations

### Memory Usage
- Each active file has one Y.Doc in backend memory
- Y.Doc size depends on document history (CRDT operations)
- Large documents with long edit histories use more memory
- Consider periodic cleanup or history truncation for very large files

### Database Writes
- Changes are debounced to avoid excessive writes
- Default debounce: 500ms
- Configurable per client
- Final state always saved on graceful shutdown

### Connection Management
- Backend maintains one WebSocket connection per active file
- Connections auto-reconnect on failure with exponential backoff
- Max reconnect delay: 60 seconds
- Connections persist as long as file is being edited

### Scalability
- Single backend instance can handle dozens of concurrent files
- For high traffic, consider:
  - Multiple backend instances (they'll all sync via Y.js server)
  - Load balancing across Y.js servers
  - Sharding files across backend instances

## Configuration

### Environment Variables

```bash
# Backend configuration
MULTIPLAYER_HOST=localhost
MULTIPLAYER_PORT=1234

# Database configuration (standard Aris config)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aris
DB_USER=postgres
DB_PASSWORD=postgres
```

### Docker Setup

The collaboration system requires three services:

1. **PostgreSQL** - Database for persistence
2. **Y.js Server** - WebSocket relay (multi-player/)
3. **Backend** - FastAPI with YDocClient instances

See `docker/docker-compose.dev.yml` for full configuration.

## Development Guide

### Testing Collaboration Locally

1. Start all services:
   ```bash
   just dev
   ```

2. Open file in editor:
   ```bash
   http://localhost:5173/file/{id}
   ```

3. Check backend logs for collaboration:
   ```bash
   docker compose logs -f backend | grep collaboration
   ```

4. Expected log sequence:
   ```
   [aris.collaboration] CollaborationManager initialized
   [aris.collaboration] Starting YDocClient for file 123
   [aris.collaboration] Connecting to ws://multiplayer:1234/file-123
   [aris.collaboration] WebSocket connected for file 123
   [aris.collaboration] Loaded 1234 chars from DB for file 123
   [aris.collaboration] Y.Text initialized for file 123
   [aris.collaboration] Sent SyncStep1 for file 123
   [aris.collaboration] Saved: 1250 chars to DB for file 123
   ```

### Debugging Backend Y.Doc State

Add debug logging to see Y.Doc content:

```python
from aris.collaboration import get_collaboration_manager

manager = get_collaboration_manager()
client = manager.clients.get(file_id)

if client and client.text:
    content = str(client.text)
    print(f"Y.Doc content ({len(content)} chars):", content[:100])
```

### Monitoring WebSocket Connections

Check active connections in Y.js server:

```bash
docker compose logs -f multiplayer | grep "Client connected"
```

Expected output:
```
[Y.js Server] Client connected (total: 1)  # Backend
[Y.js Server] Client connected (total: 2)  # Frontend user 1
[Y.js Server] Client connected (total: 3)  # Frontend user 2
```

### Testing Persistence

1. Edit content in frontend
2. Wait 500ms for debounce
3. Check database:
   ```sql
   SELECT id, LEFT(source, 100) FROM files WHERE id = {file_id};
   ```
4. Content should match frontend editor

### Common Issues

**Backend not connecting:**
- Check `MULTIPLAYER_HOST` and `MULTIPLAYER_PORT` environment variables
- Verify Y.js server is running: `docker compose ps multiplayer`
- Check backend logs for connection errors

**Content not persisting:**
- Check backend observer logs (should fire on every edit)
- Verify database connection: `docker compose exec backend uv run python -c "from aris.deps import ArisSession; import asyncio; asyncio.run(ArisSession().__aenter__())"`
- Confirm debounce is working (500ms delay expected)

**Duplicate content on load:**
- Backend should ONLY load from DB once per connection
- Check logs for "Loaded ... chars from DB" - should appear once
- If appearing multiple times, backend is reconnecting

**High memory usage:**
- Check number of active files: `manager.get_active_files()`
- Consider stopping unused clients: `manager.stop_client(file_id)`
- Monitor Y.Doc sizes in logs

## Comparison with Previous Architecture

### Before: Frontend Direct Persistence

```
Frontend → Database (via HTTP)
  ↓
File source updated directly
  ↓
No real-time sync between clients
```

**Problems:**
- Last-write-wins (data loss in multi-user scenarios)
- No real-time updates
- No conflict resolution
- Complex sync logic in frontend

### After: Backend-as-Client

```
Frontend → Y.js Server → Backend → Database
  ↑                          ↓
  └───────────────────────────┘
     (Y.js sync protocol)
```

**Benefits:**
- Conflict-free editing (Y.js CRDT)
- Real-time sync between all clients
- Backend handles all persistence
- Frontend only needs to edit
- Simple server (just relay)

## Future Enhancements

### Planned Features
- **Cursor awareness** - Show where other users are editing
- **Presence indicators** - Display active users
- **History/versions** - Leverage Y.js history for undo/redo
- **Offline support** - Queue updates when disconnected

### Optimization Opportunities
- **Connection pooling** - Reuse WebSocket connections
- **Compression** - Enable Y.js update compression
- **History pruning** - Periodically snapshot and reset Y.Doc history
- **Selective persistence** - Only persist changed files, not all on shutdown

## References

- [Y.js Documentation](https://docs.yjs.dev/)
- [pycrdt Documentation](https://github.com/jupyter-server/pycrdt)
- [y-websocket Protocol](https://github.com/yjs/y-websocket)
- [CRDT Overview](https://crdt.tech/)
