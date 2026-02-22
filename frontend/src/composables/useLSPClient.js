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
 * @returns {Promise<Object>} Transport object with send/subscribe/unsubscribe methods
 */
function createWebSocketTransport(uri) {
  return new Promise((resolve, reject) => {
    const handlers = [];
    const socket = new WebSocket(uri);

    socket.onopen = () => {
      console.log("[LSP] WebSocket connected");
      resolve({
        send(message) {
          if (socket.readyState === WebSocket.OPEN) {
            console.log("[LSP Transport] Sending:", message.substring(0, 200));
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
      console.log("[LSP Transport] Received:", message.substring(0, 200));
      for (const handler of handlers) {
        handler(message);
      }
    };

    socket.onerror = (error) => {
      console.error("[LSP] WebSocket error:", error);
      reject(error);
    };

    socket.onclose = () => {
      console.log("[LSP] WebSocket closed");
    };

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
export function useLSPClient({ serverUrl, documentUri }) {
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
    console.log("[LSP CONNECT] Function called - BUILD TIMESTAMP:", Date.now());
    try {
      console.log("[LSP] Connecting to server:", serverUrl);

      // Create WebSocket transport (async)
      transport.value = await createWebSocketTransport(serverUrl);

      // Create LSP client with CodeMirror extensions (sync after transport ready)
      const extensions = languageServerExtensions();

      client.value = new LSPClient({
        rootUri: "file:///",
        extensions,
      }).connect(transport.value);

      // Wait for client to initialize before creating plugin
      console.log("[LSP] Waiting for client initialization...");
      await client.value.initializing;
      console.log("[LSP] ✅ Client initialized");

      // Create CodeMirror plugin for this document (sync after initialization)
      const uri = getDocumentUri();
      // CRITICAL: Use toRaw() to unwrap the client before calling plugin()
      // Otherwise Vue wraps the returned extension in a Proxy, breaking ViewPlugin registration
      plugin.value = toRaw(client.value).plugin(uri, "rsm");

      isConnected.value = true;
      console.log("[LSP] ✅ Plugin created for:", uri);

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

    console.log("[LSP] Disconnected");
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
  };
}
