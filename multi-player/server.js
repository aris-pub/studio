/**
 * Aris Y.js WebSocket Server
 *
 * Pure WebSocket relay for Y.js synchronization with automatic backend cleanup.
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
 * Cleanup Logic:
 * - When a client disconnects, check remaining clients in that room
 * - If only 1 client remains, it MUST be the backend (frontend count = 0)
 * - Close that last client to clean up resources
 */

import { WebSocketServer } from 'ws';
import { setupWSConnection, docs } from 'y-websocket/bin/utils';

if (!process.env.MULTIPLAYER_PORT) {
  throw new Error('MULTIPLAYER_PORT environment variable is required');
}

if (!process.env.HOST) {
  throw new Error('HOST environment variable is required');
}

const PORT = process.env.MULTIPLAYER_PORT;
const HOST = process.env.HOST;

const wss = new WebSocketServer({
  host: HOST,
  port: PORT
});

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
  console.log(`[Y.js Server] Client connected (total: ${wss.clients.size})`);

  // Track which document/room this connection belongs to
  const docName = req.url?.slice(1).split('?')[0];

  ws.on('close', () => {
    console.log(`[Y.js Server] Client disconnected from ${docName} (total: ${wss.clients.size})`);

    // Check if this document still has clients
    const doc = docs.get(docName);
    if (doc && doc.conns) {
      const remainingClients = doc.conns.size;
      console.log(`[Y.js Server] Remaining clients in ${docName}: ${remainingClients}`);

      // If only 1 client remains, it must be the backend - close it
      if (remainingClients === 1) {
        console.log(`[Y.js Server] Only backend remaining in ${docName}, closing it`);
        // Get the last remaining connection and close it
        for (const conn of doc.conns.values()) {
          conn.close();
        }
        // Clean up the document
        docs.delete(docName);
        console.log(`[Y.js Server] Cleaned up document ${docName}`);
      }
    }
  });
});

wss.on('error', (error) => {
  console.error('[Y.js Server] WebSocket error:', error);
});

console.log(`[Y.js Server] Running on ${HOST}:${PORT} (backend-as-client mode with auto-cleanup)`);
