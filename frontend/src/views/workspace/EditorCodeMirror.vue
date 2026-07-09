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
  import { WebsocketProvider } from "y-websocket";
  import { AuthedWebSocket } from "@/composables/authedWebSocket";
  import { useLSPClient } from "@/composables/useLSPClient";
  import { semanticTokensExtension, requestSemanticTokens } from "@/composables/useSemanticTokens";
  import { rsmKeymap } from "@/composables/useRSMCommands";

  const file = defineModel({ type: Object, required: true });
  const api = inject("api");
  const user = inject("user");
  const compile = inject("compile", null);
  const mobileMode = inject("mobileMode");

  // Shared view and cursor refs from parent Editor.vue
  const parentCmView = inject("cmView", null);
  const parentCursorPos = inject("cursorPos", null);

  // DOM ref for CodeMirror container
  const editorContainer = ref(null);
  const activeCollabFileId = ref(null);
  // Y.js objects must use shallowRef — Vue's reactive Proxy breaks Y.js
  // internal identity checks (UndoManager scope, findRootTypeKey, etc.)
  const view = shallowRef(null);
  const ydoc = inject("ydoc", shallowRef(null));
  const parentYtext = inject("ytext", null);
  const ytext = shallowRef(null);
  const provider = shallowRef(null);
  const awareness = inject("awareness", shallowRef(null));
  const isConnected = ref(false);
  const isSynced = ref(false);
  const isInitialized = ref(false);
  const roomName = ref("");
  const readOnlyCompartment = new Compartment();

  // WebSocket server URL
  const serverUrl = ref(import.meta.env.VITE_MULTIPLAYER_URL || "ws://localhost:1234");

  // LSP client setup
  const backendUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const lspServerUrl = backendUrl.replace(/^http/, "ws") + "/ws/lsp";
  const lsp = useLSPClient({
    serverUrl: lspServerUrl,
    documentUri: computed(() => `file:///${file.value?.id || "untitled"}.rsm`),
  });

  // User info for awareness
  const userInfo = computed(() => {
    if (!user?.value?.name && !user?.value?.email) {
      throw new Error("User information is required for collaboration");
    }
    const color = user.value.avatar_color || "#0E9AE9";
    return {
      name: user.value.name || user.value.email,
      color,
      colorLight: color + "33",
      id: user.value.id,
      avatar_color: user.value.avatar_color,
    };
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

  // Auto-compilation on Y.Doc changes
  let ytextObserverCleanup = null;

  // Cleanup function
  const cleanup = () => {
    // Remove Y.Doc observer
    if (ytextObserverCleanup) {
      ytextObserverCleanup();
      ytextObserverCleanup = null;
    }

    // Disconnect LSP client
    if (lsp.isConnected.value) {
      lsp.disconnect();
    }

    if (parentCmView) parentCmView.value = null;

    if (view.value) {
      view.value.destroy();
      view.value = null;
    }

    if (provider.value) {
      try {
        AuthedWebSocket.clearToken(`${serverUrl.value}/${provider.value.roomname}`);
      } catch (_e) {
        /* ignore */
      }
      provider.value.destroy();
      provider.value = null;
    }

    if (ydoc.value) {
      ydoc.value.destroy();
      ydoc.value = null;
    }

    if (activeCollabFileId.value) {
      api.post(`/files/${activeCollabFileId.value}/collab/stop`).catch(() => {});
      activeCollabFileId.value = null;
    }

    ytext.value = null;
    if (parentYtext) parentYtext.value = null;
    awareness.value = null;
    isConnected.value = false;
    isSynced.value = false;
    isInitialized.value = false;

    // Clean up window globals for testing
    if (import.meta.env.DEV) {
      delete window.__cmView;
      delete window.__ydoc;
      delete window.__ytext;
      delete window.__provider;
      delete window.__awareness;
      delete window.__lspClient;
    }
  };

  // Setup Y.js and WebSocket when file changes
  watch(
    [() => file.value?.id, editorContainer],
    async ([fileId, container]) => {
      if (!fileId || !container) return;

      // Cleanup previous instance
      cleanup();

      // Use environment namespace to prevent conflicts between dev/test
      const env = (import.meta.env.VITE_ENV || "local").toLowerCase();
      roomName.value = `file-${fileId}-${env}`;
      // Create Y.Doc and Y.Text
      ydoc.value = new Y.Doc();
      ytext.value = ydoc.value.getText("text");
      if (parentYtext) parentYtext.value = ytext.value;

      // Tell the backend to start its Y.js client and get a short-lived WS auth
      // token. The multi-player server requires the token as the first frame on
      // the WebSocket — without one we'd be rejected with code 4401.
      activeCollabFileId.value = fileId;
      let token = null;
      try {
        const startResp = await api.post(`/files/${fileId}/collab/start`);
        token = startResp?.data?.token ?? null;
        if (!token) {
          console.error(`[Collab] /collab/start for file ${fileId} returned no token`);
        }
      } catch (err) {
        console.error(
          `[Collab] Failed to start backend client for file ${fileId}:`,
          err?.response?.status,
          err?.response?.data || err.message
        );
      }

      // Bail if the file or watcher changed while we awaited the token.
      if (file.value?.id !== fileId) return;

      const wsUrl = `${serverUrl.value}/${roomName.value}`;
      if (token) AuthedWebSocket.registerToken(wsUrl, token);

      // Create WebSocket provider with our authed wrapper as the polyfill so
      // y-websocket sees a normal socket while we handle the auth handshake.
      provider.value = new WebsocketProvider(serverUrl.value, roomName.value, ydoc.value, {
        WebSocketPolyfill: AuthedWebSocket,
      });
      awareness.value = provider.value.awareness;
      awareness.value.setLocalStateField("user", userInfo.value);

      // Log WebSocket errors only
      provider.value.ws?.addEventListener("error", (error) => {
        console.error("[Y.js WS] WebSocket ERROR:", error);
      });

      // Monitor connection
      provider.value.on("status", (event) => {
        isConnected.value = event.status === "connected";
      });

      // Log connection errors
      provider.value.on("connection-error", (event) => {
        console.error("[Y.js] Connection error:", event);
      });

      // Refresh the WS auth token before each reconnect; the token is short-lived
      // (5 min) and y-websocket would otherwise reconnect with a stale one and
      // be rejected with code 4401.
      provider.value.on("connection-close", async (closeEvent) => {
        if (file.value?.id !== fileId) return;
        try {
          const refresh = await api.post(`/files/${fileId}/collab/start`);
          const fresh = refresh?.data?.token;
          if (fresh) AuthedWebSocket.registerToken(wsUrl, fresh);
        } catch (err) {
          console.error(
            `[Collab] Failed to refresh token for file ${fileId}:`,
            err?.response?.status,
            err?.response?.data || err.message
          );
        }
      });

      // NB: the frontend must NEVER seed file.source into the shared Y.Text.
      // The backend is the single authoritative seeder: /collab/start awaits the
      // backend YDocClient's readiness (DB restore + broadcast) before this
      // provider is created, and its content arrives via normal sync — even if we
      // connect first, the backend's broadcast reaches us through the relay.
      // Typing plaintext in here mints fresh CRDT items that merge into duplicate
      // copies (the historical 1x->2x->4x content-duplication bug). Restores are
      // idempotent only because they go through the backend's encoded ydoc_state.

      // Setup auto-compilation on Y.Doc changes (local edits + remote agent edits)
      if (compile) {
        const handleYtextChange = () => {
          compile();
        };

        ytext.value.observe(handleYtextChange);

        ytextObserverCleanup = () => {
          ytext.value.unobserve(handleYtextChange);
        };
      }

      // Create editor immediately — don't wait for WebSocket sync
      const MAX_UNDO_STACK = 200;
      const undoManager = new Y.UndoManager(ytext.value, { captureTimeout: 500 });
      undoManager.on("stack-item-added", () => {
        if (undoManager.undoStack.length > MAX_UNDO_STACK) {
          undoManager.undoStack.splice(0, undoManager.undoStack.length - MAX_UNDO_STACK);
        }
      });
      const docContent = ytext.value.toString();

      const yCollabExtension = yCollab(ytext.value, awareness.value, { undoManager });

      const isReadOnly = file.value?.role === "COMMENTER" || mobileMode.value;
      const roExts = isReadOnly
        ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
        : [];
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

      view.value = new EditorView({
        state,
        parent: container,
      });

      if (parentCmView) parentCmView.value = view.value;

      // Expose for testing
      if (!import.meta.env.PROD) {
        window.__cmView = view.value;
        window.__ydoc = ydoc.value;
        window.__ytext = ytext.value;
        window.__provider = provider.value;
        window.EditorView = EditorView;
        window.__awareness = awareness.value;
      }

      // LSP and semantic tokens connect asynchronously after sync
      provider.value.once("synced", async () => {
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
          // Wait for the LSP's index to be ready before requesting semantic tokens,
          // instead of a fixed 2s retry guess. This is the same cold-index race
          // that affected source/preview navigation; awaitIndexReady resolves as
          // soon as the server emits rsm/indexReady (and falls through on timeout).
          await lsp.awaitIndexReady(uri);
          if (lsp.client.value && view.value) {
            await requestSemanticTokens(lsp.client, uri, view.value);
          }
        }

        isSynced.value = true;
      });
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    cleanup();
  });

  // Toggle read-only state when viewport crosses the mobile breakpoint
  watch(mobileMode, (mobile) => {
    if (!view.value) return;
    const ro = file.value?.role === "COMMENTER" || mobile;
    const exts = ro ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];
    view.value.dispatch({ effects: readOnlyCompartment.reconfigure(exts) });
  });

  // Shared refs from parent Editor.vue (for status bar sibling)
  const parentCollabConnected = inject("collabIsConnected", null);
  const parentCollabSynced = inject("collabIsSynced", null);
  const parentLspClient = inject("lspClient", null);
  const parentDocumentUri = inject("documentUri", null);
  // awaitIndexReady is a stable function from useLSPClient; publish it once for
  // Canvas's source<->preview navigation.
  const parentAwaitIndexReady = inject("awaitIndexReady", null);
  if (parentAwaitIndexReady) parentAwaitIndexReady.value = lsp.awaitIndexReady;

  watch(
    isConnected,
    (v) => {
      if (parentCollabConnected) parentCollabConnected.value = v;
    },
    { immediate: true }
  );
  watch(
    isSynced,
    (v) => {
      if (parentCollabSynced) parentCollabSynced.value = v;
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

<!-- Semantic token highlighting from tree-sitter-rsm (unscoped so tok-* classes reach CodeMirror DOM) -->
<style>
  @import "@/assets/css/syntax-highlights.css";
</style>
