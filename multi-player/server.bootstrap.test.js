import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ensureBackendForRoom,
  parseFileIdFromDocName,
  resetBootstrapState,
} from './server.js';

/**
 * Tests for the auto-bootstrap path: when a non-backend client joins a
 * room with no backend YDocClient present, the multi-player server asks
 * the backend (via /internal/collab/start) to spin one up.
 *
 * The function under test is pure-ish: it takes a docName and an options
 * bag with `{fetch, backendUrl, secret}`, returns a Promise. Internal
 * state is the in-flight Map, which we reset between tests via
 * `resetBootstrapState()`.
 */

describe('parseFileIdFromDocName', () => {
  it('extracts numeric file_id from file-{id}-{env}', () => {
    expect(parseFileIdFromDocName('file-1-local')).toBe(1);
    expect(parseFileIdFromDocName('file-322-dev')).toBe(322);
    expect(parseFileIdFromDocName('file-99999-prod')).toBe(99999);
  });

  it('returns null for malformed names', () => {
    expect(parseFileIdFromDocName('foo')).toBe(null);
    expect(parseFileIdFromDocName('file--local')).toBe(null);
    expect(parseFileIdFromDocName('file-abc-local')).toBe(null);
    expect(parseFileIdFromDocName('')).toBe(null);
  });
});

describe('ensureBackendForRoom', () => {
  let mockFetch;

  beforeEach(() => {
    resetBootstrapState();
    mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    resetBootstrapState();
  });

  it('POSTs to backend /internal/collab/start with the secret header', async () => {
    await ensureBackendForRoom('file-1-local', {
      fetch: mockFetch,
      backendUrl: 'http://localhost:8000',
      secret: 'top-secret',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/internal/collab/start');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Internal-Secret']).toBe('top-secret');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ file_id: 1 });
  });

  it('dedupes concurrent calls for the same docName', async () => {
    let resolveFetch;
    mockFetch = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));

    const opts = { fetch: mockFetch, backendUrl: 'http://x', secret: 's' };

    const p1 = ensureBackendForRoom('file-7-local', opts);
    const p2 = ensureBackendForRoom('file-7-local', opts);
    const p3 = ensureBackendForRoom('file-7-local', opts);

    // All three should share one fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);

    resolveFetch({ ok: true, status: 200 });
    await Promise.all([p1, p2, p3]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT dedupe across different docNames', async () => {
    await ensureBackendForRoom('file-1-local', {
      fetch: mockFetch, backendUrl: 'http://x', secret: 's',
    });
    await ensureBackendForRoom('file-2-local', {
      fetch: mockFetch, backendUrl: 'http://x', secret: 's',
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ file_id: 1 });
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ file_id: 2 });
  });

  it('clears the in-flight entry on failure so retries can happen', async () => {
    mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const opts = { fetch: mockFetch, backendUrl: 'http://x', secret: 's' };

    await expect(ensureBackendForRoom('file-1-local', opts)).rejects.toThrow();

    // Second call must trigger a new fetch (entry was cleared on rejection)
    await ensureBackendForRoom('file-1-local', opts);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on non-2xx response', async () => {
    mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(
      ensureBackendForRoom('file-1-local', {
        fetch: mockFetch, backendUrl: 'http://x', secret: 's',
      })
    ).rejects.toThrow(/503/);
  });

  it('rejects malformed docName before attempting fetch', async () => {
    await expect(
      ensureBackendForRoom('not-a-room', {
        fetch: mockFetch, backendUrl: 'http://x', secret: 's',
      })
    ).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps the in-flight entry briefly after success, then expires it', async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const opts = { fetch: mockFetch, backendUrl: 'http://x', secret: 's', successTtlMs: 1000 };

      await ensureBackendForRoom('file-1-local', opts);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // While entry is still cached, a follow-up call returns the cached promise
      await ensureBackendForRoom('file-1-local', opts);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance past the TTL — entry should be cleared
      vi.advanceTimersByTime(1100);

      await ensureBackendForRoom('file-1-local', opts);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
