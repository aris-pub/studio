/**
 * Toast notification service for RSM Studio.
 *
 * Provides a simple API for showing toast notifications throughout the app.
 */

import { createApp, ref } from "vue";
import Toast from "@/components/ui/Toast.vue";

// Global toast state
const toasts = ref([]);
let toastIdCounter = 0;

/**
 * Create and mount a toast component
 */
function createToast(options) {
  const toastId = ++toastIdCounter;

  // Create a container for the toast
  const container = document.createElement("div");
  document.body.appendChild(container);

  // Create the toast app instance
  const toastApp = createApp(Toast, {
    ...options,
    onDismiss: () => {
      // Cleanup when toast is dismissed
      setTimeout(() => {
        toastApp.unmount();
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
        // Remove from toasts array
        const index = toasts.value.findIndex((t) => t.id === toastId);
        if (index > -1) {
          toasts.value.splice(index, 1);
        }
      }, 50);
    },
  });

  // Mount the toast
  const toastInstance = toastApp.mount(container);

  // Track the toast
  const toastData = {
    id: toastId,
    instance: toastInstance,
    app: toastApp,
    container,
  };

  toasts.value.push(toastData);

  return toastData;
}

/**
 * Toast service API
 */
export const toast = {
  /**
   * Show a success toast
   */
  success(message, options = {}) {
    return createToast({
      message,
      type: "success",
      ...options,
    });
  },

  /**
   * Show an error toast
   */
  error(message, options = {}) {
    return createToast({
      message,
      type: "error",
      duration: 6000, // Longer duration for errors
      ...options,
    });
  },

  /**
   * Show a warning toast
   */
  warning(message, options = {}) {
    return createToast({
      message,
      type: "warning",
      ...options,
    });
  },

  /**
   * Show an info toast
   */
  info(message, options = {}) {
    return createToast({
      message,
      type: "info",
      ...options,
    });
  },

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    toasts.value.forEach((toast) => {
      if (toast.instance && toast.instance.dismiss) {
        toast.instance.dismiss();
      }
    });
  },

  /**
   * Get current toasts (useful for testing)
   */
  getToasts() {
    return toasts.value;
  },
};

// Global error handler for uncaught errors
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  toast.error("An unexpected error occurred. Please try again.");
});

export default toast;
