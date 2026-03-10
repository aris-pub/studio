<script setup>
  /**
   * Button component with multiple variants, sizes, and styling options.
   *
   * Provides primary, secondary, tertiary, and danger button styles with support for icons,
   * text, floating text labels, and customizable sizing. Includes accessibility features
   * and focus management.
   *
   * @displayName Button
   * @example
   * // Primary button with text
   * <Button kind="primary" text="Save Changes" />
   *
   * @example
   * // Secondary button with icon and text
   * <Button kind="secondary" icon="Plus" text="Add Item" size="md" />
   *
   * @example
   * // Icon-only button with floating text
   * <Button kind="tertiary" icon="Settings" text="Settings" textFloat="bottom" size="sm" />
   *
   * @example
   * // Custom content via slot
   * <Button kind="primary" size="lg">
   *   <span>Custom Content</span>
   * </Button>
   */

  import { useTemplateRef } from "vue";

  defineOptions({
    name: "Button",
  });

  const props = defineProps({
    /**
     * Visual style variant of the button
     * @values 'primary', 'secondary', 'tertiary', 'danger'
     */
    kind: {
      type: String,
      required: true,
      validator: (value) =>
        ["primary", "secondary", "tertiary", "danger", "danger-ghost"].includes(value),
    },

    /**
     * Size of the button affecting padding and border radius
     * @values 'sm', 'md', 'lg'
     */
    size: {
      type: String,
      default: "md",
      validator: (value) => ["xs", "sm", "md", "lg"].includes(value),
    },

    /**
     * Icon name from Tabler Icons to display in the button
     * @see https://tabler-icons.io/
     */
    icon: {
      type: String,
      default: null,
    },

    /**
     * Text content to display in the button
     */
    text: {
      type: String,
      default: "",
    },

    /**
     * Position for a floating text label shown on hover.
     * When set, the text renders as an absolutely-positioned tooltip
     * instead of inline content, so the button sizes as if it had no text.
     * @values 'bottom'
     */
    textFloat: {
      type: String,
      default: "",
    },

    /**
     * Whether the button is disabled and non-interactive
     */
    disabled: {
      type: Boolean,
      default: false,
    },

    /**
     * Whether to apply drop shadow styling
     */
    shadow: {
      type: Boolean,
      default: false,
    },
  });

  const btnRef = useTemplateRef("btn-ref");

  /**
   * Exposes the button DOM element reference for parent components
   * @expose {HTMLButtonElement} btn - The button DOM element
   */
  defineExpose({ btn: btnRef });
</script>

<template>
  <button
    ref="btn-ref"
    :disabled="disabled"
    :class="[kind, `btn-${size}`, shadow ? 'with-shadow' : '', disabled ? 'disabled' : '']"
    v-bind="$attrs"
  >
    <template v-if="icon">
      <Icon :name="icon" class="btn-icon" />
    </template>
    <span v-if="text && !textFloat" class="btn-text text-h6">
      {{ text }}
    </span>
    <span
      v-if="text && textFloat"
      class="btn-float-label text-caption"
      :class="`float-${textFloat}`"
    >
      {{ text }}
    </span>
    <!--
      @slot default - Custom button content (only used when no icon or text provided)
      @example
      <Button kind="primary">
        <span class="custom-content">Custom</span>
      </Button>
    -->
    <slot v-if="!icon && !text"></slot>
  </button>
</template>

<style scoped>
  /* ── Base ── */
  button {
    --bw: var(--border-thin);

    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    text-wrap: nowrap;
    outline: none;
    border: var(--bw) solid transparent;
    background-color: transparent;
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
  }

  /* ── Sizes ── */
  button.btn-xs {
    --v: calc(2px - var(--bw));
    --h: calc(6px - var(--bw));
    border-radius: 6px;

    & .btn-icon {
      width: 20px;
      height: 20px;
      stroke-width: 1.5;
    }

    & .btn-text {
      font-size: 11px;
    }

    & .btn-float-label {
      display: none;
    }

    &:has(.btn-icon):has(.btn-text) {
      padding: var(--v) var(--h) var(--v) calc(2px - var(--bw));
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

  /* ── Variants ── */
  button.primary {
    background-color: var(--primary-300);
    border-color: var(--primary-300);
    color: var(--almost-black);
    box-shadow: var(--shadow-soft), var(--shadow-strong);

    &:not(:disabled):hover {
      background-color: var(--primary-400);
      border-color: var(--primary-400);
    }

    & .btn-icon {
      color: var(--almost-black);
    }
  }

  button.primary:not(:disabled):active {
    background-color: var(--primary-500);
    border-color: var(--primary-500);
  }

  button.secondary {
    background-color: var(--gray-200);
    border-color: transparent;
    color: var(--extra-dark);

    &:not(:disabled):hover {
      background-color: var(--surface-hint);
      border-color: var(--surface-hint);
      color: var(--almost-black);
      box-shadow: var(--shadow-strong);
    }

    & .btn-icon {
      color: var(--extra-dark);
    }

    &:not(:disabled):hover .btn-icon {
      color: var(--almost-black);
    }
  }

  button.secondary.with-shadow {
    box-shadow: var(--shadow-strong);
  }

  button.secondary:not(:disabled):active {
    background-color: var(--blue-300);
    border-color: var(--blue-300);
  }

  button.tertiary {
    background-color: transparent;
    border-color: transparent;
    color: var(--extra-dark);

    &:not(:disabled):hover {
      background-color: var(--gray-100);
      color: var(--almost-black);
      box-shadow: var(--shadow-strong);
    }
  }

  button.tertiary.with-shadow {
    box-shadow: var(--shadow-strong);
  }

  button.tertiary:not(:disabled):active {
    background-color: var(--gray-200);
  }

  button.danger {
    background-color: var(--red-600);
    border-color: var(--red-600);
    color: white;

    &:not(:disabled):hover {
      background-color: var(--red-700);
      border-color: var(--red-700);
    }

    & .btn-icon {
      color: white;
    }

    &:focus-visible {
      box-shadow: 0 0 0 2px white;
      outline: var(--border-thin) solid var(--border-action);
      outline-offset: 3px;
    }
  }

  button.danger:not(:disabled):active {
    background-color: var(--red-300);
    border-color: var(--red-300);
    color: var(--almost-black);
  }

  button.danger-ghost {
    background-color: transparent;
    border-color: transparent;
    color: var(--extra-dark);

    &:not(:disabled):hover {
      background-color: var(--red-100);
      color: var(--red-700);
      box-shadow: var(--shadow-strong);
    }

    &:not(:disabled):hover .btn-icon {
      color: var(--red-700);
    }
  }

  button.danger-ghost:not(:disabled):active {
    background-color: var(--red-200);
    color: var(--red-800);
  }

  /* ── Disabled ── */
  button.primary:disabled,
  button.secondary:disabled,
  button.tertiary:disabled,
  button.danger:disabled,
  button.danger-ghost:disabled {
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

  /* ── Float label ── */
  button .btn-float-label {
    position: absolute;
    color: var(--extra-dark);
    pointer-events: none;
    display: none;
    text-wrap: nowrap;
    background: white;
    padding: 4px 8px;
    border-radius: 4px;
    box-shadow: var(--shadow-strong);
  }

  button .btn-float-label.float-bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }

  button:hover .btn-float-label {
    display: block;
  }
</style>
