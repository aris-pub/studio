/**
 * Aris Y.js WebSocket Server
 *
 * Pure WebSocket relay for Y.js synchronization.
 * No persistence logic - backend connects as a peer/client to handle persistence.
 *
 * Architecture: Backend-as-Client Pattern
 * ----------------------------------------
 * - Server: Pure message relay between all clients
 * - Frontend clients: Connect, edit, disconnect
 * - Backend client: Always-on peer that persists changes to database
 *
 * Benefits:
 * - Server has no database/persistence logic
 * - Backend is just another Y.js client (same as frontend)
 * - All clients are treated equally by the server
 * - Backend handles persistence via Y.Doc observation
 *
 * Document Lifecycle:
 * 1. First client connects → Server creates in-memory Y.Doc
 * 2. Backend client connects → Observes changes, persists to DB
 * 3. Frontend clients connect/disconnect → Server relays messages
 * 4. Backend stays connected → Y.Doc persists in memory
 * 5. When backend disconnects → Y.Doc cleaned up (acceptable, backend recreates on reconnect)
 */

import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

if (!process.env.MULTIPLAYER_PORT) {
  throw new Error('MULTIPLAYER_PORT environment variable is required');
}

if (!process.env.HOST) {
  throw new Error('HOST environment variable is required');
}

const PORT = process.env.MULTIPLAYER_PORT;
const HOST = process.env.HOST;

// No persistence setup - backend client handles this
// Server is a pure relay with in-memory Y.Doc storage

const wss = new WebSocketServer({
  host: HOST,
  port: PORT
});

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
  console.log(`[Y.js Server] Client connected (total: ${wss.clients.size})`);
});

wss.on('error', (error) => {
  console.error('[Y.js Server] WebSocket error:', error);
});

console.log(`[Y.js Server] Running on ${HOST}:${PORT} (backend-as-client mode)`);
