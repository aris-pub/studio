<script setup>
  import { ref, shallowRef, computed, inject, watch, onBeforeUnmount, toRaw } from "vue";
  import {
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLineGutter,
    highlightSpecialChars,
    drawSelection,
    dropCursor,
    rectangularSelection,
    crosshairCursor,
    highlightActiveLine,
  } from "@codemirror/view";
  import { EditorState, Compartment, StateEffect } from "@codemirror/state";
  import {
    defaultHighlightStyle,
    syntaxHighlighting,
    indentOnInput,
    bracketMatching,
    foldGutter,
    foldKeymap,
  } from "@codemirror/language";
  import { defaultKeymap } from "@codemirror/commands";
  import { search as cmSearchExtension, highlightSelectionMatches } from "@codemirror/search";
  import {
    autocompletion,
    completionKeymap,
    closeBrackets,
    closeBracketsKeymap,
  } from "@codemirror/autocomplete";
  import { lintKeymap, lintGutter } from "@codemirror/lint";
  import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
  import * as Y from "yjs";
  import { useLSPClient } from "@/composables/useLSPClient";
  import { semanticTokensExtension, requestSemanticTokens } from "@/composables/useSemanticTokens";
  import { rsmKeymap } from "@/composables/useRSMCommands";
  import { useFileEvents } from "@/composables/useFileEvents.js";
  import { useSaveStatus } from "@/composables/useSaveStatus.js";

  const file = defineModel({ type: Object, required: true });
  const api = inject("api");
  const compile = inject("compile", null);
  const mobileMode = inject("mobileMode");

  // Shared view and cursor refs from parent Editor.vue
  const parentCmView = inject("cmView", null);
  const parentCursorPos = inject("cursorPos", null);

  // DOM ref for CodeMirror container
  const editorContainer = ref(null);
  // Subscription to this file's server-sent event stream (asset changes, etc.).
  let fileEvents = null;
  // Y.js objects must use shallowRef — Vue's reactive Proxy breaks Y.js internal
  // identity checks (UndoManager scope, findRootTypeKey, etc.)
  const view = shallowRef(null);

  // The collaboration session is owned by the view (useCollabSession) and shared
  // through these injected refs. This component is a pure consumer (std-hvgpnr): it
  // binds the CodeMirror editor to the shared ytext/awareness when its panel
  // mounts, and reads connection/sync state. It never creates the provider or
  // calls /collab/start.
  const ydoc = inject("ydoc", shallowRef(null));
  const ytext = inject("ytext", shallowRef(null));
  const awareness = inject("awareness", shallowRef(null));
  const isConnected = inject("collabIsConnected", ref(false));
  const isSynced = inject("collabIsSynced", ref(false));
  const readOnlyCompartment = new Compartment();

  // True save state (std-wmjv): tracks whether the user's edits have actually been
  // persisted to the DB, from local edits + backend "persisted" acks + the relay
  // link, not just whether the relay is connected.
  const saveStatus = useSaveStatus({ isConnected });

  // LSP client setup
  const backendUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const lspServerUrl = backendUrl.replace(/^http/, "ws") + "/ws/lsp";
  const lsp = useLSPClient({
    serverUrl: lspServerUrl,
    documentUri: computed(() => `file:///${file.value?.id || "untitled"}.rsm`),
    // Mint a short-lived scope=lsp token at connect time (fresh on each reconnect).
    token: async () => {
      const resp = await api.post("/lsp/start");
      return resp.data?.token || null;
    },
  });

  // Cursor position listener for status bar breadcrumbs
  const cursorListener = EditorView.updateListener.of((update) => {
    if (update.selectionSet && parentCursorPos) {
      parentCursorPos.value = update.state.selection.main.head;
    }
  });

  const customSetup = [
    lineNumbers(),
    highlightSpecialChars(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    rsmKeymap,
    keymap.of([...defaultKeymap]),
    cursorListener,
  ];

  // Lint extensions (added separately to ensure they come after LSP plugin)
  const lintExtensions = [lintGutter(), keymap.of(lintKeymap)];

  // Y.Text observer cleanup (auto-compile + save indicator)
  let ytextObserverCleanup = null;
  // Guards the once-per-session LSP/semantic-tokens wiring so a reconnect that
  // re-fires isSynced does not re-run it.
  let syncedHandledFor = null;

  function teardownView() {
    if (ytextObserverCleanup) {
      ytextObserverCleanup();
      ytextObserverCleanup = null;
    }
    if (lsp.isConnected.value) {
      lsp.disconnect();
    }
    if (view.value) {
      view.value.destroy();
      view.value = null;
    }
    if (parentCmView) parentCmView.value = null;
    if (!import.meta.env.PROD) {
      delete window.__cmView;
      delete window.EditorView;
      delete window.__lspClient;
    }
    saveStatus.reset();
    syncedHandledFor = null;
  }

  function buildView(yt, aw, container) {
    const MAX_UNDO_STACK = 200;
    const undoManager = new Y.UndoManager(yt, { captureTimeout: 500 });
    undoManager.on("stack-item-added", () => {
      if (undoManager.undoStack.length > MAX_UNDO_STACK) {
        undoManager.undoStack.splice(0, undoManager.undoStack.length - MAX_UNDO_STACK);
      }
    });
    const docContent = yt.toString();

    const yCollabExtension = yCollab(yt, aw, { undoManager });

    const isReadOnly = file.value?.role === "COMMENTER" || mobileMode.value;
    const roExts = isReadOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];
    const readOnlyExtension = readOnlyCompartment.of(roExts);

    // Semantic tokens extension (works without LSP — falls back gracefully)
    const semanticTokens = semanticTokensExtension(
      lsp.client,
      computed(() => `file:///${file.value?.id || "untitled"}.rsm`)
    );

    const state = EditorState.create({
      doc: docContent,
      extensions: [
        customSetup,
        cmSearchExtension(),
        yCollabExtension,
        keymap.of(yUndoManagerKeymap),
        readOnlyExtension,
        semanticTokens,
        lintExtensions,
        EditorView.lineWrapping,
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-scroller": {
            fontFamily: '"Source Code Pro", monospace',
            overflow: "auto",
          },
          ".cm-content": {
            padding: "16px",
            minHeight: "100%",
          },
        }),
      ],
    });

    view.value = new EditorView({ state, parent: container });
    if (parentCmView) parentCmView.value = view.value;

    // Observe Y.Text for the save indicator and auto-compile. Only the user's OWN
    // edits (transaction.local) move the indicator to "saving"; remote edits arrive
    // already persisted by whoever made them, so they must not.
    const handleYtextChange = (_event, transaction) => {
      if (transaction?.local) saveStatus.noteLocalEdit();
      if (compile) compile();
    };
    yt.observe(handleYtextChange);
    ytextObserverCleanup = () => yt.unobserve(handleYtextChange);

    // Expose for testing
    if (!import.meta.env.PROD) {
      window.__cmView = view.value;
      window.EditorView = EditorView;
    }

    // If the session already synced before the view existed, wire LSP now.
    if (isSynced.value) wireLspAfterSync();
  }

  // LSP and semantic tokens connect asynchronously after sync, and need the view.
  async function wireLspAfterSync() {
    if (!view.value) return;
    const fileId = file.value?.id;
    if (syncedHandledFor === fileId) return;
    syncedHandledFor = fileId;

    let lspPlugin = null;
    try {
      lspPlugin = await lsp.connect();
      if (lspPlugin && view.value) {
        view.value.dispatch({
          effects: StateEffect.appendConfig.of(lspPlugin),
        });
      }
    } catch {
      // LSP is optional
    }

    if (!import.meta.env.PROD) {
      window.__lspClient = toRaw(lsp.client.value);
    }

    if (lsp.client.value && view.value) {
      const uri = `file:///${file.value?.id || "untitled"}.rsm`;
      // Wait for the LSP's index before requesting semantic tokens (same cold-index
      // race that affected source/preview navigation; resolves on rsm/indexReady).
      await lsp.awaitIndexReady(uri);
      if (lsp.client.value && view.value) {
        await requestSemanticTokens(lsp.client, uri, view.value);
      }
    }
  }

  // Tear the view down synchronously the moment the shared ytext changes or goes
  // away, so the yCollab binding releases the old Y.Text before useCollabSession
  // destroys the doc. flush:"sync" is required for that ordering: the composable
  // nulls ytext then destroys the doc within the same tick.
  watch(
    ytext,
    (yt, prev) => {
      if (prev && view.value) teardownView();
    },
    { flush: "sync" }
  );

  // Build the editor once the session's text, awareness, and the container are all
  // present. A panel-closed session never mounts a container, so no view is built,
  // but the session still runs at the view level.
  watch(
    [ytext, awareness, editorContainer],
    ([yt, aw, container]) => {
      if (yt && aw && container && !view.value) buildView(yt, aw, container);
    },
    { immediate: true }
  );

  // Per-file server-sent events: recompile when an asset changes out of band (an
  // agent, another tab, another user) so the rendered image refreshes without a
  // manual save (std-iu0n), and settle the save indicator on a real backend
  // persistence ack (std-wmjv).
  watch(
    () => file.value?.id,
    (fileId) => {
      if (fileEvents) {
        fileEvents.close();
        fileEvents = null;
      }
      if (!fileId) return;
      fileEvents = useFileEvents(fileId, {
        "asset-changed": () => compile && compile(true),
        persisted: () => saveStatus.notePersisted(),
      });
    },
    { immediate: true }
  );

  // Wire LSP + semantic tokens once the session reports synced.
  watch(isSynced, (synced) => {
    if (synced) wireLspAfterSync();
  });

  onBeforeUnmount(() => {
    teardownView();
    if (fileEvents) {
      fileEvents.close();
      fileEvents = null;
    }
  });

  // Toggle read-only state when the viewport crosses the mobile breakpoint
  watch(mobileMode, (mobile) => {
    if (!view.value) return;
    const ro = file.value?.role === "COMMENTER" || mobile;
    const exts = ro ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];
    view.value.dispatch({ effects: readOnlyCompartment.reconfigure(exts) });
  });

  // Write-backs to the shared refs the status bar and Canvas read. Collab
  // connection/sync/retry state is owned by the view (useCollabSession) and read
  // by the status bar directly, so it is not re-published here.
  const parentSaveState = inject("saveState", null);
  const parentLspClient = inject("lspClient", null);
  const parentDocumentUri = inject("documentUri", null);
  const parentAwaitIndexReady = inject("awaitIndexReady", null);
  if (parentAwaitIndexReady) parentAwaitIndexReady.value = lsp.awaitIndexReady;

  watch(
    saveStatus.saveState,
    (v) => {
      if (parentSaveState) parentSaveState.value = v;
    },
    { immediate: true }
  );
  watch(
    lsp.client,
    (v) => {
      if (parentLspClient) parentLspClient.value = v;
    },
    { immediate: true }
  );
  watch(
    () => file.value?.id,
    (id) => {
      if (parentDocumentUri) parentDocumentUri.value = `file:///${id || "untitled"}.rsm`;
    },
    { immediate: true }
  );
</script>

<template>
  <div class="editor-codemirror">
    <div ref="editorContainer" class="cm-container"></div>
  </div>
</template>

<style scoped>
  .editor-codemirror {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .cm-container {
    flex: 1;
    overflow: hidden;
  }

  .cm-container :deep(.cm-editor) {
    height: 100%;
  }

  .cm-container :deep(.cm-editor) {
    outline: none !important;
  }

  .cm-container :deep(.cm-editor.cm-focused) {
    outline: none !important;
  }

  .cm-container :deep(.cm-scroller) {
    outline: none !important;
  }

  .cm-container :deep(.cm-gutters) {
    background-color: var(--surface-hover);
    border-right: none;
    font-size: 11px;
  }

  .cm-container :deep(.cm-cursor) {
    border-left-color: var(--extra-dark);
  }
</style>
<style>
  @import "@/assets/css/syntax-highlights.css";
</style>
