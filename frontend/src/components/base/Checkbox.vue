<script setup>
  import { computed } from "vue";

  const props = defineProps({
    modelValue: {
      type: Boolean,
      default: false,
    },
    id: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  });

  const emit = defineEmits(["update:modelValue"]);

  const isChecked = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value),
  });
</script>

<template>
  <div class="checkbox-container">
    <label :for="id" class="checkbox-wrapper">
      <!-- Hidden native input -->
      <input
        :id="id"
        v-model="isChecked"
        type="checkbox"
        class="hidden-input"
        :disabled="disabled"
      />

      <!-- Custom checkbox box -->
      <span class="checkbox-box" :class="{ checked: isChecked, disabled }"> </span>

      <!-- Label text -->
      <span class="checkbox-text">
        <slot />
      </span>
    </label>
  </div>
</template>

<style scoped>
  .checkbox-container {
    display: inline-block;
  }

  .checkbox-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  .hidden-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .checkbox-box {
    width: 18px;
    height: 18px;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 4px;
    background-color: var(--white);
    transition: var(--transition-bg-color), var(--transition-bd-color);
    flex-shrink: 0;
    position: relative;
  }

  .checkbox-wrapper:hover .checkbox-box:not(.disabled) {
    border-color: var(--border-action);
  }

  .hidden-input:focus-visible + .checkbox-box {
    outline: var(--border-med) solid var(--border-action);
    outline-offset: var(--border-extrathin);
  }

  .checkbox-box.checked {
    background-color: var(--surface-action);
    border-color: var(--surface-action);
  }

  .checkbox-wrapper:hover .checkbox-box.checked:not(.disabled) {
    background-color: var(--surface-action-hover);
    border-color: var(--surface-action-hover);
  }

  .checkbox-box.checked::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 8px;
    border: solid var(--white);
    border-width: 0 2px 2px 0;
    transform: translate(-50%, -60%) rotate(45deg);
  }

  .checkbox-box.disabled {
    background-color: var(--surface-disabled);
    border-color: var(--gray-300);
    cursor: not-allowed;
  }

  .checkbox-box.checked.disabled {
    background-color: var(--gray-300);
    border-color: var(--gray-300);
  }

  .checkbox-wrapper:has(.disabled) {
    cursor: not-allowed;
  }

  .checkbox-text {
    font-weight: var(--weight-medium);
    color: var(--gray-700);
  }

  .checkbox-wrapper:has(.disabled) .checkbox-text {
    color: var(--gray-400);
  }
</style>
