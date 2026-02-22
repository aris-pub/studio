<script setup>
  import { ref, computed, inject, watch, onBeforeUnmount, toRaw } from "vue";
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
  import { yCollab } from "y-codemirror.next";
  import * as Y from "yjs";
  import { WebsocketProvider } from "y-websocket";
  import { useLSPClient } from "@/composables/useLSPClient";
  import { semanticTokensExtension, requestSemanticTokens } from "@/composables/useSemanticTokens";

  console.log("[EditorCodeMirror] Component loaded - TIMESTAMP:", Date.now());

  const file = defineModel({ type: Object, required: true });
  const api = inject("api");
  const user = inject("user");
  const editSession = inject("editSession", null);

  // DOM ref for CodeMirror container
  const editorContainer = ref(null);
  const activeCollabFileId = ref(null);
  const view = ref(null);
  const ydoc = ref(null);
  const ytext = ref(null);
  const provider = ref(null);
  const awareness = ref(null);
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

  // Minimal extension bundle to debug Y.js update conflict
  // Start with absolute minimum, add features back once collaboration works
  const customSetup = [
    lineNumbers(),
    highlightSpecialChars(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    keymap.of([...defaultKeymap]),
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
      provider.value.once("synced", async () => {
        const ytextLength = ytext.value.toString().length;

        // Initialize ONLY if completely empty
        if (ytextLength === 0 && file.value?.source) {
          if (import.meta.env.DEV) {
            console.log(
              `[EditorCodeMirror] Initializing Y.text with ${file.value.source.length} chars from database`
            );
          }
          ydoc.value.transact(() => {
            ytext.value.insert(0, file.value.source);
          });
        }

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

        // Wait for editor to fully mount before marking as synced
        setTimeout(() => {
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
          if (lsp.client.value && view.value) {
            const uri = `file:///${file.value?.id || "untitled"}.rsm`;
            requestSemanticTokens(lsp.client, uri, view.value);
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

  // Connection status indicator
  const statusText = computed(() => {
    if (!isConnected.value) return "Disconnected";
    if (!isSynced.value) return "Syncing...";
    return "Connected";
  });

  const statusClass = computed(() => {
    if (!isConnected.value) return "disconnected";
    if (!isSynced.value) return "syncing";
    return "connected";
  });

  // LSP status
  const lspStatusText = computed(() => {
    if (lsp.error.value) return "LSP: Error";
    if (lsp.isConnected.value) return "LSP: Active";
    return "LSP: Connecting...";
  });

  const lspStatusClass = computed(() => {
    if (lsp.error.value) return "disconnected";
    if (lsp.isConnected.value) return "connected";
    return "syncing";
  });
</script>

<template>
  <div class="editor-codemirror">
    <div class="status-bar">
      <span class="status-indicator" :class="statusClass">
        <span class="status-dot"></span>
        {{ statusText }}
      </span>
      <span class="status-indicator" :class="lspStatusClass">
        <span class="status-dot"></span>
        {{ lspStatusText }}
      </span>
      <span class="room-info">Room: {{ roomName }}</span>
    </div>
    <div ref="editorContainer" class="cm-container"></div>
  </div>
</template>

<style scoped>
  .editor-codemirror {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 12px;
    font-size: 12px;
    background: var(--surface-secondary, #f5f5f5);
    border-bottom: 1px solid var(--border-primary, #e0e0e0);
    color: var(--text-secondary, #666);
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-tertiary, #999);
  }

  .status-indicator.connected .status-dot {
    background: var(--success, #22c55e);
  }

  .status-indicator.syncing .status-dot {
    background: var(--warning, #f59e0b);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .status-indicator.disconnected .status-dot {
    background: var(--error, #ef4444);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .room-info {
    font-family: monospace;
    font-size: 11px;
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
