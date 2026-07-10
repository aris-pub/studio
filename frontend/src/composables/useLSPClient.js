/**
 * LSP Client composable for CodeMirror integration.
 *
 * Manages WebSocket connection to the RSM LSP server and provides
 * CodeMirror extensions for diagnostics and completion.
 */

import { ref, onUnmounted, toRaw } from "vue";
import { LSPClient, languageServerExtensions } from "@codemirror/lsp-client";

/**
 * Create WebSocket transport for LSP communication.
 *
 * @param {string} uri - WebSocket URI (e.g., "ws://localhost:8080/ws/lsp")
 * @param {string} [token] - Access JWT, sent as the ["lsp", token] subprotocol.
 *   A browser cannot set an Authorization header on a WebSocket, so the backend
 *   reads the token from Sec-WebSocket-Protocol and verifies it during the
 *   handshake (before accepting the socket or spawning the LSP process).
 * @returns {Promise<Object>} Transport object with send/subscribe/unsubscribe methods
 */
function createWebSocketTransport(uri, token) {
  return new Promise((resolve, reject) => {
    const handlers = [];
    const socket = new WebSocket(uri, token ? ["lsp", token] : ["lsp"]);

    socket.onopen = () => {
      resolve({
        send(message) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(message);
          }
        },
        subscribe(handler) {
          handlers.push(handler);
        },
        unsubscribe(handler) {
          const index = handlers.indexOf(handler);
          if (index !== -1) {
            handlers.splice(index, 1);
          }
        },
      });
    };

    socket.onmessage = (event) => {
      const message = event.data.toString();
      for (const handler of handlers) {
        handler(message);
      }
    };

    socket.onerror = (error) => {
      console.error("[LSP] WebSocket error:", error);
      reject(error);
    };

    socket.onclose = () => {};

    // Store socket for cleanup
    resolve.socket = socket;
  });
}

/**
 * Use LSP client for CodeMirror.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.serverUrl - WebSocket URL for LSP server
 * @param {import('vue').Ref<string>|string} options.documentUri - Document URI (e.g., "file:///document.rsm")
 * @returns {Object} LSP client state and methods
 */
/**
 * Track `rsm/indexReady` notifications from the LSP server so callers can await
 * the point at which a document's nodeid<->source index exists, instead of
 * blind-polling. Extracted (and exported) so the await/timeout/resolve contract
 * is unit-testable without a WebSocket.
 *
 * The server emits `rsm/indexReady { uri, version }` after it (re)builds the AST
 * index for a document (see aris-pub/rsm). `awaitReady(uri)` resolves immediately
 * if a signal was already seen for that uri, else waits for the next one, and
 * falls through after `timeout` so a caller proceeds to its own fallback (the
 * bounded retry) rather than hang.
 */
export function createIndexReadyTracker() {
  const versions = new Map(); // uri -> latest ready version
  const waiters = new Map(); // uri -> Set<resolve>

  function handleMessage(raw) {
    let msg;
    try {
      msg = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return;
    }
    if (msg?.method !== "rsm/indexReady") return;
    const uri = msg.params?.uri;
    if (!uri) return;
    versions.set(uri, msg.params.version);
    const set = waiters.get(uri);
    if (set) {
      for (const resolve of set) resolve(msg.params.version);
      set.clear();
    }
  }

  function awaitReady(uri, { timeout = 5000 } = {}) {
    if (!uri) return Promise.resolve(null);
    if (versions.has(uri)) return Promise.resolve(versions.get(uri));
    return new Promise((resolve) => {
      let set = waiters.get(uri);
      if (!set) {
        set = new Set();
        waiters.set(uri, set);
      }
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        set.delete(done);
        resolve(v ?? null);
      };
      set.add(done);
      const timer = setTimeout(() => done(null), timeout);
    });
  }

  function reset() {
    versions.clear();
    for (const set of waiters.values()) set.clear();
    waiters.clear();
  }

  return { handleMessage, awaitReady, reset };
}

export function useLSPClient({ serverUrl, documentUri, token }) {
  const indexReady = createIndexReadyTracker();

  // Resolve the auth token fresh at connect time (it may be a getter/ref so a
  // refreshed access token is picked up on reconnect). Accepts a string, a Vue
  // ref, or a function.
  function resolveToken() {
    if (typeof token === "function") return token();
    if (token && typeof token === "object" && "value" in token) return token.value;
    return token;
  }
  const client = ref(null);
  const plugin = ref(null);
  const transport = ref(null);
  const isConnected = ref(false);
  const error = ref(null);

  /**
   * Get the current document URI value (handles both refs and plain strings).
   */
  function getDocumentUri() {
    return typeof documentUri === "object" && "value" in documentUri
      ? documentUri.value
      : documentUri;
  }

  /**
   * Initialize LSP client and connect to server.
   * Returns the plugin extension that should be added to the editor.
   */
  async function connect() {
    try {
      // Create WebSocket transport (async)
      transport.value = await createWebSocketTransport(serverUrl, resolveToken());

      // Observe rsm/indexReady notifications alongside the LSP client's own
      // handling (the transport fans every message out to all subscribers), so
      // source<->preview navigation can await index readiness deterministically.
      transport.value.subscribe(indexReady.handleMessage);

      // Create LSP client with CodeMirror extensions (sync after transport ready)
      const extensions = languageServerExtensions();

      client.value = new LSPClient({
        rootUri: "file:///",
        extensions,
      }).connect(transport.value);

      // Wait for client to initialize before creating plugin
      await client.value.initializing;

      // Create CodeMirror plugin for this document (sync after initialization)
      const uri = getDocumentUri();
      // CRITICAL: Use toRaw() to unwrap the client before calling plugin()
      // Otherwise Vue wraps the returned extension in a Proxy, breaking ViewPlugin registration
      plugin.value = toRaw(client.value).plugin(uri, "rsm");

      isConnected.value = true;

      // Return unwrapped plugin - MUST be raw for CodeMirror to register ViewPlugins
      return toRaw(plugin.value);
    } catch (err) {
      error.value = err;
      isConnected.value = false;
      console.error("[LSP] ❌ Connection failed:", err);
      throw err;
    }
  }

  /**
   * Disconnect from LSP server and clean up.
   */
  function disconnect() {
    if (transport.value?.socket) {
      transport.value.socket.close();
      transport.value = null;
    }

    client.value = null;
    plugin.value = null;
    isConnected.value = false;
    indexReady.reset();
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    client, // Expose client so we can access its extensions
    plugin,
    isConnected,
    error,
    connect,
    disconnect,
    // Resolve once the LSP's nodeid<->source index is ready for a document uri.
    awaitIndexReady: indexReady.awaitReady,
  };
}
