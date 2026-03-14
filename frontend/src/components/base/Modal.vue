<script setup>
  /**
   * Modal - A flexible modal dialog component with backdrop and accessibility features
   *
   * A centered modal dialog with backdrop blur, responsive sizing, and comprehensive
   * accessibility features. Integrates with useClosable composable to provide multiple
   * ways to close the modal (Escape key, backdrop click, close button). The modal
   * automatically manages focus and provides proper ARIA attributes for screen readers.
   *
   * Features:
   * - Backdrop with blur effect and semi-transparent overlay
   * - Responsive sizing: 90% width, max 500px, max 80vh height
   * - Multiple close methods: ESC key, backdrop click, close button
   * - Automatic focus management and restoration
   * - Header and body slot support via integrated Pane component
   * - Accessibility: proper ARIA roles, labels, and focus trapping
   * - CSS custom properties for theming
   * - High z-index (1000) for proper layering
   *
   * @displayName Modal
   * @example
   * // Basic modal with header and content
   * <Modal @close="closeModal">
   *   <template #header>
   *     <h2>Modal Title</h2>
   *   </template>
   *   <p>Modal content goes here.</p>
   * </Modal>
   *
   * @example
   * // Modal with form and actions
   * <Modal @close="handleClose">
   *   <template #header>
   *     <div class="flex justify-between items-center">
   *       <h2>Edit Profile</h2>
   *     </div>
   *   </template>
   *   <form @submit="saveProfile">
   *     <InputText v-model="profile.name" label="Name" />
   *     <div class="mt-4 flex gap-2">
   *       <Button type="submit">Save</Button>
   *       <Button variant="secondary" @click="$emit('close')">Cancel</Button>
   *     </div>
   *   </form>
   * </Modal>
   *
   * @example
   * // Modal with custom content and no header
   * <Modal @close="closeModal">
   *   <div class="text-center p-6">
   *     <Icon name="AlertTriangle" size="lg" class="text-orange-500" />
   *     <h3 class="mt-2 text-lg font-semibold">Are you sure?</h3>
   *     <p class="mt-2 text-gray-600">This action cannot be undone.</p>
   *   </div>
   * </Modal>
   */

  import useClosable from "@/composables/useClosable.js";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";

  defineOptions({
    name: "Modal",
    inheritAttrs: false,
  });

  /**
   * Component events
   * @event close - Emitted when modal should be closed (ESC, backdrop click, or close button)
   */
  const emit = defineEmits(["close"]);

  // Use override flag to block other components' keyboard shortcuts when modal is active
  const keyboardController = useKeyboardShortcuts({}, true, "Modal", true);

  useClosable({
    onClose: () => emit("close"),
    closeOnEsc: true,
    closeOnOutsideClick: true,
    closeOnCloseButton: true,
    autoActivate: true,
    keyboardController, // Pass the existing controller to avoid duplicate registrations
  });
</script>

<template>
  <!--
    @slot header - Modal header content (title, close button, etc.)
    @example
    <template #header>
      <h2>Modal Title</h2>
    </template>
  -->
  <!--
    @slot default - Main modal content body
    @example
    <Modal>
      <p>Your modal content here</p>
    </Modal>
  -->
  <Teleport to="body">
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-content"
      v-bind="$attrs"
    >
      <div class="content" @click.stop>
        <Pane closable @close="emit('close')">
          <template #header>
            <slot name="header" />
          </template>
          <slot />
        </Pane>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--overlay-backdrop);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }

  .content {
    background: var(--surface-primary);
    border-radius: var(--radius-xl);
    max-width: 500px;
    max-height: 80vh;
    width: 90%;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    padding: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }
</style>
