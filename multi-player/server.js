/**
 * Aris Y.js WebSocket Server - Minimal Wrapper
 *
 * This is a thin wrapper around y-websocket's official server.
 * Y.js handles all synchronization, persistence is in-memory.
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
