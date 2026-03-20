/**
 * Bidirectional navigation between source editor and rendered preview.
 *
 * Click-to-source: click an element in the preview → editor scrolls to source.
 * Cursor-to-preview: trigger from editor → preview scrolls to rendered element.
 *
 * Uses LSP custom requests (rsm/nodePosition, rsm/nodeAtPosition) to map
 * between data-nodeid in the HTML and source positions in the editor.
 */

import { toRaw } from "vue";

const HIGHLIGHT_DURATION = 1500;

/**
 * @param {Object} options
 * @param {import('vue').Ref} options.lspClient - LSP client ref
 * @param {import('vue').Ref} options.documentUri - Document URI ref
 * @param {import('vue').Ref} options.cmView - CodeMirror EditorView ref
 * @param {import('vue').Ref} options.manuscriptRef - ManuscriptWrapper template ref
 */
export function useSourcePreviewNav({ lspClient, documentUri, cmView, manuscriptRef }) {

  async function lspRequest(method, params) {
    const client = toRaw(lspClient?.value);
    if (!client) return null;
    try {
      return await client.request(method, params);
    } catch {
      return null;
    }
  }

  /**
   * Click-to-source: given a nodeid from the preview, scroll the editor
   * to the corresponding source line.
   */
  async function navigateToSource(nodeid) {
    const uri = documentUri?.value;
    if (!uri) return;

    const pos = await lspRequest("rsm/nodePosition", {
      textDocument: { uri },
      nodeid,
    });
    if (!pos) return;

    const view = toRaw(cmView?.value);
    if (!view) return;

    const { EditorView } = await import("@codemirror/view");
    const line = view.state.doc.line(pos.startLine + 1);
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });

    // Transient highlight on target line
    const lineEl = view.domAtPos(line.from)?.node?.parentElement;
    if (lineEl) {
      lineEl.classList.add("cm-synctarget-line");
      setTimeout(() => lineEl.classList.remove("cm-synctarget-line"), HIGHLIGHT_DURATION);
    }
  }

  /**
   * Cursor-to-preview: given the current editor cursor position, scroll
   * the preview to the corresponding rendered element.
   */
  async function navigateToPreview() {
    const uri = documentUri?.value;
    if (!uri) return;

    const view = toRaw(cmView?.value);
    if (!view) return;

    const cursor = view.state.selection.main.head;
    const line = view.state.doc.lineAt(cursor);

    const result = await lspRequest("rsm/nodeAtPosition", {
      textDocument: { uri },
      line: line.number - 1,
      character: cursor - line.from,
    });
    if (!result) return;

    const mountPoint = manuscriptRef?.value?.mountPoint;
    if (!mountPoint) return;

    const el = mountPoint.querySelector(`[data-nodeid="${result.nodeid}"]`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    el.classList.add("aris-synctarget-highlight");
    setTimeout(() => el.classList.remove("aris-synctarget-highlight"), HIGHLIGHT_DURATION);
  }

  /**
   * Handle Cmd/Ctrl+click on preview — navigate to source.
   */
  function handlePreviewClick(event) {
    if (!(event.metaKey || event.ctrlKey)) return;

    const target = event.target.closest("[data-nodeid]");
    if (!target) return;

    const nodeid = parseInt(target.getAttribute("data-nodeid"), 10);
    if (isNaN(nodeid)) return;

    event.preventDefault();
    event.stopPropagation();

    // Blur the handrail so its focus background doesn't persist
    target.blur();

    navigateToSource(nodeid);
  }

  return {
    navigateToSource,
    navigateToPreview,
    handlePreviewClick,
  };
}
