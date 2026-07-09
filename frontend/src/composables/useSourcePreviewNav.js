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

import { toast } from "@/utils/toast.js";

const HIGHLIGHT_DURATION = 2000;
const RETRY_MAX_ATTEMPTS = 14; // ~2s total with RETRY_DELAY_MS
const RETRY_DELAY_MS = 150;

/**
 * Call `requestFn` and, if it resolves falsy, retry with a fixed delay up to
 * `maxAttempts` times, returning the first truthy result (or null if exhausted).
 *
 * rsm/nodePosition and rsm/nodeAtPosition both resolve against the LSP server's
 * nodeid<->source index, which is (re)built asynchronously on document open and
 * after each recompile. During that window the request returns null even though
 * the client is connected — first call null, a later call resolves. With no
 * per-document "index ready" signal from the server, this bounded retry keeps
 * source<->preview navigation from silently no-op'ing on a cold or racy server.
 * This is the fallback layer; the deterministic fix is an rsm/indexReady
 * notification the client can await (tracked in std-* follow-up). A resolving
 * request returns on the first attempt (no delay); only unresolved ones retry.
 *
 * Exported (not a closure) so the retry contract is unit-testable with fake timers.
 */
export async function lspRequestWithRetry(
  requestFn,
  { maxAttempts = RETRY_MAX_ATTEMPTS, delayMs = RETRY_DELAY_MS } = {}
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const result = await requestFn();
    if (result) return result;
  }
  return null;
}

/**
 * @param {Object} options
 * @param {import('vue').Ref} options.lspClient - LSP client ref
 * @param {import('vue').Ref} options.documentUri - Document URI ref
 * @param {import('vue').Ref} options.cmView - CodeMirror EditorView ref
 * @param {import('vue').Ref} options.manuscriptRef - ManuscriptWrapper template ref
 */
export function useSourcePreviewNav({ lspClient, documentUri, cmView, manuscriptRef }) {
  // Monotonic token so that when several nav requests are in flight during a cold
  // index window, only the most recent one applies its scroll/highlight (the last
  // to *resolve* is otherwise not the last one *clicked*).
  let navToken = 0;

  async function lspRequest(method, params) {
    const client = toRaw(lspClient?.value);
    if (!client) return null;
    try {
      return await client.request(method, params);
    } catch {
      return null;
    }
  }

  // Wrap lspRequest with the bounded retry, but fast-path out when there is no LSP
  // client at all: retrying can't summon one, so an LSP-less environment must not
  // pay the full ~2s budget on every interaction.
  async function requestWithRetry(method, params) {
    if (!toRaw(lspClient?.value)) return null;
    return lspRequestWithRetry(() => lspRequest(method, params));
  }

  /**
   * Click-to-source: given a nodeid from the preview, scroll the editor
   * to the corresponding source line.
   */
  async function navigateToSource(nodeid) {
    const uri = documentUri?.value;
    if (!uri) return;

    const token = ++navToken;
    const pos = await requestWithRetry("rsm/nodePosition", {
      textDocument: { uri },
      nodeid,
    });
    // A newer click superseded this one while we were retrying — drop it so the
    // last-clicked element wins the scroll.
    if (token !== navToken) return;
    if (!pos) {
      // The element had a nodeid but the LSP never resolved it within the retry
      // budget. Break the silence (silent no-op was the original bug) — but only
      // when an LSP client exists; with no LSP, staying quiet is correct.
      if (toRaw(lspClient?.value)) {
        toast.info("Couldn't jump to the source for this element.");
      }
      return;
    }

    const view = toRaw(cmView?.value);
    if (!view) return;

    const { EditorView } = await import("@codemirror/view");
    const startLine = view.state.doc.line(pos.startLine + 1);
    const endLine = view.state.doc.line(Math.min(pos.endLine + 1, view.state.doc.lines));

    // Place cursor at content start (after tag + meta region)
    const contentLine = view.state.doc.line(pos.contentStartLine + 1);
    const cursorPos = contentLine.from + pos.contentStartCol;

    view.dispatch({
      selection: { anchor: cursorPos },
      effects: EditorView.scrollIntoView(startLine.from, { y: "start", yMargin: 20 }),
    });
    view.focus();

    // Highlight the entire source range: gutter + background
    const targetLineNums = new Set();
    for (let i = startLine.number; i <= endLine.number; i++) {
      targetLineNums.add(String(i));
      const lineEl = view.domAtPos(view.state.doc.line(i).from)?.node?.parentElement;
      if (lineEl) {
        lineEl.classList.add("cm-synctarget-line");
        setTimeout(() => lineEl.classList.remove("cm-synctarget-line"), HIGHLIGHT_DURATION);
      }
    }
    const gutterEls = view.dom.querySelectorAll(".cm-lineNumbers .cm-gutterElement");
    gutterEls.forEach((el) => {
      if (targetLineNums.has(el.textContent.trim())) {
        el.classList.add("cm-synctarget-gutter");
        setTimeout(() => el.classList.remove("cm-synctarget-gutter"), HIGHLIGHT_DURATION);
      }
    });
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

    const result = await requestWithRetry("rsm/nodeAtPosition", {
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
