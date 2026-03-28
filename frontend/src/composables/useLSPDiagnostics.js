/**
 * Manual LSP diagnostics integration for CodeMirror.
 *
 * This bypasses @codemirror/lsp-client's automatic diagnostics
 * and manually converts LSP publishDiagnostics to CodeMirror lint diagnostics.
 */

import { ref } from "vue";
import { linter } from "@codemirror/lint";

/**
 * Convert LSP position {line, character} to CodeMirror absolute offset.
 * LSP lines are 0-based; CodeMirror doc.line() is 1-based.
 * Returns null if the position is out of range.
 */
export function positionToOffset(doc, position) {
  const lineNumber = position.line + 1;
  if (lineNumber < 1 || lineNumber > doc.lines) return null;
  const line = doc.line(lineNumber);
  const offset = line.from + position.character;
  return Math.min(offset, line.to);
}

/**
 * Convert LSP severity (1-4) to CodeMirror severity string.
 */
export function severityToString(severity) {
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

/**
 * Create a CodeMirror linter that displays LSP diagnostics.
 *
 * @param {string} serverUrl - WebSocket URL for LSP server
 * @param {string} documentUri - Document URI
 * @returns {Object} Linter extension and diagnostic update function
 */
export function useLSPDiagnostics(serverUrl, documentUri) {
  const diagnostics = ref([]);
  const rawDiagnostics = ref([]);
  let socket = null;

  // Create linter extension that converts raw LSP diagnostics using the actual document
  const linterExtension = linter((view) => {
    const doc = view.state.doc;
    const cmDiagnostics = rawDiagnostics.value
      .map((diag) => {
        const from = positionToOffset(doc, diag.range.start);
        const to = positionToOffset(doc, diag.range.end);
        if (from === null || to === null) return null;
        return {
          from,
          to,
          severity: severityToString(diag.severity),
          message: diag.message,
        };
      })
      .filter(Boolean);
    diagnostics.value = cmDiagnostics;
    console.log(`[LSP Diagnostics] Providing ${cmDiagnostics.length} diagnostics`);
    return cmDiagnostics;
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

            rawDiagnostics.value = lspDiagnostics;
            console.log("[LSP Diagnostics] Stored raw diagnostics for next lint pass");
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

  return {
    linterExtension,
    connect,
    didOpen,
    didChange,
    disconnect,
    diagnostics,
  };
}
