<script setup>
  import { ref, shallowRef, computed, inject, watch, onBeforeUnmount } from "vue";
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
  import { EditorState } from "@codemirror/state";
  import {
    defaultHighlightStyle,
    syntaxHighlighting,
    indentOnInput,
    bracketMatching,
    foldGutter,
    foldKeymap,
  } from "@codemirror/language";
  import { defaultKeymap } from "@codemirror/commands";
  import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
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
  import { useLSPClient } from "@/composables/useLSPClient";
  import { semanticTokensExtension, requestSemanticTokens } from "@/composables/useSemanticTokens";
  import { rsmKeymap } from "@/composables/useRSMCommands";

  console.log("[EditorCodeMirror] Component loaded - TIMESTAMP:", Date.now());

  const file = defineModel({ type: Object, required: true });
  const api = inject("api");
  const user = inject("user");
  const editSession = inject("editSession", null);

  // Shared view and cursor refs from parent Editor.vue
  const parentCmView = inject("cmView", null);
  const parentCursorPos = inject("cursorPos", null);

  // DOM ref for CodeMirror container
  const editorContainer = ref(null);
  const activeCollabFileId = ref(null);
  // Y.js objects must use shallowRef — Vue's reactive Proxy breaks Y.js
  // internal identity checks (UndoManager scope, findRootTypeKey, etc.)
  const view = shallowRef(null);
  const ydoc = shallowRef(null);
  const ytext = shallowRef(null);
  const provider = shallowRef(null);
  const awareness = shallowRef(null);
  const isConnected = ref(false);
  const isSynced = ref(false);
  const isInitialized = ref(false);
  const roomName = ref("");

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
    return {
      name: user.value.name || user.value.email,
      color: `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`,
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
  let compileDebounceTimeout = null;
  let ytextObserverCleanup = null;

  // Cleanup function
  const cleanup = () => {
    console.log("[EditorCodeMirror] Cleaning up");

    // Clear auto-compile debounce timer
    if (compileDebounceTimeout) {
      clearTimeout(compileDebounceTimeout);
      compileDebounceTimeout = null;
    }

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
    }
  };

  // Setup Y.js and WebSocket when file changes
  watch(
    [() => file.value?.id, editorContainer],
    ([fileId, container]) => {
      if (!fileId || !container) return;

      // Cleanup previous instance
      cleanup();

      // Use environment namespace to prevent conflicts between dev/test
      const env = (import.meta.env.VITE_ENV || "local").toLowerCase();
      roomName.value = `file-${fileId}-${env}`;
      console.log(`[EditorCodeMirror] Setting up collaboration for ${roomName.value}`);

      // Create Y.Doc and Y.Text
      ydoc.value = new Y.Doc();
      ytext.value = ydoc.value.getText("text");

      // Create WebSocket provider
      provider.value = new WebsocketProvider(serverUrl.value, roomName.value, ydoc.value);
      awareness.value = provider.value.awareness;
      awareness.value.setLocalStateField("user", userInfo.value);

      // Tell the backend to start its Y.js client for this file
      activeCollabFileId.value = fileId;
      api.post(`/files/${fileId}/collab/start`).catch(() => {});

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

      // Wait for initial sync before creating editor
      // Backend Y.js client is the sole authority for seeding Y.text from DB.
      // Frontend never inserts — content arrives via Y.js sync protocol.
      provider.value.once("synced", async () => {
        // Initialize LSP client and get plugin
        console.log("[EditorCodeMirror] Connecting to LSP server...");
        let lspPlugin = null;
        try {
          lspPlugin = await lsp.connect(); // Returns plugin extension
          console.log("[EditorCodeMirror] ✅ LSP ready, creating editor with plugin");
        } catch (err) {
          console.warn("[EditorCodeMirror] ⚠️ LSP failed, creating editor without it:", err);
        }

        // Setup auto-compilation on Y.Doc changes
        if (editSession) {
          const handleYtextChange = (event, transaction) => {
            // Ignore remote changes (only trigger compilation for local edits)
            if (transaction.local) {
              if (import.meta.env.DEV) {
                console.log(
                  "[EditorCodeMirror] Local Y.Doc change detected, debouncing compilation"
                );
              }

              // Clear existing debounce timer
              if (compileDebounceTimeout) {
                clearTimeout(compileDebounceTimeout);
              }

              // Debounce compilation (2000ms to match editSession debounce)
              compileDebounceTimeout = setTimeout(async () => {
                if (import.meta.env.DEV) {
                  console.log("[EditorCodeMirror] Triggering auto-compilation");
                }
                await editSession.compile();
              }, 2000);
            }
          };

          ytext.value.observe(handleYtextChange);

          // Store cleanup function to remove observer later
          ytextObserverCleanup = () => {
            ytext.value.unobserve(handleYtextChange);
          };

          if (import.meta.env.DEV) {
            console.log("[EditorCodeMirror] Auto-compilation observer attached");
          }
        }

        // Create editor with yCollab binding
        const undoManager = new Y.UndoManager(ytext.value);
        const docContent = ytext.value.toString();

        console.log("[EditorCodeMirror] 🔧 Creating yCollab binding", {
          ytextLength: ytext.value.toString().length,
          docContentLength: docContent.length,
        });

        const yCollabExtension = yCollab(ytext.value, awareness.value, { undoManager });
        console.log("[EditorCodeMirror] ✅ yCollab extension created");

        // Debug: Log all transactions to track CodeMirror changes
        const transactionLogger = EditorState.transactionExtender.of((tr) => {
          if (tr.docChanged) {
            console.log("[EditorCodeMirror] 📝 Transaction detected", {
              docChanged: tr.docChanged,
              newLength: tr.newDoc.length,
              origin: tr.annotation ? String(tr.annotation) : "no-annotation",
            });
          }
          return null;
        });

        // Determine if editor should be read-only based on user role
        const isReadOnly = file.value?.role === "COMMENTER";
        const editableExtensions = isReadOnly
          ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
          : [];

        // Add LSP plugin extension if it was created successfully
        // Note: client.plugin() returns a single Extension, not an array
        const lspExtension = lspPlugin;
        if (lspPlugin) {
          console.log("[EditorCodeMirror] ✅ Adding LSP plugin to editor", lspPlugin);
        }

        // Add semantic tokens extension for syntax highlighting
        const semanticTokens = semanticTokensExtension(
          lsp.client,
          computed(() => `file:///${file.value?.id || "untitled"}.rsm`)
        );
        console.log("[EditorCodeMirror] ✅ Adding semantic tokens extension");

        const state = EditorState.create({
          // CRITICAL: Initialize with Y.text content explicitly
          // yCollab only handles incremental changes, not initial state
          doc: docContent,
          extensions: [
            customSetup,
            yCollabExtension,
            keymap.of(yUndoManagerKeymap),
            transactionLogger,
            ...editableExtensions,
            ...(lspExtension ? [lspExtension] : []),
            semanticTokens,
            lintExtensions,
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

        // Share view with sibling components (toolbar, status bar)
        if (parentCmView) parentCmView.value = view.value;

        // Wait for editor to fully mount before marking as synced
        setTimeout(async () => {
          // Expose view and Y.js instances globally for testing (dev, CI, test - not prod)
          if (!import.meta.env.PROD) {
            window.__cmView = view.value;
            window.__ydoc = ydoc.value;
            window.__ytext = ytext.value;
            window.__provider = provider.value;
            window.EditorView = EditorView;
            window.__awareness = awareness.value;
          }

          // Request initial semantic tokens for syntax highlighting
          // Retry once if it fails — the LSP server may still be warming up
          // (especially when the editor panel restores immediately from localStorage)
          if (lsp.client.value && view.value) {
            const uri = `file:///${file.value?.id || "untitled"}.rsm`;
            const ok = await requestSemanticTokens(lsp.client, uri, view.value);
            if (!ok) {
              setTimeout(() => {
                if (lsp.client.value && view.value) {
                  requestSemanticTokens(lsp.client, uri, view.value);
                }
              }, 2000);
            }
          }

          isSynced.value = true;
          if (import.meta.env.DEV) {
            console.log("[EditorCodeMirror] Component synced and ready");
          }
        }, 100);
      });
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    cleanup();
  });

  // Shared refs from parent Editor.vue (for status bar sibling)
  const parentCollabConnected = inject("collabIsConnected", null);
  const parentCollabSynced = inject("collabIsSynced", null);
  const parentLspClient = inject("lspClient", null);
  const parentDocumentUri = inject("documentUri", null);

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

  /* Semantic token highlighting - using braiid color system */
  .cm-container :deep(.tok-keyword) {
    color: var(--primary-700, #0361a1);
    font-weight: var(--weight-semi, 600);
  }

  .cm-container :deep(.tok-function) {
    color: var(--purple-700, #7629c7);
  }

  .cm-container :deep(.tok-operator) {
    color: var(--primary-600, #027ac7);
  }

  .cm-container :deep(.tok-namespace) {
    /* Headings */
    color: var(--primary-800, #075487);
    font-weight: var(--weight-bold, 700);
  }

  .cm-container :deep(.tok-macro) {
    /* Math blocks */
    color: var(--purple-600, #8b3be2);
  }

  .cm-container :deep(.tok-string) {
    color: var(--orange-700, #be4a10);
  }

  .cm-container :deep(.tok-comment) {
    color: var(--gray-600, #8b9fad);
    font-style: italic;
  }

  .cm-container :deep(.tok-property) {
    color: var(--orange-800, #973a15);
  }

  .cm-container :deep(.tok-type) {
    color: var(--primary-600, #027ac7);
  }

  .cm-container :deep(.tok-modifier) {
    color: var(--purple-600, #8b3be2);
  }

  .cm-container :deep(.tok-enumMember) {
    /* Constants */
    color: var(--primary-700, #0361a1);
  }

  .cm-container :deep(.tok-number) {
    color: var(--primary-600, #027ac7);
  }

  .cm-container :deep(.tok-variable) {
    color: var(--text-body, #3c4952);
  }

  .cm-container :deep(.tok-parameter) {
    color: var(--text-body, #3c4952);
  }
</style>
