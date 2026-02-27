# Backend Y.js Collaboration Client

The backend connects to the Y.js WebSocket server as a peer alongside frontend clients. On connection it syncs with the room first, then loads the file's content from the database only if the room is empty. Changes are observed and persisted back with a 500ms debounce.

## Sync Protocol

1. Backend connects to WebSocket room and completes Y.js sync (SyncStep1/SyncStep2)
2. If the room's Y.Doc is empty after sync, backend loads content from the database
3. After DB load, the update is broadcast to all connected clients via a SyncUpdate message
4. All subsequent changes (local or remote) are persisted to the database with 500ms debounce

This order prevents CRDT duplication: if the room already has content (e.g. from frontend edits), the backend does not re-insert stale DB content on top of it.

## Components

- **`yjs_client.py`** — `YDocClient`: connects, syncs, loads from DB, broadcasts, observes changes, persists
- **`manager.py`** — `CollaborationManager`: creates/tracks/shuts down clients per file

## Usage

```python
from aris.collaboration import get_collaboration_manager

manager = get_collaboration_manager()
await manager.start_client(file_id)   # start collaboration for a file
await manager.stop_client(file_id)    # stop it
manager.is_running(file_id)           # check status
```

## Config

```bash
MULTIPLAYER_HOST=multiplayer   # or localhost for local dev
MULTIPLAYER_PORT=1234
```

## Checking it works

```bash
docker compose logs -f backend | grep collaboration
```

Expected log sequence on file open:
```
[aris.collaboration] Starting YDocClient for file 123
[aris.collaboration] WebSocket connected for file 123
[aris.collaboration] Loaded 1234 chars from DB for file 123
[aris.collaboration] Broadcast DB content to room for file 123 (1234 chars)
[aris.collaboration] Saved: 1250 chars to DB for file 123
```
