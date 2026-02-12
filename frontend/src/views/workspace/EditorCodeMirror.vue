<script setup>
  import { ref, computed, inject, watch, onBeforeUnmount } from "vue";
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
  import { lintKeymap } from "@codemirror/lint";
  import { yCollab } from "y-codemirror.next";
  import * as Y from "yjs";
  import { WebsocketProvider } from "y-websocket";

  const file = defineModel({ type: Object, required: true });
  const api = inject("api");
  const user = inject("user");
  const editSession = inject("editSession", null);

  // DOM ref for CodeMirror container
  const editorContainer = ref(null);
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
  const serverUrl = ref(import.meta.env.VITE_MULTIPLAYER_URL);

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

      roomName.value = `file-${fileId}`;
      console.log(`[EditorCodeMirror] Setting up collaboration for ${roomName.value}`);

      // Create Y.Doc and Y.Text
      ydoc.value = new Y.Doc();
      ytext.value = ydoc.value.getText("text");

      // Create WebSocket provider
      provider.value = new WebsocketProvider(serverUrl.value, roomName.value, ydoc.value);
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

      // Wait for initial sync before creating editor
      provider.value.once("synced", () => {
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

        const state = EditorState.create({
          // CRITICAL: Initialize with Y.text content explicitly
          // yCollab only handles incremental changes, not initial state
          doc: docContent,
          extensions: [
            customSetup,
            yCollabExtension,
            transactionLogger,
            ...editableExtensions,
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
</script>

<template>
  <div class="editor-codemirror">
    <div class="status-bar">
      <span class="status-indicator" :class="statusClass">
        <span class="status-dot"></span>
        {{ statusText }}
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
</style>
