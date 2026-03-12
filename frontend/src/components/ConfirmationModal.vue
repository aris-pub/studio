<script setup>
  import { toRef, computed } from "vue";
  import Modal from "@/components/base/Modal.vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";

  /**
   * A reusable confirmation modal component for dangerous actions.
   *
   * @displayName ConfirmationModal
   *
   * @example
   * <!-- Basic usage -->
   * <ConfirmationModal
   *   :show="showDeleteModal"
   *   title="Delete File?"
   *   message="Are you sure you want to delete this file? This action cannot be undone."
   *   confirm-text="Delete"
   *   cancel-text="Cancel"
   *   variant="danger"
   *   @confirm="handleConfirm"
   *   @cancel="handleCancel"
   *   @close="handleClose"
   * />
   *
   * @example
   * <!-- With custom styling -->
   * <ConfirmationModal
   *   :show="showModal"
   *   title="Publish Changes?"
   *   message="This will make your changes visible to everyone."
   *   confirm-text="Publish"
   *   cancel-text="Keep Draft"
   *   variant="primary"
   *   @confirm="publishChanges"
   *   @cancel="keepDraft"
   * />
   */

  const props = defineProps({
    /**
     * Whether the modal is visible
     */
    show: {
      type: Boolean,
      default: false,
    },
    /**
     * The modal title
     */
    title: {
      type: String,
      required: true,
    },
    /**
     * The confirmation message
     */
    message: {
      type: String,
      required: true,
    },
    /**
     * Text for the confirm button
     * @values "Confirm", "Delete", "Publish", "Save", "OK"
     */
    confirmText: {
      type: String,
      default: "Confirm",
    },
    /**
     * Text for the cancel button
     * @values "Cancel", "Keep", "Discard", "No"
     */
    cancelText: {
      type: String,
      default: "Cancel",
    },
    /**
     * The visual variant for the confirm button
     * @values "primary", "danger", "warning"
     */
    confirmBtnClass: {
      type: String,
      default: "danger",
      validator: (value) => ["primary", "danger", "warning"].includes(value),
    },
    /**
     * Optional file data to pass through events
     */
    fileData: {
      type: Object,
      default: null,
    },
  });

  /**
   * Emitted when the user confirms the action
   * @binding {Object} fileData - The file data if provided
   */
  const emit = defineEmits(["confirm", "cancel", "close"]);

  // Computed button kind for the confirm button
  const confirmButtonKind = toRef(() => props.variant);

  // Handle modal close (ESC, backdrop click, etc.)
  const handleModalClose = () => {
    emit("close");
  };

  // Handle confirm button click
  const handleConfirm = () => {
    emit("confirm", props.fileData);
  };

  // Handle cancel button click
  const handleCancel = () => {
    emit("cancel");
  };

  // Handle modal-specific keyboard shortcuts
  const handleEnterKey = (event) => {
    if (!props.show) return;

    // Enter to confirm (unless focused on cancel button)
    const activeElement = document.activeElement;
    const isCancelButton = activeElement?.textContent?.includes(props.cancelText);

    if (!isCancelButton) {
      event.preventDefault();
      handleConfirm();
    }
  };

  const handleEscapeKey = (event) => {
    if (!props.show) return;
    event.preventDefault();
    handleCancel();
  };

  // Use keyboard shortcuts with override to block other components
  const { activate, deactivate } = useKeyboardShortcuts(
    {
      enter: handleEnterKey,
      escape: handleEscapeKey,
    },
    false, // Don't auto-activate
    "ConfirmationModal",
    true // Override others
  );

  // Handle modal visibility changes
  import { watch } from "vue";
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        activate();
      } else {
        deactivate();
      }
    }
  );

  // Expose methods for testing
  defineExpose({
    handleEnterKey,
    handleEscapeKey,
    handleConfirm,
    handleCancel,
  });
</script>

<template>
  <Modal v-if="show" data-testid="confirmation-modal" @close="handleModalClose">
    <template #header>
      <h2 class="modal-title">{{ title }}</h2>
    </template>

    <div class="confirmation-content">
      <p class="confirmation-message">{{ message }}</p>

      <div class="confirmation-actions">
        <Button
          kind="primary"
          class="confirm-button"
          :class="confirmBtnClass"
          data-testid="confirm-button"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </Button>

        <Button
          kind="secondary"
          class="cancel-button"
          data-testid="cancel-button"
          @click="handleCancel"
        >
          {{ cancelText }}
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
  .modal-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-body);
  }

  .confirmation-content {
    padding: 16px 0;
  }

  .confirmation-message {
    margin: 0 0 24px 0;
    color: var(--text-subtle);
    line-height: 1.5;
  }

  .confirmation-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;
  }

  .confirm-button {
    order: 2;
  }

  .cancel-button {
    order: 1;
  }

  /* Focus management */
  .confirmation-actions .confirm-button:focus {
    outline: 2px solid var(--border-action);
    outline-offset: 2px;
  }

  /* Mobile responsive */
  @media (max-width: 480px) {
    .confirmation-actions {
      flex-direction: column-reverse;
      gap: 8px;
    }

    .confirmation-actions .confirm-button,
    .confirmation-actions .cancel-button {
      order: unset;
      width: 100%;
    }
  }
</style>
