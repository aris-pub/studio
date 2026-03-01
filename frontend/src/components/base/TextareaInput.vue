<template>
  <div class="textarea-input" :class="{ compact, inline: layout === 'inline' }">
    <textarea
      ref="textarea"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      class="textarea"
      @keydown="handleKeydown"
      @input="handleInput"
    ></textarea>
    <div v-if="showButtons" class="button-container" :class="{ inline: layout === 'inline' }">
      <BaseButton
        v-if="showEditButton"
        :disabled="disabled"
        kind="tertiary"
        size="sm"
        icon="Edit"
        class="edit-button"
      />
      <BaseButton
        :disabled="disabled || !canSubmit"
        :kind="submitButtonKind"
        :size="submitButtonSize"
        :icon="submitButtonIcon"
        :text="submitButtonText"
        class="submit-button"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>

<script>
  import { ref, computed, watch } from "vue";
  import BaseButton from "./Button.vue";

  export default {
    name: "TextareaInput",
    components: {
      BaseButton,
    },
    props: {
      modelValue: {
        type: String,
        default: "",
      },
      placeholder: {
        type: String,
        default: "Type something...",
      },
      disabled: {
        type: Boolean,
        default: false,
      },
      rows: {
        type: Number,
        default: 1,
      },
      autoResize: {
        type: Boolean,
        default: true,
      },
      maxHeight: {
        type: String,
        default: "120px",
      },
      submitOnEnter: {
        type: Boolean,
        default: true,
      },
      layout: {
        type: String,
        default: "stacked", // 'stacked' for chat, 'inline' for annotations
        validator: (value) => ["stacked", "inline"].includes(value),
      },
      showButtons: {
        type: Boolean,
        default: true,
      },
      showEditButton: {
        type: Boolean,
        default: false,
      },
      submitButtonText: {
        type: String,
        default: "",
      },
      submitButtonIcon: {
        type: String,
        default: "",
      },
      submitButtonKind: {
        type: String,
        default: "primary",
      },
      submitButtonSize: {
        type: String,
        default: "md",
      },
      compact: {
        type: Boolean,
        default: false,
      },
      requireContent: {
        type: Boolean,
        default: true,
      },
    },
    emits: ["update:modelValue", "submit", "input"],
    setup(props, { emit }) {
      const textarea = ref(null);

      const canSubmit = computed(() => {
        if (!props.requireContent) return true;
        return props.modelValue.trim().length > 0;
      });

      const resizeTextarea = () => {
        if (props.autoResize && textarea.value) {
          textarea.value.style.height = "auto";
          textarea.value.style.height =
            Math.min(textarea.value.scrollHeight, parseInt(props.maxHeight)) + "px";
        }
      };

      const handleInput = (event) => {
        emit("update:modelValue", event.target.value);
        resizeTextarea();
        emit("input", event.target.value);
      };

      const handleSubmit = () => {
        if (!canSubmit.value || props.disabled) return;

        const valueToSubmit = props.modelValue.trim();
        emit("submit", valueToSubmit);
        emit("update:modelValue", "");

        // Reset textarea height after clearing
        if (props.autoResize && textarea.value) {
          textarea.value.style.height = "auto";
        }
      };

      const handleKeydown = (event) => {
        if (
          props.submitOnEnter &&
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.preventDefault();
          handleSubmit();
        }
      };

      const focus = () => {
        if (textarea.value) {
          textarea.value.focus();
        }
      };

      // Watch for external model value changes to trigger resize
      watch(
        () => props.modelValue,
        () => {
          if (props.autoResize) {
            resizeTextarea();
          }
        }
      );

      return {
        textarea,
        canSubmit,
        handleInput,
        handleSubmit,
        handleKeydown,
        focus,
        resizeTextarea,
      };
    },
  };
</script>

<style scoped>
  .textarea-input {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 16px 20px;
    background: var(--surface-primary);
    border-top: var(--border-extrathin) solid var(--border-primary);
    backdrop-filter: blur(10px);
  }

  .textarea-input.compact {
    padding: 12px 16px;
    gap: 8px;
    border-top: none;
  }

  .textarea-input.inline {
    position: relative;
    padding: 0;
    background: transparent;
    border: none;
    backdrop-filter: none;
  }

  .textarea {
    flex: 1;
    min-height: 44px;
    max-height: v-bind(maxHeight);
    padding: 12px 16px;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 24px;
    font-size: 16px;
    font-family: inherit;
    line-height: 1.5;
    resize: none;
    outline: none;
    transition:
      var(--transition-bd-color),
      box-shadow 0.2s ease;
    background-color: var(--surface-hover);
    color: var(--extra-dark);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* Internet Explorer 10+ */
  }

  .textarea::-webkit-scrollbar {
    display: none; /* WebKit */
  }

  .textarea-input.compact .textarea {
    box-sizing: border-box;
    min-height: 32px;
    padding: 5px 12px;
    border-radius: 18px;
    font-size: 14px;
  }

  .textarea:focus {
    border-color: var(--border-action);
    box-shadow:
      0 0 0 3px rgba(var(--primary-600), 0.1),
      0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: var(--surface-hint);
  }

  .textarea::placeholder {
    color: var(--medium);
    font-style: italic;
  }

  .button-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .button-container.inline {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    gap: 4px;
  }

  .button-container.inline .edit-button,
  .button-container.inline .submit-button {
    height: 32px;
    width: 32px;
    border-radius: 16px;
    transition: all 0.2s ease;
  }

  .button-container.inline .edit-button:hover,
  .button-container.inline .submit-button:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .button-container.inline :deep(.tabler-icon) {
    color: var(--dark) !important;
  }

  /* Stacked layout styling */
  .button-container:not(.inline) .submit-button {
    min-height: 44px;
    min-width: 44px;
    border-radius: 8px;
    font-weight: var(--weight-semi);
    transition: all 0.2s ease;
  }

  .button-container:not(.inline) .submit-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
</style>
