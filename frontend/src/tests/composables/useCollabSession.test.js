import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";

// Mock the heavy collaboration deps so we can drive the session lifecycle in
// isolation. We record every provider constructed, with connect/disconnect/
// destroy spies, so we can assert on orphans and duplicate bootstraps directly.
const { providerInstances, MockWebsocketProvider } = vi.hoisted(() => {
  const instances = [];
  class MockWebsocketProvider {
    constructor(serverUrl, roomName, ydoc, opts) {
      this.serverUrl = serverUrl;
      this.roomname = roomName;
      this.ydoc = ydoc;
      this.opts = opts;
      this.awareness = { setLocalStateField: vi.fn(), getStates: () => new Map() };
      this.ws = { addEventListener: vi.fn() };
      this._handlers = {};
      this.connect = vi.fn();
      this.disconnect = vi.fn();
      this.destroy = vi.fn();
      instances.push(this);
    }
    on(event, cb) {
      (this._handlers[event] = this._handlers[event] || []).push(cb);
    }
    once(event, cb) {
      (this._handlers[event] = this._handlers[event] || []).push(cb);
    }
    emit(event, payload) {
      (this._handlers[event] || []).forEach((cb) => cb(payload));
    }
  }
  return { providerInstances: instances, MockWebsocketProvider };
});

vi.mock("y-websocket", () => ({ WebsocketProvider: MockWebsocketProvider }));

vi.mock("yjs", () => {
  class Doc {
    getText() {
      return { toString: () => "", observe: vi.fn(), unobserve: vi.fn() };
    }
    destroy() {}
  }
  return { Doc, Text: class {}, UndoManager: class {} };
});

vi.mock("@sentry/vue", () => ({ captureException: vi.fn() }));
vi.mock("@/utils/toast.js", () => ({ toast: { warning: vi.fn() } }));

import { useCollabSession } from "@/composables/useCollabSession";
import { captureException } from "@sentry/vue";
import { toast } from "@/utils/toast.js";

// A harness component that calls the composable in setup so onBeforeUnmount and
// watch run in a real component context. fileId is a ref we mutate from the test.
function mountSession(fileId, api) {
  const user = ref({ id: 1, name: "Tester", email: "t@example.com", avatar_color: "#123456" });
  let session = null;
  const wrapper = mount({
    setup() {
      session = useCollabSession(fileId, { api, user, serverUrl: "ws://test:1234" });
      return () => null;
    },
  });
  return {
    wrapper,
    get session() {
      return session;
    },
  };
}

// A controllable /collab/start: each call returns a promise we resolve by hand,
// so a superseded file's start can resolve AFTER the next file is requested,
// the deterministic stand-in for the sub-500ms switch race (no wall clock).
function makeApi() {
  const startDeferreds = [];
  const calls = [];
  const api = {
    post: vi.fn((url) => {
      calls.push(url);
      if (url.endsWith("/collab/start")) {
        let resolve;
        const p = new Promise((r) => {
          resolve = r;
        });
        startDeferreds.push({ url, resolve });
        return p;
      }
      // /collab/stop resolves immediately
      return Promise.resolve({ data: {} });
    }),
    calls,
    startDeferreds,
  };
  return api;
}

beforeEach(() => {
  providerInstances.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useCollabSession: panel-independent connect", () => {
  it("starts a session for a file id with no editor/panel involved", async () => {
    const api = makeApi();
    const fileId = ref(101);
    const { wrapper } = mountSession(fileId, api);
    await flushPromises();

    // The start is awaiting its token; resolve it.
    expect(api.startDeferreds).toHaveLength(1);
    api.startDeferreds[0].resolve({ data: { token: "tok-101" } });
    await flushPromises();

    expect(api.calls).toContain("/files/101/collab/start");
    expect(providerInstances).toHaveLength(1);
    expect(providerInstances[0].roomname).toContain("file-101");
    // The session exposes the live doc for annotation anchoring, panel or not.
    expect(window.__ydoc).toBeTruthy();
    expect(window.__provider).toBe(providerInstances[0]);

    wrapper.unmount();
  });
});

