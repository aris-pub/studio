# Backend Y.js Collaboration Client

The backend connects to the Y.js WebSocket server as a peer alongside frontend clients. On connection it loads the file's content from the database into a Y.Doc, then observes changes and persists them back (500ms debounce).

## Components

- **`yjs_client.py`** — `YDocClient`: connects, loads from DB, observes changes, persists
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
[aris.collaboration] Saved: 1250 chars to DB for file 123
```
