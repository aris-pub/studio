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

  // Cleanup function
  const cleanup = () => {
    console.log("[EditorCodeMirror] Cleaning up");

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
      console.log(`[Y.js] Connecting to ${serverUrl.value} (room: ${roomName.value})`);
      provider.value = new WebsocketProvider(serverUrl.value, roomName.value, ydoc.value);
      awareness.value = provider.value.awareness;

      // Set user awareness
      awareness.value.setLocalStateField("user", userInfo.value);

      // Monitor connection
      provider.value.on("status", (event) => {
        isConnected.value = event.status === "connected";
        console.log(`[Y.js] WebSocket status: ${event.status}`);
      });

      // Wait for initial sync before creating editor
      provider.value.once("synced", () => {
        const ytextLength = ytext.value.toString().length;
        console.log(`[Y.js] Document synced, ytext has ${ytextLength} chars`);

        // Initialize ONLY if completely empty
        if (ytextLength === 0 && file.value?.source) {
          console.log(
            `[EditorCodeMirror] First client - initializing Y.text with ${file.value.source.length} chars`
          );
          // Use transaction to ensure atomic initialization
          ydoc.value.transact(() => {
            ytext.value.insert(0, file.value.source);
          });
        } else if (ytextLength > 0) {
          console.log(
            `[EditorCodeMirror] Not first client - using existing content (${ytextLength} chars)`
          );
        } else {
          console.log("[EditorCodeMirror] No initial content to load");
        }

        // Create editor with yCollab binding
        console.log("[EditorCodeMirror] Creating CodeMirror with Y.js integration");
        const undoManager = new Y.UndoManager(ytext.value);

        const state = EditorState.create({
          // CRITICAL: Initialize with Y.text content explicitly
          // This ensures editor shows content when reconnecting (yCollab doesn't apply initial state)
          doc: ytext.value.toString(),
          extensions: [
            customSetup,
            yCollab(ytext.value, awareness.value, { undoManager }),
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

        console.log(
          `[EditorCodeMirror] Created editor with ${ytext.value.toString().length} chars`
        );

        // Wait for editor to fully mount before marking as synced
        setTimeout(() => {
          // Expose view and Y.js instances globally for testing
          if (import.meta.env.DEV) {
            window.__cmView = view.value;
            window.__ydoc = ydoc.value;
            window.__ytext = ytext.value;
            window.__provider = provider.value;
            window.__awareness = awareness.value;
          }

          isSynced.value = true;
        }, 100);
      });

      // Monitor sync status
      provider.value.on("sync", (synced) => {
        console.log(`[Y.js] Document synced: ${synced}`);
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
