import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { lspRequestWithRetry } from "@/composables/useSourcePreviewNav.js";

/**
 * Unit contract for the bounded retry that fixes std-9hfk: rsm/nodePosition
 * returns null while the LSP is (re)building its nodeid index, and the source<->
 * preview navigation must retry instead of silently giving up on the first null.
 * These are deterministic (fake timers) so they don't depend on real LSP timing.
 */
describe("lspRequestWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Drive a retry call to completion while advancing the fake delay timers.
  async function runToCompletion(promise) {
    await vi.runAllTimersAsync();
    return promise;
  }

  it("returns the first truthy result without any delay", async () => {
    const requestFn = vi.fn().mockResolvedValue({ startLine: 4 });
    const result = await runToCompletion(
      lspRequestWithRetry(requestFn, { maxAttempts: 14, delayMs: 150 })
    );
    expect(result).toEqual({ startLine: 4 });
    expect(requestFn).toHaveBeenCalledTimes(1); // resolved on attempt 1, no retry
  });

  it("retries on null and returns once a later attempt resolves", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ nodeid: 3 });
    const result = await runToCompletion(
      lspRequestWithRetry(requestFn, { maxAttempts: 14, delayMs: 150 })
    );
    expect(result).toEqual({ nodeid: 3 });
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it("gives up after maxAttempts and returns null", async () => {
    const requestFn = vi.fn().mockResolvedValue(null);
    const result = await runToCompletion(
      lspRequestWithRetry(requestFn, { maxAttempts: 5, delayMs: 150 })
    );
    expect(result).toBeNull();
    expect(requestFn).toHaveBeenCalledTimes(5); // exactly maxAttempts, no more
  });

  it("treats any falsy result as a retry signal", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce({ ok: true });
    const result = await runToCompletion(
      lspRequestWithRetry(requestFn, { maxAttempts: 14, delayMs: 150 })
    );
    expect(result).toEqual({ ok: true });
    expect(requestFn).toHaveBeenCalledTimes(4);
  });
});
