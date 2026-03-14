<script setup>
  /**
   * InputText - A flexible form input component with integrated label support
   *
   * A versatile input component that provides consistent styling and layout options
   * for text input fields. Supports both horizontal (row) and vertical (column) layouts,
   * with proper accessibility through label association. The component inherits all
   * standard HTML input attributes and passes them through to the underlying input element.
   *
   * Features:
   * - Flexible layout: horizontal (row) or vertical (column) orientation
   * - Integrated label with proper accessibility (for/id association)
   * - Transparent background with focus styling
   * - Disabled state styling
   * - Inherits all standard HTML input attributes
   * - Responsive design with CSS custom properties
   * - Supports all HTML input types (text, email, password, etc.)
   *
   * @displayName InputText
   * @example
   * // Basic usage with label
   * <InputText v-model="username" label="Username" />
   *
   * @example
   * // Vertical layout with placeholder
   * <InputText
   *   v-model="email"
   *   label="Email Address"
   *   type="email"
   *   direction="column"
   *   placeholder="Enter your email"
   * />
   *
   * @example
   * // With HTML attributes passed through
   * <InputText
   *   v-model="password"
   *   label="Password"
   *   type="password"
   *   required
   *   minlength="8"
   *   autocomplete="current-password"
   * />
   *
   * @example
   * // Disabled state
   * <InputText
   *   v-model="readonlyField"
   *   label="Read Only"
   *   disabled
   * />
   */

  import { useId } from "vue";

  defineOptions({
    name: "InputText",
    inheritAttrs: false,
  });

  const props = defineProps({
    /**
     * Label text to display with the input field
     * When direction is "row", a colon (:) is automatically appended
     */
    label: { type: String, default: "" },

    /**
     * HTML input type attribute
     * @values 'text', 'email', 'password', 'number', 'tel', 'url', 'search'
     */
    type: { type: String, default: "text" },

    /**
     * Layout direction for label and input positioning
     * @values 'row', 'column'
     */
    direction: {
      type: String,
      default: "row",
      validator: (value) => ["row", "column"].includes(value),
    },

    /**
     * Placeholder text shown when input is empty
     */
    placeholder: { type: String, default: "" },
  });

  const value = defineModel({ type: String });
  const inputId = useId();
</script>

<template>
  <div class="input-text" :class="direction">
    <label v-if="label" class="text-label" :for="inputId"
      >{{ label }}<span v-if="direction === 'row'">:</span></label
    >
    <input
      :id="inputId"
      v-bind="$attrs"
      v-model="value"
      class="text-caption"
      :type="type"
      :placeholder="placeholder"
    />
  </div>
</template>

<style scoped>
  .input-text {
    display: flex;
  }

  .input-text.row {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .input-text.column {
    flex-direction: column;
    gap: 2px;
  }

  input {
    background: transparent;
    border: none;
    padding-block: 10px;
    padding-inline: 12px;
    margin: 0;
    outline: none;
    width: 100%;
    height: 100%;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 8px;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;
  }

  input:focus {
    border-color: var(--border-action);
    background-color: var(--white);
  }

  input[disabled] {
    background-color: var(--surface-disabled);
    cursor: not-allowed;
  }
</style>
