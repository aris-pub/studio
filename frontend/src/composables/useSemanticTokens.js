/**
 * Semantic Tokens for CodeMirror via LSP
 *
 * Implements LSP semantic tokens highlighting by:
 * 1. Requesting tokens from the LSP server
 * 2. Decoding the token array into ranges
 * 3. Creating CodeMirror decorations for styling
 *
 * Based on LSP Semantic Tokens spec:
 * https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_semanticTokens
 */

import { StateField, StateEffect } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

/**
 * LSP Token Types (must match server's TOKEN_TYPES order)
 */
const TOKEN_TYPES = [
  "namespace", // 0
  "type", // 1
  "class", // 2
  "enum", // 3
  "interface", // 4
  "struct", // 5
  "typeParameter", // 6
  "parameter", // 7
  "variable", // 8
  "property", // 9
  "enumMember", // 10
  "event", // 11
  "function", // 12
  "method", // 13
  "macro", // 14
  "keyword", // 15
  "modifier", // 16
  "comment", // 17
  "string", // 18
  "number", // 19
  "regexp", // 20
  "operator", // 21
];

/**
 * Effect to set semantic tokens decorations
 */
const setTokensEffect = StateEffect.define();

/**
 * Decode LSP semantic tokens array into token objects
 *
 * LSP encodes tokens as a flat array of integers:
 * [deltaLine, deltaStartChar, length, tokenType, tokenModifiers, ...]
 *
 * Delta encoding means each token's position is relative to the previous token.
 *
 * @param {number[]} data - Flat array of token data
 * @returns {Array<{line: number, char: number, length: number, type: string}>}
 */
function decodeSemanticTokens(data) {
  const tokens = [];
  let line = 0;
  let char = 0;

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaChar = data[i + 1];
    const length = data[i + 2];
    const tokenType = data[i + 3];
    // const tokenModifiers = data[i + 4]; // Not used yet

    // Update absolute position
    line += deltaLine;
    char = deltaLine === 0 ? char + deltaChar : deltaChar;

    tokens.push({
      line,
      char,
      length,
      type: TOKEN_TYPES[tokenType] || "unknown",
    });
  }

  return tokens;
}

/**
 * Create CodeMirror decorations from decoded tokens
 *
 * @param {import('@codemirror/state').EditorState} state
 * @param {Array} tokens - Decoded token objects
 * @returns {import('@codemirror/view').DecorationSet}
 */
function createTokenDecorations(state, tokens) {
  const decorations = [];

  for (const token of tokens) {
    try {
      // Convert line/char to document position
      const line_obj = state.doc.line(token.line + 1); // Lines are 1-indexed
      const from = line_obj.from + token.char;
      const to = from + token.length;

      // Skip if position is out of bounds
      if (from < 0 || to > state.doc.length || from >= to) {
        continue;
      }

      // Create decoration with CSS class for this token type
      const decoration = Decoration.mark({
        class: `tok-${token.type}`,
      }).range(from, to);

      decorations.push(decoration);
    } catch (error) {
      console.warn("[SemanticTokens] Failed to create decoration:", error, token);
    }
  }

  return Decoration.set(decorations, true);
}

/**
 * StateField to manage semantic tokens decorations
 */
export const semanticTokensField = StateField.define({
  create() {
    return Decoration.none;
  },

  update(decorations, tr) {
    // Check for token update effect
    for (const effect of tr.effects) {
      if (effect.is(setTokensEffect)) {
        return effect.value;
      }
    }

    // Map decorations through document changes
    if (tr.docChanged) {
      try {
        return decorations.map(tr.changes);
      } catch {
        return Decoration.none;
      }
    }

    return decorations;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Request semantic tokens from LSP server
 *
 * @param {import('vue').Ref} lspClientRef - LSP client ref (from useLSPClient)
 * @param {string} documentUri - Document URI
 * @param {import('@codemirror/view').EditorView} view - CodeMirror view
 */
export async function requestSemanticTokens(lspClientRef, documentUri, view) {
  const client = lspClientRef?.value;

  if (!client || !view) {
    console.warn("[SemanticTokens] Missing client or view");
    return;
  }

  try {
    // Send LSP request for semantic tokens
    const params = {
      textDocument: { uri: documentUri },
    };

    const response = await client.request("textDocument/semanticTokens/full", params);

    if (!response || !response.data) {
      console.warn("[SemanticTokens] No token data received");
      return;
    }

    // Decode tokens
    const tokens = decodeSemanticTokens(response.data);

    // Create decorations
    const decorations = createTokenDecorations(view.state, tokens);

    // Dispatch effect to update decorations
    view.dispatch({
      effects: setTokensEffect.of(decorations),
    });
    return true;
  } catch (error) {
    console.error("[SemanticTokens] Request failed:", error);
    return false;
  }
}

/**
 * Create semantic tokens extension for CodeMirror
 *
 * @param {import('vue').Ref} lspClientRef - LSP client ref
 * @param {import('vue').Ref|string} documentUriRef - Document URI ref or string
 * @returns {import('@codemirror/state').Extension}
 */
export function semanticTokensExtension(lspClientRef, documentUriRef) {
  return [
    semanticTokensField,

    // Request tokens when editor is created and when document changes
    EditorView.updateListener.of((update) => {
      if (update.docChanged || update.viewportChanged) {
        // Debounce requests (300ms to match LSP diagnostics)
        if (update.view.__semanticTokensTimeout) {
          clearTimeout(update.view.__semanticTokensTimeout);
        }

        update.view.__semanticTokensTimeout = setTimeout(() => {
          // Get current document URI (handle both refs and plain strings)
          const documentUri =
            typeof documentUriRef === "object" && "value" in documentUriRef
              ? documentUriRef.value
              : documentUriRef;

          requestSemanticTokens(lspClientRef, documentUri, update.view);
        }, 100);
      }
    }),
  ];
}
