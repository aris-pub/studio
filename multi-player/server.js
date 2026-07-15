/**
 * RSM Studio Y.js WebSocket Server
 *
 * WebSocket relay for Y.js synchronization with role-aware cleanup and
 * auto-bootstrap of the backend persistence client.
 *
 * Architecture: Backend-as-Client Pattern
 * ----------------------------------------
 * - Server: Message relay between all clients + thin control-plane integration
 *   with the backend (auto-bootstrap a YDocClient on first non-backend connection
 *   to a room).
 * - Frontend / CLI / agent clients: Connect, edit, disconnect.
 * - Backend YDocClient: Persistence peer that loads from DB on connect and
 *   saves with debounce.  Brought into the room by:
 *     (a) frontend's `POST /files/{id}/collab/start` on editor mount, OR
 *     (b) THIS server's auto-bootstrap call to `POST /internal/collab/start`
 *         when a non-backend client joins a room with no backend present.
 *
 * Connection Roles:
 * - Every client must present a short-lived JWT as the first WS frame (see
 *   `awaitAuthFrame`). The token's `role` claim ('backend' | 'OWNER' |
 *   'EDITOR' | 'COMMENTER') is what drives cleanup behaviour; non-backend
 *   tokens additionally have their `file_id` claim cross-checked against the
 *   docName so a token minted for file A can't be used to join room file B.
 *
 * Cleanup Logic:
 * - When the backend disconnects (hot-reload, crash), leave frontends alone.
 *   The CRDT keeps their editing working. Backend auto-reconnects.
 * - When all frontends disconnect and only the backend remains, close the
 *   backend (nothing to relay for) and delete the room.
 * - When the last client of any kind disconnects, delete the room.
 */

import * as Sentry from '@sentry/node';
import { WebSocketServer } from 'ws';
import { setupWSConnection, docs } from 'y-websocket/bin/utils';
import jwt from 'jsonwebtoken';
import * as decoding from 'lib0/decoding';

// Error tracking (std-rg1qqt). No-op unless SENTRY_DSN_MULTIPLAYER is set, so local
// and CI runs are unaffected until a DSN is configured for a deployed environment.
if (process.env.SENTRY_DSN_MULTIPLAYER) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN_MULTIPLAYER,
    environment: process.env.ENV || 'local',
    release: process.env.GIT_COMMIT || 'dev',
    tracesSampleRate: 0.05,
    sendDefaultPii: false, // GDPR: no user emails/IPs
  });
}

// ---------------------------------------------------------------------------
// Role-based write-frame filtering (std-ecup)
// ---------------------------------------------------------------------------
//
// WS auth (PR #405) authenticates the connection and records the file role in
// ws._authRole, but y-websocket's setupWSConnection relays every frame it
// receives regardless of role. Without enforcement a read-only (COMMENTER)
// client could inject sync updates the backend persists, so /collab/start had
// to be gated at require_edit and read-only users could not join live at all.
//
// These helpers drop document-mutating frames from read-only sockets, so a
// read-only user can observe a live document without being able to change it.

// y-protocols framing: the first varUint is the message type; for a sync
// message the second varUint is the sync step.
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SYNC_STEP_1 = 0;

// Roles allowed to mutate the shared document. Any other role (COMMENTER, or an
// unknown role) is treated as read-only.
const WRITE_ROLES = new Set(['backend', 'OWNER', 'EDITOR']);

export function isReadOnlySocket(ws) {
  return !WRITE_ROLES.has(ws._authRole);
}

/**
 * True if a raw WS frame would mutate the shared Y.Doc: a sync Update or
 * SyncStep2, or any awareness update. A sync SyncStep1 (a read request) and
 * non-sync control frames are reads. Anything that fails to decode is treated
 * as a write and dropped, so a read-only socket can't smuggle a mutation past a
 * malformed frame.
 *
 * Stricter than "drop only Update frames": SyncStep2 also applies an update to
 * the shared doc, so permitting it would reopen the write hole for a crafted
 * client. A read-only client still syncs fully — it receives the doc via the
 * server's SyncStep2; only its own outbound writes are dropped.
 */
export function isWriteFrame(data) {
  let bytes;
  if (data instanceof Uint8Array) bytes = data; // a Node Buffer is a Uint8Array
  else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
  else return true;
  try {
    const decoder = decoding.createDecoder(bytes);
    const messageType = decoding.readVarUint(decoder);
    if (messageType === MESSAGE_AWARENESS) return true;
    if (messageType === MESSAGE_SYNC) {
      return decoding.readVarUint(decoder) !== SYNC_STEP_1;
    }
    return false;
  } catch (_err) {
    return true;
  }
}

