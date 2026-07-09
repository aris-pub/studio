import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createIndexReadyTracker } from "@/composables/useLSPClient.js";

const URI = "file:///1.rsm";
const readyMsg = (uri = URI, version = 3) =>
  JSON.stringify({ jsonrpc: "2.0", method: "rsm/indexReady", params: { uri, version } });

/**
 * Contract for awaiting rsm/indexReady (std-vp3i): source<->preview navigation
 * waits for the LSP's nodeid index to exist instead of blind-polling. Deterministic
 * with fake timers.
 */
describe("createIndexReadyTracker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves immediately if a ready signal was already seen for the uri", async () => {
    const t = createIndexReadyTracker();
    t.handleMessage(readyMsg(URI, 5));
    await expect(t.awaitReady(URI)).resolves.toBe(5);
  });

  it("resolves when the ready signal arrives while awaiting", async () => {
    const t = createIndexReadyTracker();
    const p = t.awaitReady(URI);
    t.handleMessage(readyMsg(URI, 7));
    await expect(p).resolves.toBe(7);
  });

  it("resolves null after the timeout when no signal arrives", async () => {
    const t = createIndexReadyTracker();
    const p = t.awaitReady(URI, { timeout: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toBeNull();
  });

  it("ignores non-indexReady, malformed, and uri-less messages", async () => {
    const t = createIndexReadyTracker();
    t.handleMessage("not json");
    t.handleMessage(JSON.stringify({ method: "textDocument/publishDiagnostics", params: {} }));
    t.handleMessage(JSON.stringify({ method: "rsm/indexReady", params: {} }));
    const p = t.awaitReady(URI, { timeout: 500 });
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBeNull();
  });

  it("resolves null for a missing uri", async () => {
    const t = createIndexReadyTracker();
    await expect(t.awaitReady(null)).resolves.toBeNull();
  });

  it("accepts an already-parsed object message", async () => {
    const t = createIndexReadyTracker();
    t.handleMessage({ method: "rsm/indexReady", params: { uri: URI, version: 9 } });
    await expect(t.awaitReady(URI)).resolves.toBe(9);
  });

  it("reset clears seen versions and pending waiters", async () => {
    const t = createIndexReadyTracker();
    t.handleMessage(readyMsg(URI, 2));
    t.reset();
    const p = t.awaitReady(URI, { timeout: 300 });
    await vi.advanceTimersByTimeAsync(300);
    await expect(p).resolves.toBeNull();
  });

  it("tracks readiness per uri independently", async () => {
    const t = createIndexReadyTracker();
    t.handleMessage(readyMsg("file:///a.rsm", 1));
    await expect(t.awaitReady("file:///a.rsm")).resolves.toBe(1);
    const pB = t.awaitReady("file:///b.rsm", { timeout: 200 });
    await vi.advanceTimersByTimeAsync(200);
    await expect(pB).resolves.toBeNull();
  });
});
