<script setup>
  /**
   * ButtonToggle - A customizable toggle button component.
   *
   * This component provides a button that can be toggled between active and inactive states.
   * It supports displaying text, an icon, or both, and offers various styling options
   * including size, hover color, active color, and button type (filled or outline).
   *
   * @displayName ButtonToggle
   * @example
   * // Basic usage with text
   * <ButtonToggle v-model="isActive" text="Toggle Me" />
   *
   * @example
   * // With icon and custom colors
   * <ButtonToggle v-model="isActive" icon="Star" active-color="green" hover-color="var(--green-100)" />
   *
   * @example
   * // Small, outline type with text and icon
   * <ButtonToggle v-model="isActive" text="Filter" icon="Filter" size="sm" type="outline" />
   *
   * @example
   * // Using default slot for custom content
   * <ButtonToggle v-model="isActive">
   *   <span>Custom Content</span>
   * </ButtonToggle>
   */
  import { watch, computed } from "vue";

  defineOptions({
    name: "ButtonToggle",
  });

  const props = defineProps({
    text: { type: String, default: "" },
    icon: { type: String, default: "" },
    iconClass: { type: String, default: "" },
    size: { type: String, default: "md" },
    hoverColor: { type: String, default: "var(--gray-50)" },
    activeColor: { type: String, default: "blue" },
    type: { type: String, default: "filled" },
    disabled: { type: Boolean, default: false },
  });
  const active = defineModel({ type: Boolean });
  const emit = defineEmits(["on", "off"]);

  watch(active, (newValue) => (newValue ? emit("on") : emit("off")));
  const bgColor = computed(() => `var(--${props.activeColor}-300)`);
  const bgHoverColor = computed(() => `var(--${props.activeColor}-400)`);
  const pressedColor = computed(() => `var(--${props.activeColor}-500)`);
</script>

<template>
  <button
    class="text-h6 btn-toggle"
    :class="[`btn-${size}`, active ? 'active' : '']"
    :disabled="disabled"
    @click="active = !active"
  >
    <template v-if="icon">
      <Icon :name="icon" class="btn-icon" :class="iconClass" />
    </template>
    <span v-if="text" class="btn-text">{{ text }}</span>
    <slot />
  </button>
</template>

<style scoped>
  /* ── Base ── */
  button {
    --bw: var(--border-thin);

    display: flex;
    align-items: center;
    gap: 4px;
    border: var(--bw) solid transparent;
    background-color: transparent;
    outline: none;
    transition:
      background-color var(--transition-duration) ease,
      border-color var(--transition-duration) ease,
      box-shadow var(--transition-duration) ease,
      color var(--transition-duration) ease,
      opacity var(--transition-duration) ease;

    &:hover {
      cursor: pointer;
    }

    &:focus-visible {
      outline: var(--border-thin) solid var(--border-action);
      outline-offset: var(--border-extrathin);
    }

    &:not(.active):not(:disabled):hover {
      background-color: v-bind("hoverColor");
      box-shadow: var(--shadow-strong);
    }

    &.active {
      background-color: v-bind("bgColor");
      color: var(--almost-black);
      box-shadow: var(--shadow-strong);
    }

    &.active:not(:disabled):hover {
      background-color: v-bind("bgHoverColor");
    }

    &:not(.active):not(:disabled):active {
      background-color: v-bind("pressedColor");
    }

    &.active:not(:disabled):active {
      background-color: v-bind("pressedColor");
    }
  }

  /* ── Disabled ── */
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* ── Shared ── */
  button .btn-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    margin: 0;
  }

  /* ── Sizes ── */
  button.btn-sm {
    --v: calc(4px - var(--bw));
    --h: calc(8px - var(--bw));
    border-radius: 8px;

    &:has(.btn-icon):has(.btn-text) {
      padding: var(--v) var(--h) var(--v) calc(4px - var(--bw));
    }
    &:has(.btn-icon):not(:has(.btn-text)) {
      padding: var(--v);
    }
    &:not(:has(.btn-icon)):has(.btn-text) {
      padding: var(--v) var(--h);
    }
    &:not(:has(.btn-icon)):not(:has(.btn-text)) {
      padding: var(--v);
    }
  }

  button.btn-md {
    --v: calc(6px - var(--bw));
    --h: calc(12px - var(--bw));
    border-radius: 16px;

    &:has(.btn-icon):has(.btn-text) {
      padding: var(--v) var(--h) var(--v) calc(6px - var(--bw));
    }
    &:has(.btn-icon):not(:has(.btn-text)) {
      padding: var(--v) calc(6px - var(--bw));
    }
    &:not(:has(.btn-icon)):has(.btn-text) {
      padding: var(--v) var(--h);
    }
    &:not(:has(.btn-icon)):not(:has(.btn-text)) {
      padding: var(--v) calc(6px - var(--bw));
    }
  }

  button.btn-lg {
    --v: calc(12px - var(--bw));
    --h: calc(24px - var(--bw));
    border-radius: 24px;

    &:has(.btn-icon):has(.btn-text) {
      padding: var(--v) var(--h) var(--v) calc(16px - var(--bw));
    }
    &:has(.btn-icon):not(:has(.btn-text)) {
      padding: var(--v);
    }
    &:not(:has(.btn-icon)):has(.btn-text) {
      padding: var(--v) var(--h);
    }
    &:not(:has(.btn-icon)):not(:has(.btn-text)) {
      padding: var(--v);
    }
  }
</style>