/**
 * Wrap the ws 'message' listener that setupWSConnection is about to attach so
 * write frames from a read-only socket are dropped before y-websocket decodes
 * them. Patching ws.on (not ws.emit) means replayed buffered frames
 * (ws.emit('message', ...)) are filtered too.
 */
export function installWriteFrameFilter(ws) {
  const originalOn = ws.on.bind(ws);
  ws.on = (event, listener) => {
    if (event !== 'message') return originalOn(event, listener);
    return originalOn(event, function filteredMessage(data, ...rest) {
      if (isWriteFrame(data)) return; // drop: a read-only socket may not mutate
      return listener.call(this, data, ...rest);
    });
  };
}

/**
 * Join the room via y-websocket, first installing the read-only write filter
 * when the socket's role is not permitted to write.
 */
function joinRoom(ws, req) {
  if (isReadOnlySocket(ws)) installWriteFrameFilter(ws);
  setupWSConnection(ws, req);
}

// ---------------------------------------------------------------------------
// WebSocket auth
// ---------------------------------------------------------------------------

const AUTH_TIMEOUT_MS = 5000;
const AUTH_CLOSE_CODE = 4401;

/**
 * Read the first WebSocket frame and verify the auth JWT.
 *
 * Resolves with the decoded token payload on success. Rejects with an Error
 * whose `.message` is suitable for a 4401 close reason on any failure.
 */
export function awaitAuthFrame(ws, opts) {
  const timeoutMs = opts.timeoutMs ?? AUTH_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('auth-timeout'));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    const onMessage = (data) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        const text = typeof data === 'string' ? data : data.toString('utf8');
        const msg = JSON.parse(text);
        if (msg.type !== 'auth' || typeof msg.token !== 'string') {
          reject(new Error('auth-missing'));
          return;
        }
        const payload = jwt.verify(msg.token, opts.secret, { algorithms: ['HS256'] });
        resolve(payload);
      } catch (err) {
        reject(new Error(`auth-invalid:${err && err.message ? err.message : 'unknown'}`));
      }
    };

    const onClose = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('closed-before-auth'));
    };

    const cleanup = () => {
      clearTimeout(timer);
      timer = null;
      ws.removeListener('message', onMessage);
      ws.removeListener('close', onClose);
    };

    ws.once('message', onMessage);
    ws.once('close', onClose);
  });
}

/**
 * Validate a decoded auth payload against the docName.
 *
 * - For role='backend', any file_id is acceptable (system trust).
 * - For all other roles, the token's file_id must match the docName's id.
 *
 * Returns null on success or an error string on failure.
 */
export function validateAuthForDocName(payload, docName) {
  if (!payload || typeof payload !== 'object') return 'auth-invalid';
  const role = payload.role;
  if (typeof role !== 'string') return 'auth-invalid-role';
  if (role === 'backend') return null;

  const fileId = parseFileIdFromDocName(docName);
  if (fileId === null) return 'auth-bad-docname';
  if (payload.file_id !== fileId) return 'auth-file-mismatch';
  return null;
}

// ---------------------------------------------------------------------------
// Auto-bootstrap state
// ---------------------------------------------------------------------------

const inflightBootstraps = new Map(); // docName -> Promise<void>
const cachedBootstraps = new Map();   // docName -> { promise, expiresAt }

const DEFAULT_SUCCESS_TTL_MS = 30_000;

/**
 * Test helper — clears all bootstrap state. Used by the unit tests to ensure
 * isolation between test cases without re-importing the module.
 */
