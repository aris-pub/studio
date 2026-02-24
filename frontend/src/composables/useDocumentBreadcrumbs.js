import { ref, watch, toRaw } from "vue";

/**
 * Walk a hierarchical DocumentSymbol tree depth-first and return
 * the breadcrumb path (array of { name, kind }) for a given cursor offset.
 *
 * A symbol "contains" the cursor if start <= cursor <= end (using character offsets).
 */
export function findBreadcrumbPath(symbols, cursorOffset, docText) {
  if (!symbols || !symbols.length) return [];

  function offsetOf(pos) {
    let offset = 0;
    const lines = docText.split("\n");
    for (let i = 0; i < pos.line && i < lines.length; i++) {
      offset += lines[i].length + 1;
    }
    offset += Math.min(pos.character, (lines[pos.line] || "").length);
    return offset;
  }

  function walk(nodes, path) {
    for (const sym of nodes) {
      const range = sym.range || sym.location?.range;
      if (!range) continue;

      const start = offsetOf(range.start);
      const end = offsetOf(range.end);

      if (cursorOffset >= start && cursorOffset <= end) {
        const selRange = sym.selectionRange || range;
        const entry = { name: sym.name, kind: sym.kind, offset: offsetOf(selRange.start) };
        const childPath = sym.children?.length ? walk(sym.children, [...path, entry]) : null;
        return childPath || [...path, entry];
      }
    }
    return path.length ? path : [];
  }

  return walk(symbols, []);
}

/**
 * Reactive composable that requests document symbols from the LSP
 * and computes breadcrumbs based on cursor position.
 */
export function useDocumentBreadcrumbs({ lspClient, documentUri, cursorPos, cmView }) {
  const breadcrumbs = ref([]);
  const symbols = ref([]);

  let refreshDebounce = null;

  async function refreshSymbols() {
    const client = lspClient?.value;
    if (!client) return;

    try {
      const raw = toRaw(client);
      if (typeof raw.sync === "function") raw.sync();
      const result = await raw.request("textDocument/documentSymbol", {
        textDocument: { uri: documentUri.value },
      });
      symbols.value = result || [];
    } catch {
      // LSP may not support documentSymbol yet
    }
  }

  // Refresh symbols when document URI changes (file switch)
  watch(
    () => documentUri?.value,
    () => {
      refreshSymbols();
    },
    { immediate: true }
  );

  // Debounced symbol refresh on cursor movement (structure may have changed)
  watch(cursorPos, () => {
    clearTimeout(refreshDebounce);
    refreshDebounce = setTimeout(() => refreshSymbols(), 2000);
  });

  // Recompute breadcrumbs when cursor or symbols change
  watch(
    [cursorPos, symbols],
    ([pos, syms]) => {
      if (!syms?.length) {
        breadcrumbs.value = [];
        return;
      }
      const view = cmView?.value;
      const docText = view ? toRaw(view).state.doc.toString() : "";
      breadcrumbs.value = findBreadcrumbPath(syms, pos, docText);
    },
    { immediate: true }
  );

  return { breadcrumbs, symbols, refreshSymbols };
}
