/**
 * Manual LSP diagnostics integration for CodeMirror.
 *
 * This bypasses @codemirror/lsp-client's automatic diagnostics
 * and manually converts LSP publishDiagnostics to CodeMirror lint diagnostics.
 */

import { ref } from "vue";
import { linter } from "@codemirror/lint";

/**
 * Create a CodeMirror linter that displays LSP diagnostics.
 *
 * @param {string} serverUrl - WebSocket URL for LSP server
 * @param {string} documentUri - Document URI
 * @returns {Object} Linter extension and diagnostic update function
 */
export function useLSPDiagnostics(serverUrl, documentUri) {
  const diagnostics = ref([]);
  let socket = null;

  // Create linter extension that returns current diagnostics
  const linterExtension = linter((_view) => {
    console.log(`[LSP Diagnostics] Providing ${diagnostics.value.length} diagnostics`);
    return diagnostics.value;
  });

  /**
   * Connect to LSP server and listen for diagnostics.
   */
  function connect() {
    return new Promise((resolve, reject) => {
      socket = new WebSocket(serverUrl);

      socket.onopen = () => {
        console.log("[LSP Diagnostics] WebSocket connected");

        // Send initialize request
        const initializeRequest = {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            processId: null,
            rootUri: null,
            capabilities: {},
          },
        };

        socket.send(JSON.stringify(initializeRequest));
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle initialize response
          if (message.id === 1 && message.result) {
            console.log("[LSP Diagnostics] Server initialized");

            // Send initialized notification
            socket.send(
              JSON.stringify({
                jsonrpc: "2.0",
                method: "initialized",
                params: {},
              })
            );

            resolve();
          }

          // Handle publishDiagnostics
          if (message.method === "textDocument/publishDiagnostics") {
            const { uri, diagnostics: lspDiagnostics } = message.params;

            console.log(
              `[LSP Diagnostics] Received ${lspDiagnostics.length} diagnostics for ${uri}`
            );

            // Convert LSP diagnostics to CodeMirror format
            const cmDiagnostics = lspDiagnostics.map((diag) => ({
              from: positionToOffset(diag.range.start),
              to: positionToOffset(diag.range.end),
              severity: severityToString(diag.severity),
              message: diag.message,
            }));

            diagnostics.value = cmDiagnostics;
            console.log("[LSP Diagnostics] Converted diagnostics:", cmDiagnostics);
          }
        } catch (err) {
          console.error("[LSP Diagnostics] Message parse error:", err);
        }
      };

      socket.onerror = (error) => {
        console.error("[LSP Diagnostics] WebSocket error:", error);
        reject(error);
      };

      socket.onclose = () => {
        console.log("[LSP Diagnostics] WebSocket closed");
      };
    });
  }

  /**
   * Send textDocument/didOpen to LSP server.
   */
  function didOpen(text) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message = {
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri: documentUri,
            languageId: "rsm",
            version: 1,
            text,
          },
        },
      };

      socket.send(JSON.stringify(message));
      console.log("[LSP Diagnostics] Sent didOpen");
    }
  }

  /**
   * Send textDocument/didChange to LSP server.
   */
  function didChange(text, version) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message = {
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: {
            uri: documentUri,
            version,
          },
          contentChanges: [{ text }],
        },
      };

      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Disconnect from LSP server.
   */
  function disconnect() {
    if (socket) {
      socket.close();
      socket = null;
    }
  }

  // Helper: Convert LSP position to CodeMirror offset
  // NOTE: This is a simplified version - assumes line/character are correct
  function positionToOffset(position) {
    // For now, return approximate offset
    // TODO: Calculate actual offset from line/character
    return position.line * 80 + position.character;
  }

  // Helper: Convert LSP severity to CodeMirror severity string
  function severityToString(severity) {
    switch (severity) {
      case 1:
        return "error";
      case 2:
        return "warning";
      case 3:
        return "info";
      case 4:
        return "hint";
      default:
        return "error";
    }
  }

  return {
    linterExtension,
    connect,
    didOpen,
    didChange,
    disconnect,
    diagnostics,
  };
}
