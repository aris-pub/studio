# Aris Multi-Player Server

Minimal wrapper around y-websocket for real-time collaborative editing.

## What This Does

This server enables multiple users to edit the same document simultaneously using Y.js CRDT (Conflict-free Replicated Data Type).

## Architecture

- **Server**: Official y-websocket server (handles Y.js binary protocol)
- **Persistence**: In-memory (documents stored only while server is running)
- **Protocol**: Y.js binary protocol (NOT JSON, NOT CodeMirror OT)

## Running the Server

```bash
# Development
npm run dev

# Production
npm start

# With custom port
PORT=1234 npm start

# With custom host
HOST=0.0.0.0 PORT=1234 npm start
```

## Environment Variables

- `PORT` or `MULTIPLAYER_PORT` - WebSocket port (default: 1234)
- `HOST` - Host to bind to (default: 0.0.0.0)

## How It Works

1. Client opens document → Creates Y.Doc and Y.Text
2. Client connects to WebSocket server (this server)
3. Server creates in-memory document for room if doesn't exist
4. Y.js handles all synchronization automatically
5. Multiple clients in same room see real-time updates

## Production Considerations

For production, consider upgrading to **Hocuspocus** which adds:
- PostgreSQL persistence
- Authentication/authorization hooks
- Redis for scaling across multiple servers
- Webhooks for events

See: https://hocuspocus.dev

## Why Not Custom OT Server?

This used to be a custom Operational Transformation server. We switched to y-websocket because:
- Y.js client libraries expect Y.js binary protocol
- Custom OT server expected CodeMirror ChangeSet JSON
- Protocol mismatch caused "RangeError: Applying change set to a document with the wrong length"
- Official y-websocket is battle-tested (used by Notion, Linear, etc.)

## Code Size

The entire server is **17 lines of code**. y-websocket handles everything.
