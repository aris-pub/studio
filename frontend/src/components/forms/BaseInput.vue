<script setup>
  /**
   * BaseInput - A flexible and accessible base input component.
   *
   * This component serves as a foundational input field, providing consistent styling,
   * layout options, and integration with form validation. It supports different visual
   * variants (e.g., standard input, search input), sizes, and layouts (row or column).
   * It also includes slots for extending its functionality with prepended/appended content
   * and custom error displays.
   *
   * @displayName BaseInput
   * @example
   * // Basic text input
   * <BaseInput v-model="value" label="Username" placeholder="Enter your username" />
   *
   * @example
   * // Search input with buttons and icon
   * <BaseInput v-model="searchQuery" variant="search" show-icon with-buttons button-close />
   *
   * @example
   * // Input with validation error
   * <BaseInput v-model="email" label="Email" :error="emailError" />
   *
   * @example
   * // Custom prepend and append content
   * <BaseInput v-model="amount">
   *   <template #prepend><span>$</span></template>
   *   <template #append><span>.00</span></template>
   * </BaseInput>
   */
  import { computed, useTemplateRef, nextTick } from "vue";
  import { useFormField } from "@/composables/useFormField.js";

  const props = defineProps({
    modelValue: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    direction: { type: String, default: "row" },
    size: { type: String, default: "md" },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    validator: { type: Function, default: null },
    validateOnBlur: { type: Boolean, default: false },
    variant: { type: String, default: "input" }, // 'input' or 'search'

    // Search variant specific props
    withButtons: { type: Boolean, default: false },
    showIcon: { type: Boolean, default: false },
    buttonClose: { type: Boolean, default: false },
    buttonsDisabled: { type: Boolean, default: false },

    // Accessibility
    id: { type: String, default: null },
    ariaLabel: { type: String, default: null },
    ariaDescribedby: { type: String, default: null },

    // Error prop for external error handling
    error: { type: String, default: null },

    // Label
    label: { type: String, default: null },
  });

  const emit = defineEmits([
    "update:modelValue",
    "focus",
    "blur",
    "validation",
    "submit",
    "next",
    "prev",
    "cancel",
  ]);

  // Use form field composable
  const { value, focused, error, inputClass, validate, setFocus, setBlur, clearError } =
    useFormField({
      direction: props.direction,
      required: props.required,
      validator: props.validator,
      validateOnBlur: props.validateOnBlur,
      props,
      emit,
    });

  // Template refs
  const inputRef = useTemplateRef("input");

  // Computed properties
  const inputId = computed(
    () => props.id || `base-input-${Math.random().toString(36).substr(2, 9)}`
  );

  const componentClasses = computed(() => [
    "base-input",
    `variant-${props.variant}`,
    `direction-${props.direction}`,
    `size-${props.size}`,
    {
      focused: focused.value,
      error: Boolean(currentError.value),
      disabled: props.disabled,
      readonly: props.readonly,
    },
  ]);

  // Use external error prop if provided, otherwise use internal error
  const currentError = computed(() => props.error || error.value);

  const inputAttributes = computed(() => ({
    id: inputId.value,
    placeholder: props.placeholder,
    disabled: props.disabled,
    readonly: props.readonly,
    required: props.required,
    "aria-label": props.ariaLabel,
    "aria-describedby": currentError.value ? `${inputId.value}-error` : props.ariaDescribedby,
    "aria-invalid": Boolean(currentError.value),
  }));

  // Methods
  const focus = async () => {
    await nextTick();
    if (inputRef.value) {
      inputRef.value.focus();
    }
  };

  const blur = async () => {
    await nextTick();
    if (inputRef.value) {
      inputRef.value.blur();
    }
  };

  const handleFocus = () => {
    setFocus();
  };

  const handleBlur = () => {
    setBlur();
  };

  // Search variant methods
  const handleSubmit = () => {
    if (props.variant === "search") {
      emit("submit", value.value);
    }
  };

  const handleNext = () => {
    if (props.variant === "search") {
      emit("next");
    }
  };

  const handlePrev = () => {
    if (props.variant === "search") {
      emit("prev");
    }
  };

  const handleCancel = () => {
    if (props.variant === "search") {
      value.value = "";
      emit("cancel");
    }
  };

  // Expose methods for parent components
  defineExpose({
    focus,
    blur,
    validate,
    clearError,
    inputId,
  });
</script>

