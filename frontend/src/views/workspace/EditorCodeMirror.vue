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
  import { EditorState, Compartment } from "@codemirror/state";
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
  const ydoc = shallowRef(null);
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
  let compileDebounceTimeout = null;
  let ytextObserverCleanup = null;

  // Cleanup function
  const cleanup = () => {
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
      delete window.__lspClient;
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
      provider.value.once("synced", async () => {
        // Backend Y.js client is the primary authority for seeding from DB.
        // Give it a brief window to deliver content before falling back to
        // frontend seeding (prevents dual-insertion duplication).
        if (ytext.value.toString().length === 0 && file.value?.source) {
          const seedTimeout = 10000;
          await new Promise((resolve) => {
            const observer = () => {
              if (ytext.value.toString().length > 0) {
                ytext.value.unobserve(observer);
                resolve();
              }
            };
            ytext.value.observe(observer);
            setTimeout(() => {
              ytext.value.unobserve(observer);
              resolve();
            }, seedTimeout);
          });

          // Fallback: seed from frontend if backend didn't deliver in time
          if (ytext.value.toString().length === 0) {
            ydoc.value.transact(() => {
              ytext.value.insert(0, file.value.source);
            });
          }
        }

        // Initialize LSP client and get plugin
        let lspPlugin = null;
        try {
          lspPlugin = await lsp.connect();
        } catch {
          // LSP is optional — editor works without it
        }

        // Setup auto-compilation on Y.Doc changes
        if (compile) {
          const handleYtextChange = (event, transaction) => {
            if (transaction.local) {
              if (compileDebounceTimeout) {
                clearTimeout(compileDebounceTimeout);
              }

              compileDebounceTimeout = setTimeout(async () => {
                await compile();
              }, 2000);
            }
          };

          ytext.value.observe(handleYtextChange);

          ytextObserverCleanup = () => {
            ytext.value.unobserve(handleYtextChange);
          };
        }

        // Create editor with yCollab binding
        const undoManager = new Y.UndoManager(ytext.value);
        const docContent = ytext.value.toString();

        const yCollabExtension = yCollab(ytext.value, awareness.value, { undoManager });

        const isReadOnly = file.value?.role === "COMMENTER" || mobileMode.value;
        const roExts = isReadOnly
          ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
          : [];
        const readOnlyExtension = readOnlyCompartment.of(roExts);

        // Add LSP plugin extension if it was created successfully
        // Note: client.plugin() returns a single Extension, not an array
        const lspExtension = lspPlugin;

        // Add semantic tokens extension for syntax highlighting
        const semanticTokens = semanticTokensExtension(
          lsp.client,
          computed(() => `file:///${file.value?.id || "untitled"}.rsm`)
        );

        const state = EditorState.create({
          // CRITICAL: Initialize with Y.text content explicitly
          // yCollab only handles incremental changes, not initial state
          doc: docContent,
          extensions: [
            customSetup,
            cmSearchExtension(),
            yCollabExtension,
            keymap.of(yUndoManagerKeymap),
            readOnlyExtension,
            ...(lspExtension ? [lspExtension] : []),
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
            window.__lspClient = toRaw(lsp.client.value);
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
        }, 100);
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
