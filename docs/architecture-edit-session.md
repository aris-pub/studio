# Architecture: EditSession Refactor

**Status**: Design approved, ready for TDD implementation
**Date**: 2026-01-29
**Context**: Prerequisite for real-time collaboration spike

---

## Problem Statement

Current architecture has `FileStore` managing both file metadata AND content syncing, creating conflicts when introducing real-time collaboration via Y.js WebSockets:

**Conflicts**:
1. FileStore's syncQueue uses HTTP PUT for saves
2. Y.js WebSocket manages real-time content sync
3. Two competing sync mechanisms for same data
4. FileStore tracks all user files, but only one file is actively edited at a time

---

## Solution: Separate Concerns

Split FileStore into two independent services:

### FileStore (keeps metadata)
- Manages ALL user files (library/collection)
- File metadata: id, title, tags, created_at, last_edited_at
- File CRUD: create, delete, duplicate, load file list
- Tag management: CRUD for tags, tag-file associations
- UI state: selected files, filtered files, sort order
- **Removes**: file.source, syncQueue, all content sync logic

### EditSession (new composable)
- Manages THE single open file's content
- Content storage: content ref (string)
- Auto-save: debounce (2s), interval (30s)
- Status tracking: idle, pending, saving, saved, error
- Manual save: Ctrl+S handler
- Compilation: triggers RSM → HTML
- **Absorbs**: useAutoSave composable (deleted)
- **Implementations**: HttpEditSession (current), YjsEditSession (spike)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│ App.vue                                     │
│  ├── FileStore (provided)                   │
│  │   └── files.value = [all files metadata] │
│  └── (EditSession created per file)         │
└─────────────────────────────────────────────┘
                    │
                    ├─────────────────────────┐
                    ↓                         ↓
         ┌──────────────────┐      ┌──────────────────┐
         │ Home.vue         │      │ Editor.vue       │
         │ ├── FileStore    │      │ ├── FileStore    │
         │ └── (read only)  │      │ └── EditSession  │
         └──────────────────┘      └──────────────────┘
                                            │
                    ┌───────────────────────┴──────────────────────┐
                    ↓                                               ↓
         ┌──────────────────┐                          ┌──────────────────┐
         │ EditorSource.vue │                          │EditorCodeMirror  │
         │ v-model="content"│                          │ v-model="content"│
         └──────────────────┘                          └──────────────────┘
```

---

## EditSession Interface

### Composable API

```javascript
// composables/useEditSession.js
export function useEditSession(fileId, options = {}) {
  const {
    implementation = 'http',  // 'http' | 'yjs'
    api,
    user,
    debounceTime = 2000,
    autoSaveInterval = 30000,
    onCompile = null
  } = options;

  return {
    content,       // ref<string> - reactive file content
    status,        // ref<'idle'|'pending'|'saving'|'saved'|'error'>
    isConnected,   // ref<boolean> - connection status
    start,         // async () => void - initialize session
    stop,          // () => void - cleanup session
    manualSave,    // async () => void - force save (Ctrl+S)
    compile        // async () => void - trigger RSM → HTML
  };
}
```

### Implementation Classes

```javascript
// implementations/HttpEditSession.js
class HttpEditSession {
  constructor(fileId, api, user, options) {
    this.fileId = fileId;
    this.api = api;
    this.user = user;
    this.content = ref('');
    this.status = ref('idle');
    this.syncQueue = new Set();
  }

  async start() {
    // Load content: GET /files/{fileId}
    // Setup debounced watch on content
    // Setup auto-save interval
  }

  stop() {
    // Clear timers
    // Final save if pending
  }

  async save() {
    // PUT /files/{fileId} { source: content.value }
  }
}

// implementations/YjsEditSession.js (spike)
class YjsEditSession {
  constructor(fileId, wsUrl, user, options) {
    this.fileId = fileId;
    this.wsUrl = wsUrl;
    this.user = user;
    this.content = ref('');
    this.status = ref('idle');
    this.ydoc = null;
    this.provider = null;
  }

  async start() {
    // Create Y.Doc
    // Connect WebSocket provider
    // Bind ytext ↔ content ref
    // Setup snapshot timer
  }

  stop() {
    // Disconnect WebSocket
    // Destroy Y.Doc
    // Create final snapshot
  }