describe("useCollabSession: rapid file switching", () => {
  it("leaves exactly one live provider and stops each superseded file", async () => {
    const api = makeApi();
    const fileId = ref(1);
    const { wrapper } = mountSession(fileId, api);
    await flushPromises(); // start(1) now awaiting its token

    fileId.value = 2;
    await nextTick();
    await flushPromises(); // start(2) awaiting

    fileId.value = 3;
    await nextTick();
    await flushPromises(); // start(3) awaiting

    // Resolve the abandoned starts LATE (out of order), then the current one.
    const d1 = api.startDeferreds.find((d) => d.url === "/files/1/collab/start");
    const d2 = api.startDeferreds.find((d) => d.url === "/files/2/collab/start");
    const d3 = api.startDeferreds.find((d) => d.url === "/files/3/collab/start");
    d1.resolve({ data: { token: "t1" } });
    d2.resolve({ data: { token: "t2" } });
    d3.resolve({ data: { token: "t3" } });
    await flushPromises();

    // No orphans: only the final file's provider was ever constructed, because
    // the superseded starts bailed on the generation guard after their await.
    expect(providerInstances).toHaveLength(1);
    expect(providerInstances[0].roomname).toContain("file-3");
    expect(providerInstances[0].destroy).not.toHaveBeenCalled();

    // Balanced backend lifecycle: a stop for each superseded file, none for the
    // final one, and a start attempted for all three.
    expect(api.calls).toContain("/files/1/collab/stop");
    expect(api.calls).toContain("/files/2/collab/stop");
    expect(api.calls).not.toContain("/files/3/collab/stop");
    expect(api.calls.filter((u) => u.endsWith("/collab/start"))).toHaveLength(3);

    wrapper.unmount();
  });
});

describe("useCollabSession: retry", () => {
  it("clears the failure flag and forces a reconnect (the wrapper re-mints)", async () => {
    const api = makeApi();
    const fileId = ref(7);
    const { wrapper, ...h } = mountSession(fileId, api);
    await flushPromises();

    // First start (the pre-warm) returns no token -> the session is marked failed,
    // but the provider is still created so a reconnect can re-mint through it.
    api.startDeferreds[0].resolve({ data: {} });
    await flushPromises();
    expect(h.session.collabStartFailed.value).toBe(true);
    expect(providerInstances).toHaveLength(1);

    // Retry drops the cached token, clears the flag, and forces a reconnect. The
    // fresh mint happens in the wrapper's fetcher on the next real connect, which
    // the mocked provider does not perform, so we assert the reconnect, not a token.
    h.session.retry();

    expect(h.session.collabStartFailed.value).toBe(false);
    expect(providerInstances[0].disconnect).toHaveBeenCalled();
    expect(providerInstances[0].connect).toHaveBeenCalled();

    wrapper.unmount();
  });
});

describe("useCollabSession: failure surfacing (migrated from EditorCollabRetry)", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marks collabStartFailed when /collab/start rejects, and still creates a provider to retry into", async () => {
    const api = { post: vi.fn().mockRejectedValue({ response: { status: 503 }, message: "down" }) };
    const fileId = ref(42);
    const { wrapper, ...h } = mountSession(fileId, api);
    await flushPromises();

    expect(h.session.collabStartFailed.value).toBe(true);
    expect(providerInstances).toHaveLength(1);

    wrapper.unmount();
  });

  it("clears collabStartFailed when the provider later reports connected on its own", async () => {
    const api = { post: vi.fn().mockRejectedValue({ response: { status: 503 }, message: "down" }) };
    const fileId = ref(42);
    const { wrapper, ...h } = mountSession(fileId, api);
    await flushPromises();
    expect(h.session.collabStartFailed.value).toBe(true);

    providerInstances[0].emit("status", { status: "connected" });
    await nextTick();

    expect(h.session.isConnected.value).toBe(true);
    expect(h.session.collabStartFailed.value).toBe(false);

    wrapper.unmount();
  });

  it("reports a failed /collab/stop on teardown instead of swallowing it (std-eisqeg)", async () => {
    const stopError = new Error("stop failed");
    const api = {
      post: vi.fn().mockImplementation((url) => {
        if (url.includes("/collab/stop")) return Promise.reject(stopError);
        return Promise.resolve({ data: { token: "tok" } });
      }),
    };
    const fileId = ref(77);
    const { wrapper } = mountSession(fileId, api);
    await flushPromises();

    wrapper.unmount();
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith("/files/77/collab/stop");
    expect(captureException).toHaveBeenCalledWith(stopError);
    expect(toast.warning).toHaveBeenCalled();
  });
});
