import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, shallowRef } from "vue";

import { lspRequestWithRetry, useSourcePreviewNav } from "@/composables/useSourcePreviewNav.js";

vi.mock("@/utils/toast.js", () => ({
  toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

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

/**
 * Delayed pending cue (std-fda7): a cold Cmd+click jump can wait ~750ms to 2s, so
 * the preview pane shows a busy pointer after a short threshold. The one real risk
 * is the cue getting stuck on, so these pin that it clears on every exit path.
 */
describe("navigateToSource pending cue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeNav({
    gate,
    pos = { startLine: 0, endLine: 0, contentStartLine: 0, contentStartCol: 0 },
  }) {
    const lspClient = shallowRef({ request: vi.fn().mockResolvedValue(pos) });
    const documentUri = ref("file:///1.rsm");
    // No editor view: navigateToSource returns before the scroll, so the finally
    // (not the scroll path) is what clears the cue — exactly what we want to pin.
    const cmView = shallowRef(null);
    const awaitIndexReady = shallowRef(() => (gate ? gate : Promise.resolve()));
    return useSourcePreviewNav({
      lspClient,
      documentUri,
      cmView,
      manuscriptRef: ref(null),
      awaitIndexReady,
    });
  }

  it("shows a busy cue on the pane after the delay and clears it when the jump resolves", async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const nav = makeNav({ gate });
    const pane = document.createElement("div");

    const p = nav.navigateToSource(1, pane);
    expect(pane.classList.contains("nav-pending")).toBe(false); // nothing before the delay

    await vi.advanceTimersByTimeAsync(250);
    expect(pane.classList.contains("nav-pending")).toBe(true); // shown once slow

    release();
    await vi.runAllTimersAsync();
    await p;
    expect(pane.classList.contains("nav-pending")).toBe(false); // cleared on completion
  });

  it("clears the cue when the jump gives up (no source position)", async () => {
    const nav = makeNav({ pos: null });
    const pane = document.createElement("div");

    const p = nav.navigateToSource(1, pane);
    await vi.advanceTimersByTimeAsync(250);
    expect(pane.classList.contains("nav-pending")).toBe(true);

    await vi.runAllTimersAsync(); // churn the bounded retries to the give-up
    await p;
    expect(pane.classList.contains("nav-pending")).toBe(false);
  });

  it("does not arm the cue when there is no document uri", async () => {
    const nav = useSourcePreviewNav({
      lspClient: shallowRef(null),
      documentUri: ref(null),
      cmView: shallowRef(null),
      manuscriptRef: ref(null),
      awaitIndexReady: shallowRef(() => Promise.resolve()),
    });
    const pane = document.createElement("div");

    await nav.navigateToSource(1, pane);
    await vi.runAllTimersAsync();
    expect(pane.classList.contains("nav-pending")).toBe(false);
  });
});