<template>
  <div :class="componentClasses">
    <!-- Label -->
    <label v-if="label" :for="inputId" class="base-input-label" data-testid="label">
      {{ label }}
    </label>

    <!-- Input wrapper -->
    <div class="base-input-wrapper">
      <!-- Prepend slot -->
      <div v-if="$slots.prepend" class="base-input-prepend">
        <slot name="prepend" />
      </div>

      <!-- Search icon for search variant -->
      <div
        v-if="variant === 'search' && showIcon"
        class="base-input-search-icon"
        data-testid="search-icon"
      >
        <Icon name="Search" />
      </div>

      <!-- Input element -->
      <input
        ref="input"
        v-model="value"
        v-bind="inputAttributes"
        class="base-input-field"
        data-testid="base-input"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter="handleSubmit"
      />

      <!-- Search buttons for search variant -->
      <div v-if="variant === 'search' && withButtons" class="base-input-search-buttons">
        <slot
          name="search-buttons"
          :emit="emit"
          :handle-next="handleNext"
          :handle-prev="handlePrev"
          :handle-submit="handleSubmit"
          :handle-cancel="handleCancel"
        >
          <button type="button" :disabled="buttonsDisabled" @click="handlePrev">Previous</button>
          <button type="button" :disabled="buttonsDisabled" @click="handleNext">Next</button>
        </slot>
      </div>

      <!-- Close button for search variant -->
      <button
        v-if="variant === 'search' && buttonClose"
        type="button"
        class="base-input-close"
        data-testid="close-button"
        @click="handleCancel"
      >
        <Icon name="X" />
      </button>

      <!-- Append slot -->
      <div v-if="$slots.append" class="base-input-append">
        <slot name="append" />
      </div>
    </div>

    <!-- Error display -->
    <div
      v-if="currentError"
      :id="`${inputId}-error`"
      class="base-input-error"
      data-testid="validation-error"
    >
      <slot name="error" :error="currentError">
        {{ currentError }}
      </slot>
    </div>
  </div>
</template>

<style scoped>
  .base-input {
    display: flex;

    &.direction-row {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }

    &.direction-column {
      flex-direction: column;
      gap: 4px;
    }

    &.focused .base-input-wrapper {
      border-color: var(--primary-500);
      box-shadow: 0 0 0 2px var(--primary-100);
    }

    &.error .base-input-field {
      border-color: var(--red-500);
    }

    &.disabled {
      opacity: 0.6;
      pointer-events: none;
    }
  }

  .base-input-label {
    font-weight: var(--weight-medium);
    color: var(--text-body);
    font-size: 14px;
  }

  .base-input-wrapper {
    display: flex;
    align-items: center;
    position: relative;
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    background-color: var(--surface-page);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      border-color: var(--border-action-hover);
    }
  }

  .base-input-field {
    flex: 1;
    padding: 8px 12px;
    border: none;
    background: transparent;
    font-size: 14px;
    color: var(--text-body);
    outline: none;

    &::placeholder {
      color: var(--text-subtle);
    }

    &:disabled {
      cursor: not-allowed;
    }

    &:readonly {
      cursor: default;
    }
  }

  .base-input-prepend,
  .base-input-append {
    padding: 0 8px;
    display: flex;
    align-items: center;
    color: var(--text-subtle);
  }

  .base-input-search-icon {
    padding: 0 0 0 8px;
    display: flex;
    align-items: center;
    color: var(--text-subtle);
  }

  .base-input-search-buttons {
    display: flex;
    gap: 4px;
    padding: 0 8px;

    button {
      padding: 4px 8px;
      border: 1px solid var(--border-primary);
      border-radius: 4px;
      background: var(--surface-page);
      color: var(--text-body);
      font-size: 12px;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: var(--surface-hover);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }

  .base-input-close {
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--text-subtle);
    cursor: pointer;
    border-radius: 4px;
    margin-right: 4px;

    &:hover {
      background: var(--surface-hover);
      color: var(--text-body);
    }
  }

  .base-input-error {
    font-size: 12px;
    color: var(--red-600);
    margin-top: 4px;
  }

  /* Size variants */
  .size-sm {
    .base-input-field {
      padding: 6px 10px;
      font-size: 12px;
    }

    .base-input-wrapper {
      min-height: 32px;
    }
  }

  .size-md {
    .base-input-field {
      padding: 8px 12px;
      font-size: 14px;
    }

    .base-input-wrapper {
      min-height: 36px;
    }
  }

  .size-lg {
    .base-input-field {
      padding: 12px 16px;
      font-size: 16px;
    }

    .base-input-wrapper {
      min-height: 44px;
    }
  }

  /* Search variant styles */
  .variant-search {
    &.direction-row .base-input-wrapper {
      border-radius: 8px;
    }
  }
</style>
