<script setup>
  import { ref, computed, inject, onMounted, watch } from "vue";
  import { StateEffect } from "@codemirror/state";
  import { yCollab } from "y-codemirror.next";
  import { useCodeMirror } from "@/composables/useCodeMirror.js";
  import { useYjsDocument } from "@/composables/useYjsDocument.js";
  import { useWebSocketProvider } from "@/composables/useWebSocketProvider.js";

  const file = defineModel({ type: Object, required: true });
  const api = inject("api");
  const user = inject("user");

  // DOM ref for CodeMirror container
  const editorContainer = ref(null);

  // Y.js setup - use file ID as room name
  const documentId = computed(() => `file-${file.value?.id || "unknown"}`);
  const { ydoc, ytext, isReady: yjsReady } = useYjsDocument(documentId.value);

  // WebSocket provider - connect to multiplayer server
  const serverUrl = ref(import.meta.env.VITE_MULTIPLAYER_URL);
  const userInfo = computed(() => ({
    name: user?.value?.name || user?.value?.email || "Anonymous",
    color: `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`,
  }));

  const { awareness, isConnected, isSynced } = useWebSocketProvider({
    ydoc,
    roomName: documentId,
    serverUrl,
    user: userInfo,
  });

  // CodeMirror setup
  const { view, isReady: editorReady } = useCodeMirror({
    container: editorContainer,
    initialContent: computed(() => file.value?.source || ""),
    onUpdate: (newContent) => {
      // Content updates are handled by Y.js, no manual sync needed
      // But we can update local file ref for UI consistency
      if (file.value) {
        file.value.source = newContent;
      }
    },
  });

  // Integrate Y.js collaboration extension with CodeMirror
  // This binds ytext to the editor and enables cursor awareness
  watch(
    [view, ytext, awareness, yjsReady],
    ([viewInstance, ytextInstance, awarenessInstance, ready]) => {
      if (viewInstance && ytextInstance && awarenessInstance && ready) {
        console.log("[EditorCodeMirror] Integrating Y.js with CodeMirror");

        // Add yCollab extension to CodeMirror
        viewInstance.dispatch({
          effects: StateEffect.appendConfig.of(
            yCollab(ytextInstance, awarenessInstance, { undoManager: true })
          ),
        });

        // Expose view globally for testing
        if (import.meta.env.DEV) {
          window.__cmView = viewInstance;
        }
      }
    }
  );

  // Initialize Y.text with file content on mount
  onMounted(() => {
    watch(
      [ytext, () => file.value?.source],
      ([ytextInstance, source]) => {
        if (ytextInstance && source && ytextInstance.toString() === "") {
          // Only initialize if Y.text is empty (first load)
          ytextInstance.insert(0, source);
          console.log("[EditorCodeMirror] Initialized Y.text with file content");
        }
      },
      { immediate: true }
    );
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
      <span class="room-info">Room: {{ documentId }}</span>
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
