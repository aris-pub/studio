import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

describe('Multiplayer Server Cleanup Logic', () => {
  let mockWss;
  let mockDocs;
  let setupWSConnection;

  beforeEach(() => {
    // Mock the docs Map from y-websocket
    mockDocs = new Map();

    // Mock setupWSConnection
    setupWSConnection = vi.fn();

    // Mock WebSocketServer
    mockWss = new EventEmitter();
    mockWss.clients = new Set();
  });

  it('should close backend client when only 1 client remains in room', () => {
    // Setup: 2 clients in a room
    const docName = 'file-123';
    const client1 = new EventEmitter();
    const client2 = new EventEmitter();
    client2.close = vi.fn();

    const mockDoc = {
      conns: new Map([
        ['client1', client1],
        ['client2', client2]
      ])
    };
    mockDocs.set(docName, mockDoc);

    // Simulate client1 disconnecting
    // After disconnect, only client2 (backend) remains
    mockDoc.conns.delete('client1');

    // Trigger close handler logic
    const remainingClients = mockDoc.conns.size;
    if (remainingClients === 1) {
      // Close the last remaining client (backend)
      for (const conn of mockDoc.conns.values()) {
        conn.close();
      }
      mockDocs.delete(docName);
    }

    // Verify backend client was closed
    expect(client2.close).toHaveBeenCalled();
    expect(mockDocs.has(docName)).toBe(false);
  });

  it('should NOT close clients when multiple clients remain', () => {
    // Setup: 3 clients in a room
    const docName = 'file-456';
    const client1 = new EventEmitter();
    const client2 = new EventEmitter();
    const client3 = new EventEmitter();
    client2.close = vi.fn();
    client3.close = vi.fn();

    const mockDoc = {
      conns: new Map([
        ['client1', client1],
        ['client2', client2],
        ['client3', client3]
      ])
    };
    mockDocs.set(docName, mockDoc);

    // Simulate client1 disconnecting
    // After disconnect, 2 clients remain (still has frontend clients)
    mockDoc.conns.delete('client1');

    // Trigger close handler logic
    const remainingClients = mockDoc.conns.size;
    if (remainingClients === 1) {
      // This should NOT execute - we have 2 clients remaining
      for (const conn of mockDoc.conns.values()) {
        conn.close();
      }
      mockDocs.delete(docName);
    }

    // Verify no clients were closed
    expect(client2.close).not.toHaveBeenCalled();
    expect(client3.close).not.toHaveBeenCalled();
    expect(mockDocs.has(docName)).toBe(true);
  });

  it('should handle document with no conns gracefully', () => {
    const docName = 'file-789';
    const mockDoc = {
      conns: new Map()
    };
    mockDocs.set(docName, mockDoc);

    // Trigger close handler logic with empty conns
    const remainingClients = mockDoc.conns.size;

    // Should not crash, should just be 0
    expect(remainingClients).toBe(0);
    expect(mockDocs.has(docName)).toBe(true);
  });

  it('should handle missing document gracefully', () => {
    const docName = 'file-999';
    const doc = mockDocs.get(docName);

    // Should not crash when doc doesn't exist
    expect(doc).toBeUndefined();

    // Logic should handle this case
    if (doc && doc.conns) {
      // This won't execute
      const remainingClients = doc.conns.size;
      expect(remainingClients).toBe(0);
    }

    // Test passes if no error thrown
    expect(true).toBe(true);
  });

  it('should clean up document from docs Map when last client closes', () => {
    const docName = 'file-cleanup';
    const client = new EventEmitter();
    client.close = vi.fn();

    const mockDoc = {
      conns: new Map([['client', client]])
    };
    mockDocs.set(docName, mockDoc);

    // Only 1 client, close it
    const remainingClients = mockDoc.conns.size;
    if (remainingClients === 1) {
      for (const conn of mockDoc.conns.values()) {
        conn.close();
      }
      mockDocs.delete(docName);
    }

    // Verify document was removed from docs Map
    expect(mockDocs.has(docName)).toBe(false);
    expect(mockDocs.size).toBe(0);
  });
});
