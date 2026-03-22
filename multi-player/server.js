/**
 * RSM Studio Y.js WebSocket Server
 *
 * Pure WebSocket relay for Y.js synchronization with role-aware cleanup.
 * No persistence logic - backend connects as a peer/client to handle persistence.
 *
 * Architecture: Backend-as-Client Pattern
 * ----------------------------------------
 * - Server: Pure message relay between all clients
 * - Frontend clients: Connect, edit, disconnect
 * - Backend client: Always-on peer that persists changes to database
 *
 * Connection Roles:
 * - Backend identifies itself via `?role=backend` query parameter
 * - All other connections are treated as frontends
 *
 * Cleanup Logic:
 * - When the backend disconnects (hot-reload, crash), leave frontends alone.
 *   The CRDT keeps their editing working. Backend auto-reconnects.
 * - When all frontends disconnect and only the backend remains, close the
 *   backend (nothing to relay for) and delete the room.
 * - When the last client of any kind disconnects, delete the room.
 */

import { WebSocketServer } from 'ws';
import { setupWSConnection, docs } from 'y-websocket/bin/utils';

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

  const PORT = process.env.MULTIPLAYER_PORT;
  const HOST = process.env.HOST;

  const wss = new WebSocketServer({ host: HOST, port: PORT });

  wss.on('connection', (ws, req) => {
    setupWSConnection(ws, req);
    console.log(`[Y.js Server] Client connected (total: ${wss.clients.size})`);

    const url = new URL(req.url, `http://${req.headers.host}`);
    const docName = url.pathname.slice(1);
    const role = url.searchParams.get('role');

    // Tag the connection so cleanup logic can distinguish backend from frontend
    ws._role = role === 'backend' ? 'backend' : 'frontend';
    console.log(`[Y.js Server] ${ws._role} joined room ${docName}`);

    ws.on('close', () => {
      console.log(`[Y.js Server] ${ws._role} disconnected from ${docName} (total: ${wss.clients.size})`);
      handleDisconnect(ws, docName, docs);
    });
  });

  wss.on('error', (error) => {
    console.error('[Y.js Server] WebSocket error:', error);
  });

  console.log(`[Y.js Server] Running on ${HOST}:${PORT} (backend-as-client mode with role-aware cleanup)`);
}
