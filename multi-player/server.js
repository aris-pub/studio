/**
 * Aris Y.js WebSocket Server - Minimal Wrapper
 *
 * This is a thin wrapper around y-websocket's official server.
 * Y.js handles all synchronization with in-memory persistence.
 * Documents are automatically cleaned up when all clients disconnect.
 */

import { WebSocketServer } from 'ws';
import { setupWSConnection, setPersistence } from 'y-websocket/bin/utils';

if (!process.env.MULTIPLAYER_PORT) {
  throw new Error('MULTIPLAYER_PORT environment variable is required');
}

if (!process.env.HOST) {
  throw new Error('HOST environment variable is required');
}

const PORT = process.env.MULTIPLAYER_PORT;
const HOST = process.env.HOST;

// In-memory persistence with automatic cleanup
// This ensures documents are destroyed when all clients disconnect
const persistence = {
  bindState: (docName, doc) => {
    console.log(`[Y.js Server] Document '${docName}' initialized`);
  },
  writeState: async (docName, doc) => {
    console.log(`[Y.js Server] Document '${docName}' cleaned up (no active connections)`);
    // No actual persistence - just cleanup
    return Promise.resolve();
  },
  provider: null
};

setPersistence(persistence);

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

console.log(`[Y.js Server] Running on ${HOST}:${PORT}`);
