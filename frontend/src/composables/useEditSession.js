import { ref, watch, onBeforeUnmount } from "vue";

/**
 * EditSession composable for managing file content editing
 *
 * @param {Number} fileId - File ID being edited
 * @param {Object} options - Configuration options
 * @param {String} options.implementation - 'http' or 'yjs'
 * @param {Object} options.api - Axios API instance
 * @param {Object} options.user - User object
 * @param {Number} options.debounceTime - Debounce time in ms (default: 2000)
 * @param {Number} options.autoSaveInterval - Auto-save interval in ms (default: 30000)
 * @param {Function} options.onCompile - Optional compile callback
 * @returns {Object} EditSession interface
 */
export function useEditSession(fileId, options = {}) {
  const {
    implementation: _implementation = "http",
    api,
    user: _user,
    debounceTime = 2000,
    autoSaveInterval = 30000,
    onCompile = null,
  } = options;

  // State
  const content = ref("");
  const status = ref("idle");
  const isConnected = ref(false);

  // Internal state
  let debounceTimeout = null;
  let autoSaveTimer = null;
  let unwatchContent = null;
  let isStopped = false;

  /**
   * Load initial content from backend
   */
  const start = async () => {
    if (!api || !fileId) {
      throw new Error("useEditSession: api and fileId are required");
    }

    try {
      const response = await api.get(`/files/${fileId}`);
      content.value = response.data.source || "";
      status.value = "idle";

      // Setup debounced save on content changes
      unwatchContent = watch(content, () => {
        if (isStopped) return;

        status.value = "pending";

        // Clear existing debounce timer
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }

        // Set new debounce timer
        debounceTimeout = setTimeout(async () => {
          await save();
        }, debounceTime);
      });

      // Setup auto-save interval
      autoSaveTimer = setInterval(async () => {
        if (isStopped) return;
        if (status.value === "pending") {
          await save();
        }
      }, autoSaveInterval);
    } catch (error) {
      console.error("Error loading file content:", error);
      status.value = "error";
      throw error;
    }
  };

  /**
   * Save content to backend
   */
  const save = async () => {
    if (isStopped || !api || !fileId) return;

    try {
      status.value = "saving";
      await api.put(`/files/${fileId}`, {
        source: content.value,
      });
      status.value = "saved";

      // Trigger compile if provided
      if (onCompile) {
        await onCompile();
      }

      // Reset to idle after 3 seconds
      setTimeout(() => {
        if (status.value === "saved") {
          status.value = "idle";
        }
      }, 3000);
    } catch (error) {
      console.error("Error saving file content:", error);
      status.value = "error";

      // Reset to pending after 5 seconds to retry
      setTimeout(() => {
        if (status.value === "error") {
          status.value = "pending";
        }
      }, 5000);
    }
  };

  /**
   * Manual save (bypass debounce)
   */
  const manualSave = async () => {
    // Clear debounce timer
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }

    await save();
  };

  /**
   * Stop editing session and cleanup
   */
  const stop = async () => {
    // Save pending changes before stopping
    if (status.value === "pending" && api && fileId) {
      await save();
    }

    isStopped = true;

    // Stop watching content changes
    if (unwatchContent) {
      unwatchContent();
      unwatchContent = null;
    }

    // Clear timers
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }

    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  };

  /**
   * Trigger compilation
   */
  const compile = async () => {
    if (onCompile) {
      await onCompile();
    }
  };

  // Cleanup on component unmount (only if in component context)
  onBeforeUnmount(() => {
    stop();
  });

  return {
    content,
    status,
    isConnected,
    start,
    stop,
    manualSave,
    compile,
  };
}
