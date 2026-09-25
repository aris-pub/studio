import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  awaitAuthFrame,
  handleConnection,
  resetBootstrapState,
  validateAuthForDocName,
} from './server.js';

/**
 * Tests for the multi-player server's WebSocket auth handshake.
 *
 * Connection contract:
 *   1. Client opens WS.
 *   2. Within 5s, client sends `{type:'auth', token:'<jwt>'}` text frame.
 *   3. Server verifies signature + exp; checks file_id matches docName
 *      (unless role='backend'); replies `{type:'auth_ok'}`.
 *   4. Y.js sync proceeds normally.
 *   On any failure the server closes the socket with code 4401.
 */

const SECRET = 'test-secret';

function makeMockWs() {
  const ws = new EventEmitter();
  ws.close = vi.fn();
  ws.send = vi.fn();
  ws.readyState = 1;
  ws.OPEN = 1;
  ws.removeListener = ws.off ?? EventEmitter.prototype.removeListener.bind(ws);
  return ws;
}

function mintToken(claims, ttlSecs = 60) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now, exp: now + ttlSecs, ...claims },
    SECRET,
    { algorithm: 'HS256' },
  );
}

// ---------------------------------------------------------------------------
// awaitAuthFrame
// ---------------------------------------------------------------------------

describe('awaitAuthFrame', () => {
  it('resolves with the decoded payload on a valid token', async () => {
    const ws = makeMockWs();
    const token = mintToken({ sub: '7', file_id: 1, role: 'EDITOR' });

    const p = awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 1000 });
    ws.emit('message', JSON.stringify({ type: 'auth', token }));
    const payload = await p;
    expect(payload.role).toBe('EDITOR');
    expect(payload.file_id).toBe(1);
  });

  it('rejects with auth-timeout if no message arrives in time', async () => {
    const ws = makeMockWs();
    await expect(
      awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 30 }),
    ).rejects.toThrow(/auth-timeout/);
  });

  it('rejects when the first message is not auth-typed JSON', async () => {
    const ws = makeMockWs();
    const p = awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 1000 });
    ws.emit('message', JSON.stringify({ type: 'sync', data: 'whatever' }));
    await expect(p).rejects.toThrow(/auth-missing/);
  });

  it('rejects when the first message is binary (non-JSON)', async () => {
    const ws = makeMockWs();
    const p = awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 1000 });
    ws.emit('message', Buffer.from([0x00, 0x01, 0x02]));
    await expect(p).rejects.toThrow(/auth-invalid|auth-missing/);
  });

  it('rejects expired tokens', async () => {
    const ws = makeMockWs();
    const expired = mintToken({ sub: '7', file_id: 1, role: 'EDITOR' }, -10);
    const p = awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 1000 });
    ws.emit('message', JSON.stringify({ type: 'auth', token: expired }));
    await expect(p).rejects.toThrow(/auth-invalid/);
  });

  it('rejects tokens signed with the wrong secret', async () => {
    const ws = makeMockWs();
    const bad = jwt.sign(
      { sub: '7', file_id: 1, role: 'EDITOR', exp: Math.floor(Date.now() / 1000) + 60 },
      'WRONG-SECRET',
      { algorithm: 'HS256' },
    );
    const p = awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 1000 });
    ws.emit('message', JSON.stringify({ type: 'auth', token: bad }));
    await expect(p).rejects.toThrow(/auth-invalid/);
  });

  it('rejects a token signed with alg "none"', async () => {
    const ws = makeMockWs();
    // The classic alg-confusion attack: an unsigned token asking the verifier
    // to skip signature checking. jwt.verify pins algorithms to HS256, so this
    // must be refused rather than trusted.
    const none = jwt.sign(
      { sub: '7', file_id: 1, role: 'EDITOR', exp: Math.floor(Date.now() / 1000) + 60 },
      '',
      { algorithm: 'none' },
    );
    const p = awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 1000 });
    ws.emit('message', JSON.stringify({ type: 'auth', token: none }));
    await expect(p).rejects.toThrow(/auth-invalid/);
  });

  it('rejects a token signed with RS256 (algorithm confusion)', async () => {
    const ws = makeMockWs();
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const rs = jwt.sign(
      { sub: '7', file_id: 1, role: 'EDITOR', exp: Math.floor(Date.now() / 1000) + 60 },
      privateKey,
      { algorithm: 'RS256' },
    );
    const p = awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 1000 });
    ws.emit('message', JSON.stringify({ type: 'auth', token: rs }));
    await expect(p).rejects.toThrow(/auth-invalid/);
  });

  it('rejects when the socket closes before sending auth', async () => {
    const ws = makeMockWs();
    const p = awaitAuthFrame(ws, { secret: SECRET, timeoutMs: 1000 });
    ws.emit('close');
    await expect(p).rejects.toThrow(/closed-before-auth/);
  });
});

