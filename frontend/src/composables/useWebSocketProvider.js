import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";

/**
 * WebSocket provider composable for Y.js document synchronization
 *
 * @param {Object} options
 * @param {Ref} options.ydoc - Y.Doc instance (from useYjsDocument)
 * @param {Ref|String} options.roomName - Room ID for collaboration (e.g., file ID)
 * @param {Ref|String} options.serverUrl - WebSocket server URL (default: ws://localhost:1234)
 * @param {Object} options.user - User info for awareness (name, color)
 * @returns {Object} { provider, awareness, isConnected, isSynced, disconnect }
 */
export function useWebSocketProvider({ ydoc, roomName, serverUrl, user }) {
  const provider = ref(null);
  const awareness = ref(null);
  const isConnected = ref(false);
  const isSynced = ref(false);

  const connect = () => {
    if (!ydoc.value) {
      console.warn("useWebSocketProvider: Y.Doc not ready");
      return;
    }

    const room = typeof roomName === "object" && roomName.value ? roomName.value : roomName;

    const url =
      typeof serverUrl === "object" && serverUrl.value
        ? serverUrl.value
        : serverUrl;

    if (!room) {
      console.error("useWebSocketProvider: roomName is required");
      throw new Error("useWebSocketProvider: roomName is required");
    }

    if (!url) {
      console.error("useWebSocketProvider: serverUrl is required");
      throw new Error("useWebSocketProvider: serverUrl is required");
    }

    // Create awareness for cursor/selection sharing
    awareness.value = new Awareness(ydoc.value);

    // Set local user info for awareness
    const userInfo = user || {
      name: `User ${Math.floor(Math.random() * 100)}`,
      color: `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`,
    };

    awareness.value.setLocalStateField("user", userInfo);

    // Create WebSocket provider
    provider.value = new WebsocketProvider(url, room, ydoc.value, { awareness: awareness.value });

    // Connection status listeners
    provider.value.on("status", (event) => {
      isConnected.value = event.status === "connected";
      console.log(`[Y.js] WebSocket status: ${event.status}`);
    });

    provider.value.on("sync", (synced) => {
      isSynced.value = synced;
      console.log(`[Y.js] Document synced: ${synced}`);
    });

    console.log(`[Y.js] Connecting to ${url} (room: ${room})`);
  };

  const disconnect = () => {
    if (provider.value) {
      provider.value.destroy();
      provider.value = null;
      awareness.value = null;
      isConnected.value = false;
      isSynced.value = false;
      console.log("[Y.js] Disconnected");
    }
  };

  // Reconnect if ydoc or roomName changes
  watch([ydoc, () => (typeof roomName === "object" ? roomName.value : roomName)], () => {
    disconnect();
    if (ydoc.value) {
      connect();
    }
  });

  onMounted(() => {
    connect();
  });

  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    provider,
    awareness,
    isConnected,
    isSynced,
    disconnect,
  };
}
