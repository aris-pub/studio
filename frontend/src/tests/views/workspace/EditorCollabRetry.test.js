import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref, shallowRef, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { AuthedWebSocket } from "@/composables/authedWebSocket";

// EditorCodeMirror pulls in CodeMirror, Yjs, y-websocket and the LSP stack.
// We stub all of it so the test can drive the collab-start / retry logic in
// isolation, mocking only the API and the WebSocket provider (per std-liw8).

// Hoisted so the (hoisted) vi.mock factory below can reference the class, while
// the test body can still read the recorded provider instances.
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
    once() {}
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
  class UndoManager {
    constructor() {
      this.undoStack = [];
    }
    on() {}
  }
  return { Doc, UndoManager, Text: class {} };
});

vi.mock("y-codemirror.next", () => ({ yCollab: () => [], yUndoManagerKeymap: [] }));

vi.mock("@codemirror/view", () => {
  class EditorView {
    constructor(config) {
      this.config = config;
    }
    destroy() {}
    dispatch() {}
  }
  EditorView.updateListener = { of: () => ({}) };
  EditorView.editable = { of: () => ({}) };
  EditorView.lineWrapping = {};
  EditorView.theme = () => ({});
  const ext = () => ({});
  return {
    EditorView,
    keymap: { of: () => ({}) },
    lineNumbers: ext,
    highlightActiveLineGutter: ext,
    highlightSpecialChars: ext,
    drawSelection: ext,
    dropCursor: ext,
    rectangularSelection: ext,
    crosshairCursor: ext,
    highlightActiveLine: ext,
  };
});

vi.mock("@codemirror/state", () => {
  class Compartment {
    of() {
      return {};
    }
    reconfigure() {
      return {};
    }
  }
  return {
    EditorState: {
      allowMultipleSelections: { of: () => ({}) },
      readOnly: { of: () => ({}) },
      create: () => ({}),
    },
    Compartment,
    StateEffect: { appendConfig: { of: () => ({}) } },
  };
});

vi.mock("@codemirror/language", () => {
  const ext = () => ({});
  return {
    defaultHighlightStyle: {},
    syntaxHighlighting: ext,
    indentOnInput: ext,
    bracketMatching: ext,
    foldGutter: ext,
    foldKeymap: [],
  };
});

vi.mock("@codemirror/commands", () => ({ defaultKeymap: [] }));
vi.mock("@codemirror/search", () => ({
  search: () => ({}),
  highlightSelectionMatches: () => ({}),
}));
vi.mock("@codemirror/autocomplete", () => ({
  autocompletion: () => ({}),
  completionKeymap: [],
  closeBrackets: () => ({}),
  closeBracketsKeymap: [],
}));
vi.mock("@codemirror/lint", () => ({ lintKeymap: [], lintGutter: () => ({}) }));

vi.mock("@/composables/useLSPClient", async () => {
  const { ref: r, shallowRef: sr } = await import("vue");
  return {
    useLSPClient: () => ({
      client: sr(null),
      isConnected: r(false),
      connect: vi.fn().mockResolvedValue(null),
      disconnect: vi.fn(),
      awaitIndexReady: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

vi.mock("@/composables/useSemanticTokens", () => ({
  semanticTokensExtension: () => ({}),
  requestSemanticTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/composables/useRSMCommands", () => ({ rsmKeymap: [] }));
vi.mock("@/composables/useFileEvents.js", () => ({
  useFileEvents: () => ({ close: vi.fn() }),
}));

import EditorCodeMirror from "@/views/workspace/EditorCodeMirror.vue";

describe("EditorCodeMirror — collab-start failure surfacing and retry", () => {
  let mockApi;
  let collabIsConnected;
  let collabConnectError;
  let collabRetry;
  let consoleErrorSpy;

  beforeEach(() => {
    providerInstances.length = 0;
    AuthedWebSocket._tokens.clear();
    vi.spyOn(AuthedWebSocket, "registerToken");
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockApi = { post: vi.fn(), get: vi.fn().mockResolvedValue({ data: {} }) };
    collabIsConnected = ref(false);
    collabConnectError = ref(false);
    collabRetry = shallowRef(null);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  const mountEditor = () =>
    mount(EditorCodeMirror, {
      props: { modelValue: { id: 42, source: "", role: "AUTHOR" } },
      global: {
        provide: {
          api: mockApi,
          user: ref({ id: 1, name: "Tester", email: "t@e.com", avatar_color: "#0E9AE9" }),
          mobileMode: ref(false),
          compile: vi.fn(),
          cmView: shallowRef(null),
          cursorPos: ref(0),
          ydoc: shallowRef(null),
          ytext: shallowRef(null),
          awareness: shallowRef(null),
          collabIsConnected,
          collabIsSynced: ref(false),
          collabConnectError,
          collabRetry,
        },
      },
    });

  it("surfaces a connect-error state when /collab/start fails, then a retry clears it on success", async () => {
    mockApi.post.mockRejectedValue({ response: { status: 503 }, message: "backend down" });

    const wrapper = mountEditor();
    await flushPromises();
    await nextTick();

    // The failed start is surfaced to the shared status-bar ref, and a retry
    // handler is published for the Retry affordance.
    expect(collabConnectError.value).toBe(true);
    expect(typeof collabRetry.value).toBe("function");
    expect(providerInstances).toHaveLength(1);

    // Retry now succeeds: fresh token, provider forced to reconnect immediately.
    mockApi.post.mockReset();
    mockApi.post.mockResolvedValue({ data: { token: "fresh-tok" } });

    await collabRetry.value();
    await flushPromises();

    expect(collabConnectError.value).toBe(false);
    expect(mockApi.post).toHaveBeenCalledWith("/files/42/collab/start");
    expect(AuthedWebSocket.registerToken).toHaveBeenLastCalledWith(
      expect.stringContaining("file-42"),
      "fresh-tok"
    );
    const provider = providerInstances[0];
    expect(provider.disconnect).toHaveBeenCalledTimes(1);
    expect(provider.connect).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it("keeps the connect-error state when a retry also fails", async () => {
    mockApi.post.mockRejectedValue({ response: { status: 503 }, message: "still down" });

    const wrapper = mountEditor();
    await flushPromises();
    await nextTick();
    expect(collabConnectError.value).toBe(true);

    await collabRetry.value();
    await flushPromises();

    expect(collabConnectError.value).toBe(true);

    wrapper.unmount();
  });

  it("clears the connect-error state when the connection later succeeds on its own", async () => {
    mockApi.post.mockRejectedValue({ response: { status: 503 }, message: "down" });

    const wrapper = mountEditor();
    await flushPromises();
    await nextTick();
    expect(collabConnectError.value).toBe(true);

    // y-websocket eventually reconnects (e.g. backend recovered): the provider
    // emits a 'connected' status, which must clear the surfaced error.
    providerInstances[0].emit("status", { status: "connected" });
    await nextTick();

    expect(collabIsConnected.value).toBe(true);
    expect(collabConnectError.value).toBe(false);

    wrapper.unmount();
  });
});
