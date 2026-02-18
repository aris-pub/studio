# Y.js WebSocket Server

Pure WebSocket relay server for real-time collaboration. Broadcasts Y.js updates between all connected peers (frontend clients + backend client). No persistence logic — the backend peer handles all database operations.

## Stack

- Node.js
- `y-websocket` — handles sync protocol, message relay, in-memory Y.Doc per room

## Quick Start

```bash
npm install
npm run dev    # development
npm start      # production
```

## Config

```bash
MULTIPLAYER_PORT=1234
HOST=0.0.0.0
```

## Rooms

Each file gets its own room: `ws://localhost:1234/file-{id}`

## Troubleshooting

```bash
# Check connections
docker compose logs -f multiplayer

# Expected: one entry per connected client (backend + each frontend user)
[Y.js Server] Client connected (total: 2)
```

See [backend/aris/collaboration/README.md](../backend/aris/collaboration/README.md) for the full architecture.