  async save() {
    // Snapshot Y.Doc state → Postgres
  }
}
```

---

## Usage Examples

### Editor.vue (simplified)

```javascript
// Before: 40+ lines of sync orchestration
const saveFile = async (fileToSave) => { ... };
const { saveStatus, onInput, manualSave } = useAutoSave({ ... });

// After: 10 lines
const { content, status, start, stop, manualSave, compile } = useEditSession(
  file.value.id,
  {
    implementation: USE_CODEMIRROR.value ? 'yjs' : 'http',
    api,
    user,
    onCompile: async () => {
      const response = await api.post('render/private', {
        source: content.value,
        file_id: file.value.id
      });
      file.value.html = response.data;
    }
  }
);

onMounted(() => start());
onBeforeUnmount(() => stop());
```

### EditorSource.vue (no changes)

```vue
<textarea
  :value="content"
  @input="content = $event.target.value"
/>
<StatusBar :save-status="status" />
```

### DockableSearch.vue

```javascript
// Before: inject file, read file.value.source
const file = inject('file');
const matches = highlightSearchMatches(file.value.source, query);

// After: inject editSession, read content
const editSession = inject('editSession');
const matches = highlightSearchMatches(editSession.content.value, query);
```

---

## Migration Strategy

### Phase 1: Extract HttpEditSession (TDD)
1. Write tests for useEditSession composable
2. Implement HttpEditSession class
3. Implement useEditSession composable
4. Update Editor.vue to use EditSession
5. Delete useAutoSave.js
6. Remove sync logic from FileStore
7. Update all components reading file.source → editSession.content
8. All tests pass
9. **Merge to main**

### Phase 2: Rebase spike branch
1. Rebase real-time collaboration spike onto main
2. Resolve conflicts (should be minimal)

### Phase 3: Implement YjsEditSession (spike continues)
1. Write tests for YjsEditSession
2. Implement YjsEditSession class
3. Update Editor.vue to switch implementations via feature flag
4. Run Phase 2 semantic preservation tests
5. GO/NO-GO decision

---

## What Gets Deleted

- `frontend/src/composables/useAutoSave.js` - logic absorbed into EditSession
- `FileStore.syncQueue` - moved to HttpEditSession
- `FileStore.queueSync()` - moved to HttpEditSession
- `FileStore.syncProcess()` - moved to HttpEditSession
- Editor.vue sync orchestration (30+ lines)

---

## What Gets Modified

**FileStore.js**:
- Remove: syncQueue, syncInProgress, queueSync(), syncProcess(), scheduleSyncProcess()
- Remove: file.source from File objects
- Keep: everything else (tags, metadata, CRUD)

**Editor.vue**:
- Remove: useAutoSave composable usage
- Remove: saveFile function
- Remove: onInput handler
- Add: useEditSession composable usage
- Simplify: 40 lines → 15 lines

**File.js model**:
- Remove: source field from File constructor (or mark as optional)
- Keep: File.save() for metadata updates

**Components reading file.source**:
- DockableSearch.vue
- MinimapUtils.js
- Any tests

---

## Browser Tab Architecture

Each browser tab is a separate Vue app instance:

```
Tab 1:
├── Vue instance A
├── FileStore A (all files metadata)
└── EditSession A (file 123 content)

Tab 2:
├── Vue instance B
├── FileStore B (all files metadata)
└── EditSession B (file 123 content)
```

**Y.js WebSocket synchronizes content between EditSession A ↔ EditSession B**

FileStore instances are independent (no sync needed - metadata fetched from backend).

---

## Benefits

1. **Clean separation**: Metadata vs content management
2. **Single responsibility**: Each service has one clear purpose
3. **Testable**: EditSession can be unit tested independently
4. **Swappable**: HTTP ↔ Y.js implementation swap is trivial
5. **Simpler components**: Editor.vue loses 30+ lines of orchestration
6. **No conflicts**: HTTP and Y.js don't compete for same data

---

## Open Questions

None - architecture approved for TDD implementation.

---

## Next Steps

1. Write tests for useEditSession (HTTP implementation)
2. Implement following TDD
3. Refactor existing code to use EditSession
4. Delete useAutoSave
5. Merge to main
6. Continue spike with YjsEditSession