// ---------------------------------------------------------------------------
// validateAuthForDocName
// ---------------------------------------------------------------------------

describe('validateAuthForDocName', () => {
  const FUTURE_EXP = Math.floor(Date.now() / 1000) + 300;

  it('accepts a matching file_id for normal roles', () => {
    expect(validateAuthForDocName({ role: 'EDITOR', file_id: 42, exp: FUTURE_EXP }, 'file-42-local')).toBe(null);
    expect(validateAuthForDocName({ role: 'OWNER', file_id: 7, exp: FUTURE_EXP }, 'file-7-local')).toBe(null);
    expect(validateAuthForDocName({ role: 'COMMENTER', file_id: 1, exp: FUTURE_EXP }, 'file-1-prod')).toBe(null);
  });

  it('rejects mismatched file_id', () => {
    expect(
      validateAuthForDocName({ role: 'EDITOR', file_id: 5, exp: FUTURE_EXP }, 'file-42-local'),
    ).toBe('auth-file-mismatch');
  });

  it('accepts a backend token whose file_id matches the docName, with or without exp', () => {
    expect(validateAuthForDocName({ role: 'backend', file_id: 1 }, 'file-1-local')).toBe(null);
    expect(validateAuthForDocName({ role: 'backend', file_id: 1, exp: FUTURE_EXP }, 'file-1-local')).toBe(null);
  });

  it('rejects a backend token whose file_id does not match the docName (room-jumping)', () => {
    expect(
      validateAuthForDocName({ role: 'backend', file_id: 999 }, 'file-1-local'),
    ).toBe('auth-file-mismatch');
    expect(
      validateAuthForDocName({ role: 'backend', file_id: 999, exp: FUTURE_EXP }, 'file-1-local'),
    ).toBe('auth-file-mismatch');
  });

  it('rejects a non-backend token with no exp', () => {
    expect(
      validateAuthForDocName({ role: 'EDITOR', file_id: 42 }, 'file-42-local'),
    ).toBe('auth-missing-exp');
  });

  it('rejects malformed payloads', () => {
    expect(validateAuthForDocName(null, 'file-1-local')).toMatch(/auth-invalid/);
    expect(validateAuthForDocName({}, 'file-1-local')).toMatch(/auth-invalid/);
    expect(validateAuthForDocName({ role: 'EDITOR', exp: FUTURE_EXP }, 'not-a-room')).toBe('auth-bad-docname');
  });
});

// ---------------------------------------------------------------------------
// handleConnection auth integration
// ---------------------------------------------------------------------------

