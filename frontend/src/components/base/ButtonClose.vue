<script setup>
  /**
   * ButtonClose - A simple button component for closing elements.
   *
   * This component renders a close button (an 'X' icon) that emits a 'close' event when clicked.
   * It's typically used within modals, alerts, or other dismissible UI elements.
   *
   * @displayName ButtonClose
   * @example
   * // Basic usage
   * <ButtonClose @close="handleClose" />
   *
   * @example
   * // Within a modal header
   * <Modal>
   *   <template #header>
   *     <h2>My Modal</h2>
   *     <ButtonClose @close="closeModal" />
   *   </template>
   *   <!-- ... modal content ... -->
   * </Modal>
   */
  import { IconX } from "@tabler/icons-vue";
  defineEmits(["close"]);
</script>

<template>
  <button ref="buttonClose" class="tertiary btn-close" @click="$emit('close')">
    <IconX class="btn-icon" />
  </button>
</template>

<style scoped>
  button.btn-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    border: unset;
    transition: background 0.15s ease-in-out;
    color: var(--extra-dark);
    background-color: transparent;
    border-radius: 8px;
    padding: 0;

    &:hover {
      cursor: pointer;
      background-color: var(--surface-hint);
      color: var(--almost-black);

      & > svg {
        color: var(--almost-black);
      }
    }
    &:focus-visible {
      background-color: var(--surface-hint);
      outline: var(--border-med) solid var(--border-action);
      outline-offset: var(--border-extrathin);
    }

    & .btn-icon {
      stroke-width: 1.25px;
    }
  }
</style>
