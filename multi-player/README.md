# Y.js WebSocket Server

Pure WebSocket relay server for Y.js real-time collaboration. No persistence logic - the backend connects as a peer/client to handle database operations.

## Overview

This server implements the **backend-as-client pattern** where:
- Server is a pure message relay between clients
- All clients (frontend + backend) are treated equally
- No database or persistence logic in server
- Backend peer handles all persistence

## Architecture

```
┌─────────────────────────────────────────┐
│       Y.js WebSocket Server              │
│                                          │
│  - Receives messages from clients        │
│  - Broadcasts to all peers in room       │
│  - Maintains in-memory Y.Doc per room    │
│  - No database operations                │
│  - No persistence logic                  │
└──────┬──────────────────────┬────────────┘
       │                      │
   ┌───▼────┐          ┌──────▼─────┐
   │Frontend│          │  Backend   │
   │ Client │          │   Client   │
   │        │          │            │
   │ Edit   │          │ Observe    │
   │        │          │ Persist    │
   └────────┘          └────────────┘
```

## Server Implementation

### Core Logic

The server uses `y-websocket/bin/utils.setupWSConnection()` which handles:
- Client connection handshake
- Y.js sync protocol (SyncStep1, SyncStep2, Update)
- Message relay between peers
- In-memory Y.Doc storage per room
- Awareness protocol (optional)

### Room Naming

Rooms are named by file ID:
```
ws://localhost:1234/file-123
ws://localhost:1234/file-456
```