describe('handleConnection auth integration', () => {
  let opts;

  beforeEach(() => {
    resetBootstrapState();
    opts = {
      fetch: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      backendUrl: 'http://localhost:8000',
      secret: SECRET,
      authSecret: SECRET,
      docs: new Map(),
      totalClientCount: () => 0,
    };
  });

  afterEach(() => {
    resetBootstrapState();
  });

  function makeReq(docName) {
    return {
      url: `/${docName}`,
      headers: { host: 'localhost:1234' },
    };
  }

  it('closes 4401 when no auth message arrives within timeout', async () => {
    const ws = makeMockWs();
    opts.authTimeoutMs = 30;

    await handleConnection(ws, makeReq('file-1-local'), opts);

    expect(ws.close).toHaveBeenCalledWith(4401, 'auth-failed');
  });

  it('drops a Y.js document message sent before the auth handshake', async () => {
    const ws = makeMockWs();
    opts.authTimeoutMs = 200;
    // A binary y-protocol frame (MESSAGE_SYNC, SYNC_STEP_1) in place of the
    // expected auth frame. It must not be applied: the socket is closed 4401
    // and never joins the room, so no auth_ok and no role tagging.
    const yjsFrame = Buffer.from([0x00, 0x00]);

    const p = handleConnection(ws, makeReq('file-1-local'), opts);
    setImmediate(() => ws.emit('message', yjsFrame));
    await p;

    expect(ws.close).toHaveBeenCalledWith(4401, 'auth-failed');
    expect(ws.send).not.toHaveBeenCalledWith(JSON.stringify({ type: 'auth_ok' }));
    expect(ws._role).toBeUndefined();
  });

  it('closes 4401 when token file_id does not match docName', async () => {
    const ws = makeMockWs();
    opts.authTimeoutMs = 200;
    const token = mintToken({ sub: '7', file_id: 999, role: 'EDITOR' });

    const p = handleConnection(ws, makeReq('file-1-local'), opts);
    setImmediate(() => ws.emit('message', JSON.stringify({ type: 'auth', token })));
    await p;

    expect(ws.close).toHaveBeenCalledWith(4401, 'auth-failed');
  });

  it('closes 4401 when token is expired', async () => {
    const ws = makeMockWs();
    opts.authTimeoutMs = 200;
    const token = mintToken({ sub: '7', file_id: 1, role: 'EDITOR' }, -1);

    const p = handleConnection(ws, makeReq('file-1-local'), opts);
    setImmediate(() => ws.emit('message', JSON.stringify({ type: 'auth', token })));
    await p;

    expect(ws.close).toHaveBeenCalledWith(4401, 'auth-failed');
  });

  it('closes 4401 when token has wrong signature', async () => {
    const ws = makeMockWs();
    opts.authTimeoutMs = 200;
    const token = jwt.sign(
      { sub: '7', file_id: 1, role: 'EDITOR', exp: Math.floor(Date.now() / 1000) + 60 },
      'wrong-secret',
      { algorithm: 'HS256' },
    );

    const p = handleConnection(ws, makeReq('file-1-local'), opts);
    setImmediate(() => ws.emit('message', JSON.stringify({ type: 'auth', token })));
    await p;

    expect(ws.close).toHaveBeenCalledWith(4401, 'auth-failed');
  });

  it('sends auth_ok and tags the role for a backend token', async () => {
    const ws = makeMockWs();
    // No file_id check needed for backend, but bootstrap shouldn't happen
    // either (backend is itself the persistence peer).
    opts.authTimeoutMs = 200;
    const token = mintToken({ sub: 'backend', file_id: 1, role: 'backend' });

    // Stub setupWSConnection by causing the docs map to never need it.
    // We can't easily mock the y-websocket import; instead we just verify
    // that auth_ok was sent and close was NOT called.
    const p = handleConnection(ws, makeReq('file-1-local'), opts);
    setImmediate(() => ws.emit('message', JSON.stringify({ type: 'auth', token })));

    // handleConnection will call setupWSConnection which may throw because
    // our ws is a mock — that's fine; we just need to verify auth_ok was sent
    // first and 4401 was never called.
    try {
      await p;
    } catch (_e) { /* setupWSConnection failure */ }

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'auth_ok' }));
    expect(ws.close).not.toHaveBeenCalledWith(4401, 'auth-failed');
    expect(ws._role).toBe('backend');
  });

  // Pre-seat a backend conn so needsBootstrap is false and handleConnection
  // goes straight to joinRoom, keeping the expiry tests off the bootstrap path.
  function seatBackendPeer(docName) {
    opts.docs.set(docName, { conns: new Map([[{ _role: 'backend', close: vi.fn() }, new Set()]]) });
  }

  it('closes a non-backend session when its token expires (std-knez)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const ws = makeMockWs();
      opts.authTimeoutMs = 200;
      seatBackendPeer('file-1-local');
      const token = mintToken({ sub: '7', file_id: 1, role: 'EDITOR' }, 300);

      const p = handleConnection(ws, makeReq('file-1-local'), opts);
      ws.emit('message', JSON.stringify({ type: 'auth', token }));
      try { await p; } catch (_e) { /* joinRoom/setupWSConnection on the mock ws */ }

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'auth_ok' }));
      expect(ws.close).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300 * 1000 + 1000);

      expect(ws.close).toHaveBeenCalledWith(4403, 'token-expired');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not bind the backend peer to token expiry', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const ws = makeMockWs();
      opts.authTimeoutMs = 200;
      const token = mintToken({ sub: 'backend', file_id: 1, role: 'backend' }, 300);

      const p = handleConnection(ws, makeReq('file-1-local'), opts);
      ws.emit('message', JSON.stringify({ type: 'auth', token }));
      try { await p; } catch (_e) { /* joinRoom/setupWSConnection on the mock ws */ }

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'auth_ok' }));

      vi.advanceTimersByTime(300 * 1000 + 1000);

      expect(ws.close).not.toHaveBeenCalledWith(4403, 'token-expired');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the expiry timer on a normal disconnect', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const ws = makeMockWs();
      opts.authTimeoutMs = 200;
      seatBackendPeer('file-1-local');
      const token = mintToken({ sub: '7', file_id: 1, role: 'EDITOR' }, 300);

      const p = handleConnection(ws, makeReq('file-1-local'), opts);
      ws.emit('message', JSON.stringify({ type: 'auth', token }));
      try { await p; } catch (_e) { /* joinRoom/setupWSConnection on the mock ws */ }

      // Client disconnects normally, well before the token would expire.
      ws.emit('close');
      vi.advanceTimersByTime(300 * 1000 + 1000);

      expect(ws.close).not.toHaveBeenCalledWith(4403, 'token-expired');
    } finally {
      vi.useRealTimers();
    }
  });
});