export function resetBootstrapState() {
  inflightBootstraps.clear();
  for (const entry of cachedBootstraps.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  cachedBootstraps.clear();
}

/**
 * Parse a numeric file id out of a docName like ``file-{id}-{env}``.
 * Returns null if the format doesn't match.
 */
export function parseFileIdFromDocName(docName) {
  const m = /^file-(\d+)-[^-]+$/.exec(docName);
  if (!m) return null;
  return parseInt(m[1], 10);
}

/**
 * Ask the backend to ensure a YDocClient is in the room for ``docName``.
 *
 * The backend's /internal/collab/start endpoint awaits the YDocClient's
 * readiness signal before returning, so when this Promise resolves the
 * YDocClient has joined the room and finished its first sync handshake.
 *
 * Concurrent calls for the same docName share one fetch (in-flight dedupe).
 * After success, the resolved Promise is cached for `successTtlMs` so that
 * a flurry of clients connecting in close succession doesn't generate a
 * thundering-herd on the backend; the cache expires so a later cold
 * reconnection still works.
 *
 * @param {string} docName  - e.g. "file-7-local"
 * @param {object} opts
 * @param {Function} opts.fetch       - injected fetch (for testing)
 * @param {string}   opts.backendUrl  - e.g. "http://localhost:8000"
 * @param {string}   opts.secret      - X-Internal-Secret value
 * @param {number}  [opts.successTtlMs] - cache hit lifetime, default 30s
 */
export async function ensureBackendForRoom(docName, opts) {
  const fileId = parseFileIdFromDocName(docName);
  if (fileId === null) {
    throw new Error(`Cannot parse file_id from docName "${docName}"`);
  }

  // Fast path: cached success within TTL
  const cached = cachedBootstraps.get(docName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  // De-dupe in-flight calls
  const inflight = inflightBootstraps.get(docName);
  if (inflight) return inflight;

  const successTtlMs = opts.successTtlMs ?? DEFAULT_SUCCESS_TTL_MS;
  const promise = (async () => {
    const res = await opts.fetch(`${opts.backendUrl}/internal/collab/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': opts.secret,
      },
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!res.ok) {
      throw new Error(`Backend bootstrap for ${docName} failed: HTTP ${res.status}`);
    }
  })();

  inflightBootstraps.set(docName, promise);

  promise.then(
    () => {
      // Move from in-flight to cached on success
      inflightBootstraps.delete(docName);
      const timer = setTimeout(() => cachedBootstraps.delete(docName), successTtlMs);
      // Don't keep the event loop alive just for cache invalidation
      if (typeof timer.unref === 'function') timer.unref();
      cachedBootstraps.set(docName, {
        promise,
        expiresAt: Date.now() + successTtlMs,
        timer,
      });
    },
    () => {
      // On failure, clear in-flight immediately so retries can happen
      inflightBootstraps.delete(docName);
    }
  );

  return promise;
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

/**
 * Handle a new WebSocket connection. Exported for unit testing.
 *
 * Sequence for non-backend connections when no backend is in the room:
 *   1. Tag connection with role from ?role= query string.
 *   2. Buffer any incoming messages with a temporary listener.
 *   3. Await ensureBackendForRoom(docName, ...) — backend YDocClient joins.
 *   4. Detach the buffer listener and call setupWSConnection (y-websocket
 *      attaches its real message listener, putting the conn in the room).
 *   5. Replay buffered messages so the client's SyncStep1 etc. are processed.
 *   6. Attach our close listener for role-aware cleanup.
 *
 * If the WebSocket closes during the bootstrap window, we exit early and
 * skip setupWSConnection (the conn is already gone).
 */
export async function handleConnection(ws, req, opts) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docName = url.pathname.slice(1);

  // -------------------------------------------------------------------------
  // Auth: first frame must be {type: 'auth', token: '<jwt>'}.
  //
  // The Y.js docName alone names no permission — anyone who can reach the
  // socket could otherwise enumerate rooms and read/inject updates. Hold off
  // on setupWSConnection (which joins the room and starts relaying) until the
  // token verifies.
  // -------------------------------------------------------------------------
  let authPayload;
  try {
    authPayload = await awaitAuthFrame(ws, {
      secret: opts.authSecret,
      timeoutMs: opts.authTimeoutMs,
    });
  } catch (err) {
    console.warn(`[Y.js Server] Auth failed for ${docName}: ${err.message}`);
    try { ws.close(AUTH_CLOSE_CODE, 'auth-failed'); } catch (_e) { /* already closed */ }
    return;
  }

  const validationErr = validateAuthForDocName(authPayload, docName);
  if (validationErr) {
    console.warn(`[Y.js Server] Auth rejected for ${docName}: ${validationErr}`);
    try { ws.close(AUTH_CLOSE_CODE, 'auth-failed'); } catch (_e) { /* already closed */ }
    return;
  }

  ws._role = authPayload.role === 'backend' ? 'backend' : 'frontend';
  ws._authRole = authPayload.role;
  ws._authUserId = authPayload.sub;

  try {
    ws.send(JSON.stringify({ type: 'auth_ok' }));
  } catch (err) {
    console.warn(`[Y.js Server] Failed to send auth_ok for ${docName}: ${err.message}`);
    return;
  }

  let needsBootstrap = false;
  if (ws._role !== 'backend') {
    const existingDoc = opts.docs.get(docName);
    const hasBackend = existingDoc && Array.from(existingDoc.conns.keys()).some((c) => c._role === 'backend');
    needsBootstrap = !hasBackend && parseFileIdFromDocName(docName) !== null;
  }

  if (needsBootstrap) {
    // Buffer messages until the backend YDocClient has joined the room.
    const buffered = [];
    const bufferer = (msg) => buffered.push(msg);
    ws.on('message', bufferer);

    // Track close during the bootstrap window so we can bail out if the
    // client disconnects before we've installed the real handlers.
    let closedDuringBootstrap = false;
    const closeWatcher = () => { closedDuringBootstrap = true; };
    ws.once('close', closeWatcher);

    try {
      await ensureBackendForRoom(docName, {
        fetch: opts.fetch,
        backendUrl: opts.backendUrl,
        secret: opts.secret,
      });
    } catch (err) {
      console.error(`[Y.js Server] Bootstrap failed for ${docName}: ${err.message}`);
      ws.removeListener('message', bufferer);
      ws.removeListener('close', closeWatcher);
      try { ws.close(1011, 'bootstrap-failed'); } catch (_e) { /* already closed */ }
      return;
    }

    ws.removeListener('message', bufferer);
    ws.removeListener('close', closeWatcher);

    if (closedDuringBootstrap || ws.readyState !== ws.OPEN) {
      // Client gave up during bootstrap window — nothing more to do.
      return;
    }

    joinRoom(ws, req);

    // Replay buffered messages now that y-websocket is attached.
    for (const msg of buffered) {
      ws.emit('message', msg);
    }
  } else {
    joinRoom(ws, req);
  }

  console.log(`[Y.js Server] ${ws._role} joined room ${docName}`);

  ws.on('close', () => {
    console.log(`[Y.js Server] ${ws._role} disconnected from ${docName} (total: ${opts.totalClientCount()})`);
    handleDisconnect(ws, docName, opts.docs);
  });
}

/**
 * Handle a client disconnection and decide whether to clean up the room.
 *
 * @param {WebSocket} ws - The disconnecting WebSocket (already removed from doc.conns by y-websocket)
 * @param {string} docName - The room/document name
 * @param {Map} docsMap - The y-websocket docs Map
 */
export function handleDisconnect(ws, docName, docsMap) {
  const doc = docsMap.get(docName);
  if (!doc || !doc.conns) return;

  const remaining = doc.conns.size;
  if (remaining === 0) {
    docsMap.delete(docName);
    console.log(`[Y.js Server] Room ${docName} empty, deleted`);
    return;
  }

  // Backend disconnected — do NOT touch frontends or the room.
  // The CRDT keeps frontend editing working. Backend will auto-reconnect.
  if (ws._role === 'backend') {
    console.log(`[Y.js Server] Backend disconnected from ${docName}, ${remaining} frontend(s) remain`);
    return;
  }

  // A frontend disconnected. Check if any frontends remain.
  let hasFrontend = false;
  for (const conn of doc.conns.keys()) {
    if (conn._role !== 'backend') { hasFrontend = true; break; }
  }

  if (!hasFrontend) {
    // Only backend remains — close it and clean up.
    console.log(`[Y.js Server] All frontends left ${docName}, closing backend`);
    for (const conn of doc.conns.keys()) {
      conn.close(4000, 'all-frontends-left');
    }
    docsMap.delete(docName);
  }
}

// ---------------------------------------------------------------------------
// Server bootstrap (skipped during test import)
// ---------------------------------------------------------------------------
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;

if (!isTestEnv) {
  if (!process.env.MULTIPLAYER_PORT) {
    throw new Error('MULTIPLAYER_PORT environment variable is required');
  }
  if (!process.env.HOST) {
    throw new Error('HOST environment variable is required');
  }
  if (!process.env.INTERNAL_SHARED_SECRET) {
    throw new Error('INTERNAL_SHARED_SECRET environment variable is required');
  }

  const PORT = process.env.MULTIPLAYER_PORT;
  const HOST = process.env.HOST;
  const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000';
  const SECRET = process.env.INTERNAL_SHARED_SECRET;

  const wss = new WebSocketServer({ host: HOST, port: PORT });

  wss.on('connection', (ws, req) => {
    console.log(`[Y.js Server] Client connected (total: ${wss.clients.size})`);
    handleConnection(ws, req, {
      fetch: (url, init) => fetch(url, init),
      backendUrl: BACKEND_INTERNAL_URL,
      secret: SECRET,
      authSecret: SECRET,
      docs,
      totalClientCount: () => wss.clients.size,
    }).catch((err) => {
      console.error(`[Y.js Server] handleConnection error: ${err.stack || err.message}`);
    });
  });

  wss.on('error', (error) => {
    console.error('[Y.js Server] WebSocket error:', error);
  });

  console.log(`[Y.js Server] Running on ${HOST}:${PORT} (backend-as-client mode with auto-bootstrap and role-aware cleanup)`);
}
