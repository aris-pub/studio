import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { handleDisconnect } from './server.js';

/**
 * Tests for the multiplayer server's room cleanup logic.
 *
 * The server distinguishes backend from frontend connections via a
 * `?role=backend` query parameter.  Cleanup rules:
 *
 *   1. When the backend disconnects, do NOT touch frontends or the room.
 *   2. When all frontends disconnect and only the backend remains, close
 *      the backend and delete the room.
 *   3. When a frontend disconnects but other frontends remain, do nothing.
 *   4. When the last client (of any kind) disconnects, delete the room.
 */

function makeConn(role = 'frontend') {
  const ws = new EventEmitter();
  ws.close = vi.fn();
  ws._role = role;
  return ws;
}

describe('Room cleanup logic', () => {
  let docs;

  beforeEach(() => {
    docs = new Map();
  });

  // -- CRITICAL: the bug that destroyed data ----------------------------------
  it('backend disconnects first (hot-reload) — frontends stay alive', () => {
    const docName = 'file-322-dev';
    const backend = makeConn('backend');
    const frontend = makeConn('frontend');

    const doc = { conns: new Map([[backend, new Set()], [frontend, new Set()]]) };
    docs.set(docName, doc);

    // Backend disconnects (hot-reload)
    doc.conns.delete(backend);
    handleDisconnect(backend, docName, docs);

    // Frontend must NOT be closed; room must NOT be deleted
    expect(frontend.close).not.toHaveBeenCalled();
    expect(docs.has(docName)).toBe(true);
    expect(doc.conns.size).toBe(1);
  });

  // -- Normal cleanup: all frontends leave, backend is last -------------------
  it('all frontends leave — backend is closed and room deleted', () => {
    const docName = 'file-100-dev';
    const backend = makeConn('backend');
    const frontend = makeConn('frontend');

    const doc = { conns: new Map([[backend, new Set()], [frontend, new Set()]]) };
    docs.set(docName, doc);

    // Frontend disconnects
    doc.conns.delete(frontend);
    handleDisconnect(frontend, docName, docs);

    // Only backend remains — should be closed, room deleted
    expect(backend.close).toHaveBeenCalledWith(4000, 'all-frontends-left');
    expect(docs.has(docName)).toBe(false);
  });

  // -- Multiple frontends: one leaves, others stay ----------------------------
  it('one frontend leaves, another stays — no cleanup', () => {
    const docName = 'file-200-dev';
    const backend = makeConn('backend');
    const fe1 = makeConn('frontend');
    const fe2 = makeConn('frontend');

    const doc = { conns: new Map([[backend, new Set()], [fe1, new Set()], [fe2, new Set()]]) };
    docs.set(docName, doc);

    doc.conns.delete(fe1);
    handleDisconnect(fe1, docName, docs);

    expect(backend.close).not.toHaveBeenCalled();
    expect(fe2.close).not.toHaveBeenCalled();
    expect(docs.has(docName)).toBe(true);
    expect(doc.conns.size).toBe(2);
  });

  // -- Last frontend leaves after backend already gone ------------------------
  it('last frontend leaves after backend already gone — room deleted', () => {
    const docName = 'file-300-dev';
    const frontend = makeConn('frontend');

    const doc = { conns: new Map([[frontend, new Set()]]) };
    docs.set(docName, doc);

    doc.conns.delete(frontend);
    handleDisconnect(frontend, docName, docs);

    expect(docs.has(docName)).toBe(false);
  });

  // -- No backend connected at all (e.g. collab/start failed) -----------------
  it('two frontends, no backend — one leaves, other stays', () => {
    const docName = 'file-400-dev';
    const fe1 = makeConn('frontend');
    const fe2 = makeConn('frontend');

    const doc = { conns: new Map([[fe1, new Set()], [fe2, new Set()]]) };
    docs.set(docName, doc);

    doc.conns.delete(fe1);
    handleDisconnect(fe1, docName, docs);

    expect(fe2.close).not.toHaveBeenCalled();
    expect(docs.has(docName)).toBe(true);
  });

  it('two frontends, no backend — both leave — room deleted', () => {
    const docName = 'file-400-dev';
    const fe1 = makeConn('frontend');
    const fe2 = makeConn('frontend');

    const doc = { conns: new Map([[fe1, new Set()], [fe2, new Set()]]) };
    docs.set(docName, doc);

    doc.conns.delete(fe1);
    handleDisconnect(fe1, docName, docs);

    doc.conns.delete(fe2);
    handleDisconnect(fe2, docName, docs);

    expect(docs.has(docName)).toBe(false);
  });

  // -- Edge cases -------------------------------------------------------------
  it('handles missing doc gracefully', () => {
    const ws = makeConn('frontend');
    expect(() => handleDisconnect(ws, 'nonexistent', docs)).not.toThrow();
  });

  it('handles doc with empty conns', () => {
    const docName = 'file-500-dev';
    docs.set(docName, { conns: new Map() });
    const ws = makeConn('frontend');

    handleDisconnect(ws, docName, docs);
    expect(docs.has(docName)).toBe(false);
  });
});