Each room has:
- One shared Y.Doc in server memory
- Multiple connected clients (frontends + backend)
- Isolated state (rooms don't interact)

### Document Lifecycle

1. **First client connects**
   - Server creates in-memory Y.Doc for room
   - Client sends SyncStep1 (their current state)
   - Server responds with SyncStep2 (merge state)

2. **Backend client connects**
   - Backend loads content from database
   - Backend inserts into Y.Doc
   - Backend sends SyncStep1 with DB content
   - Server merges backend state with existing Y.Doc

3. **Additional clients connect**
   - Server sends current Y.Doc state to new client
   - Client merges server state with their (empty) Y.Doc
   - Client now has up-to-date content

4. **Editing**
   - Client makes change in Y.Doc
   - Client sends Update message to server
   - Server broadcasts Update to all peers
   - All peers apply update to their Y.Doc
   - Backend peer persists merged state to database

5. **Client disconnects**
   - Server removes client from room
   - Y.Doc remains in memory (backend still connected)
   - Other clients continue editing

6. **All clients disconnect**
   - Server cleans up Y.Doc from memory
   - State is lost from server (acceptable - backend persisted to DB)
   - On reconnect, backend reloads from DB

## Running the Server

```bash
# Development
npm run dev

# Production
npm start

# With custom port
MULTIPLAYER_PORT=1234 npm start

# With custom host
HOST=0.0.0.0 MULTIPLAYER_PORT=1234 npm start
```

## Configuration

### Environment Variables

```bash
# Required
MULTIPLAYER_PORT=1234
HOST=0.0.0.0  # Or 127.0.0.1 for localhost only
```

### Docker Setup

```yaml
multiplayer:
  build:
    context: ./multi-player
  environment:
    - MULTIPLAYER_PORT=1234
    - HOST=0.0.0.0
  ports:
    - "1234:1234"
```

## Y.js Protocol

The server implements the standard y-websocket protocol:

### Message Format

```
[message_type: u8][payload: bytes]
```

Message types:
- `0x00` - Sync message (SyncStep1, SyncStep2, Update)
- `0x01` - Awareness message (cursor positions, user presence)

### Sync Process

**SyncStep1** (client → server):
```
Client sends their Y.Doc state vector
Server compares with its Y.Doc
Server determines missing updates
```

**SyncStep2** (server → client):
```
Server sends state vector + missing updates
Client applies updates to catch up
Client sends back any updates server is missing
```

**Update** (client → server → all clients):
```
Client makes edit
Client sends update to server
Server broadcasts update to all peers
Peers apply update to their Y.Doc
```

## Benefits of Backend-as-Client

### Simplicity
- Server has no database logic
- Server has no persistence concerns
- Server is a generic relay (works for any Y.js app)

### Reliability
- Server can restart without data loss (backend persists to DB)
- Backend can reconnect and reload from DB
- Multiple backend instances can connect (all sync via server)

### Scalability
- Server is stateless (just in-memory Y.Docs)
- Easy to horizontally scale
- No complex database connection pooling in server

### Development
- Frontend developers don't touch server
- Backend developers don't touch server
- Server is "set it and forget it"

## Monitoring

### Connection Logging

The server logs all client connections:

```
[Y.js Server] Running on 0.0.0.0:1234 (backend-as-client mode)
[Y.js Server] Client connected (total: 1)
[Y.js Server] Client connected (total: 2)
```

Check logs:
```bash
docker compose logs -f multiplayer
```

### Health Checks

No built-in health endpoint. Check logs for:
- Server started successfully
- No WebSocket errors
- Clients connecting

### Debugging

Enable verbose y-websocket logging:
```javascript
// In server.js (for debugging only)
process.env.DEBUG = 'y-websocket:*';
```

## Common Issues

### Server not starting
**Symptoms:** "MULTIPLAYER_PORT environment variable is required"

**Solution:**
```bash
# Check environment variables
docker compose exec multiplayer env | grep MULTIPLAYER

# Verify .env file has MULTIPLAYER_PORT=1234
cat .env | grep MULTIPLAYER_PORT
```

### Clients not connecting
**Symptoms:** Frontend shows "Disconnected" or "Connection failed"

**Solution:**
1. Check server is running: `docker compose ps multiplayer`
2. Check server logs: `docker compose logs multiplayer`
3. Verify frontend VITE_MULTIPLAYER_URL matches server URL
4. Test connection: `wscat -c ws://localhost:1234/test-room`

### Backend client not visible
**Symptoms:** Server shows 1 client (frontend), but backend should be client 2

**Solution:**
1. Check backend logs: `docker compose logs backend | grep collaboration`
2. Look for "WebSocket connected for file {id}"
3. Verify backend started collaboration: `manager.start_client(file_id)`
4. Check MULTIPLAYER_HOST and MULTIPLAYER_PORT in backend environment

### High memory usage
**Symptoms:** Server memory grows over time

**Cause:** Y.Docs accumulate edit history in memory

**Solution:**
- Y.js server cleans up rooms when all clients disconnect
- Backend should periodically reconnect to force cleanup
- Consider adding explicit cleanup endpoint if needed

### Messages not relaying
**Symptoms:** User A's edits don't appear in User B's editor

**Solution:**
1. Check both clients are in same room: `/file-{id}`
2. Verify server is broadcasting: check logs for "Client connected"
3. Test with minimal setup (2 frontends, no backend)
4. Check for JavaScript errors in browser console

## Testing

### Local Testing

1. Start server:
   ```bash
   cd multi-player
   npm install
   npm start
   ```

2. Connect test client:
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:1234/test-room
   ```

3. In another terminal, connect second client:
   ```bash
   wscat -c ws://localhost:1234/test-room
   ```

4. Send message in one client, should appear in other

### E2E Testing

The collaboration E2E tests verify server functionality:

```bash
cd frontend
npx playwright test yjs-multi-user.spec.js
```

Tests verify:
- Multiple clients can connect
- Edits sync between clients
- Backend persists changes
- Reconnection works

## Deployment

### Production Checklist

- [ ] Set `HOST=0.0.0.0` for external connections
- [ ] Configure firewall for port 1234
- [ ] Set up monitoring for WebSocket connections
- [ ] Consider rate limiting for connections
- [ ] Enable TLS for wss:// (use reverse proxy like nginx)

### Scaling

**Single Server:**
- Handles dozens of concurrent rooms
- Each room is independent
- Memory usage: ~1-5MB per active room

**Multiple Servers:**
- Load balance by file ID (e.g., file-123 always goes to server 1)
- OR use sticky sessions in load balancer
- Backend clients must connect to correct server

**Redis Backend (Optional):**
- y-websocket supports Redis for shared state
- Allows multiple servers to share Y.Docs
- Not currently implemented (adds complexity)

### Future: Hocuspocus

For production at scale, consider upgrading to **Hocuspocus**:
- Built on y-websocket
- Adds PostgreSQL persistence
- Authentication/authorization hooks
- Redis for multi-server scaling
- Webhooks for events

See: https://hocuspocus.dev

## Security

### Authentication

Server has **no authentication**. Access control is handled by:
- Backend verifies user permissions before connecting client
- Frontend only connects if user has VIEW permission
- Server trusts all connections (assumes backend did auth)

### Authorization

Server has **no authorization**. Room access is controlled by:
- Backend only starts client for authorized files
- Frontend only knows URLs for authorized files
- Room names are predictable (file-{id}) but require knowing file ID

### Recommendations

For production:
- Add authentication middleware to verify JWT tokens
- Rate limit connections per IP
- Monitor for suspicious connection patterns
- Consider encrypting room names (file-{hash(id)})

## Known Issues

### Document Cleanup

**Issue:** Y.Docs remain in memory until all clients disconnect

**Impact:** Long-lived rooms accumulate history and use more memory

**Workaround:** Backend disconnects periodically to force cleanup

**Future:** Add explicit cleanup API or TTL for inactive rooms

### No Persistence

**Issue:** If server crashes, in-memory Y.Docs are lost

**Impact:** Clients must reconnect and resync from backend

**Workaround:** Backend immediately reconnects and reloads from DB

**Future:** Optional Redis persistence for high-availability

### Binary Protocol

**Issue:** Protocol is binary, hard to debug without tools

**Impact:** Can't easily inspect messages

**Workaround:** Use Y.js debug logging or y-websocket verbose mode

**Future:** Consider JSON protocol for development mode

## Why Not Custom OT Server?

This used to be a custom Operational Transformation server. We switched to y-websocket because:
- Y.js client libraries expect Y.js binary protocol
- Custom OT server expected CodeMirror ChangeSet JSON
- Protocol mismatch caused "RangeError: Applying change set to a document with the wrong length"
- Official y-websocket is battle-tested (used by Notion, Linear, etc.)

## Code Size

The entire server is **59 lines of code** (including comments and error handling). y-websocket handles everything else.

## References

- [y-websocket Documentation](https://github.com/yjs/y-websocket)
- [Y.js Wire Protocol](https://github.com/yjs/y-protocols)
- [setupWSConnection Source](https://github.com/yjs/y-websocket/blob/master/bin/utils.js)
- [Aris Backend-as-Client](../backend/aris/collaboration/README.md)
