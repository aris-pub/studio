<script setup>
  /**
   * EditableText - An inline text editing component with click-to-edit functionality
   *
   * A versatile component that displays text normally and switches to an input field
   * when clicked or activated. Supports keyboard shortcuts (Enter to save, Escape to cancel),
   * automatic width preservation, and custom styling. Perfect for inline editing workflows
   * like form labels, table cells, or any text that needs quick editing capabilities.
   *
   * Features:
   * - Click-to-edit with keyboard accessibility (Enter/Space to activate)
   * - Keyboard shortcuts: Enter to save, Escape to cancel
   * - Auto-save on blur with validation
   * - Dynamic width preservation during editing
   * - Customizable CSS classes for both display and input modes
   * - Emits save/cancel events for custom handling
   * - Accessible with proper ARIA roles and tabindex
   *
   * @displayName EditableText
   * @example
   * // Basic usage
   * <EditableText v-model="title" />
   *
   * @example
   * // With custom styling
   * <EditableText
   *   v-model="label"
   *   text-class="text-lg font-semibold"
   *   input-class="border-2 border-blue-500"
   * />
   *
   * @example
   * // With width preservation and clear-on-start
   * <EditableText
   *   v-model="description"
   *   :preserve-width="true"
   *   :clear-on-start="true"
   *   @save="handleSave"
   *   @cancel="handleCancel"
   * />
   *
   * @example
   * // Read-only mode (click disabled)
   * <EditableText
   *   v-model="readonlyText"
   *   :edit-on-click="false"
   *   ref="editableRef"
   * />
   * <!-- Use ref.startEditing() to programmatically activate -->
   */

  import { ref, nextTick, useTemplateRef, watch } from "vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";

  defineOptions({
    name: "EditableText",
  });
  const props = defineProps({
    /**
     * CSS classes to apply to the input field when in editing mode
     * @example "border-2 border-blue-500 rounded-md"
     */
    inputClass: { type: [String, Object, Array], default: "" },

    /**
     * CSS classes to apply to the text display when not editing
     * @example "text-lg font-semibold text-gray-800"
     */
    textClass: { type: [String, Object, Array], default: "" },

    /**
     * Placeholder text shown when value is empty (both in display and input modes)
     */
    placeholder: { type: String, default: "" },

    /**
     * Whether clicking the text should activate edit mode
     * Set to false for programmatic activation only
     */
    editOnClick: { type: Boolean, default: true },

    /**
     * Whether to clear the input field when editing starts
     * Useful for placeholder-style editing workflows
     */
    clearOnStart: { type: Boolean, default: false },

    /**
     * Whether to preserve and dynamically adjust the input width during editing
     * Maintains visual consistency by measuring text width and expanding as needed
     */
    preserveWidth: { type: Boolean, default: false },
  });
  const text = defineModel({ type: String, default: "" });

  /**
   * Component events
   * @event save - Emitted when text is saved (Enter key, blur, or programmatic save)
   * @event cancel - Emitted when editing is cancelled (Escape key or programmatic cancel)
   * @event editing-start - Emitted when editing mode is activated
   * @event editing-end - Emitted when editing mode is deactivated
   */
  const emit = defineEmits(["save", "cancel", "editing-start", "editing-end"]);
  const isEditing = ref(false);
  const inputRef = useTemplateRef("inputRef");
  const textRef = useTemplateRef("textRef");
  const inputValue = ref("");
  const capturedWidth = ref(0);
  const currentInputWidth = ref(0);
  const startEditing = async () => {
    inputValue.value = props.clearOnStart ? "" : text.value;

    // Calculate width based on text content only if preserveWidth is enabled
    if (props.preserveWidth && textRef.value) {
      capturedWidth.value = Math.max(textRef.value.scrollWidth, textRef.value.offsetWidth);
      currentInputWidth.value = capturedWidth.value;
    }

    isEditing.value = true;
    emit("editing-start");
    await nextTick();
    if (!inputRef.value) return;
    inputRef.value.focus();
    activate();
    const length = inputRef.value.value.length;
    inputRef.value.setSelectionRange(length, length);
  };
  const cancelEditing = () => {
    deactivate();
    isEditing.value = false;
    emit("editing-end");
    inputValue.value = text.value;
    emit("cancel");
  };
  const saveChanges = async () => {
    if (!isEditing.value) return;
    if (text.value === inputValue.value) {
      isEditing.value = false;
      emit("editing-end");
      return;
    }
    text.value = inputValue.value;
    await nextTick();
    isEditing.value = false;
    emit("editing-end");
    emit("save", text.value);
  };
  const { activate, deactivate } = useKeyboardShortcuts(
    {
      escape: () => cancelEditing(),
      enter: () => saveChanges(),
    },
    false
  );

  // Handle keydown events in input field
  const handleKeydown = (event) => {
    // Only prevent space bar from bubbling up to parent button
    // Allow ESC, ENTER, and other keys to work normally
    if (event.key === " ") {
      // Stop the event from bubbling up to parent elements
      // but allow the default behavior (typing space in input)
      event.stopImmediatePropagation();
      event.stopPropagation();
      // Don't preventDefault - we want the space to be typed
    }
  };

  // Watch for input changes and adjust width dynamically
  watch(inputValue, () => {
    if (!props.preserveWidth || !isEditing.value || !inputRef.value) return;

    try {
      // Create a temporary element to measure the text width
      const temp = document.createElement("span");
      temp.style.position = "absolute";
      temp.style.visibility = "hidden";
      temp.style.whiteSpace = "pre";
      temp.style.font = window.getComputedStyle(inputRef.value).font;
      temp.textContent = inputValue.value || " ";
      document.body.appendChild(temp);

      const textWidth = temp.offsetWidth + 20; // Add some padding
      currentInputWidth.value = Math.max(capturedWidth.value, textWidth);

      document.body.removeChild(temp);
    } catch (error) {
      // Gracefully handle DOM operation errors
      console.warn("[EditableText] Width calculation failed:", error);
      // Fall back to captured width or reasonable default
      currentInputWidth.value = capturedWidth.value || 100;
    }
  });

  /**
   * Exposes methods for programmatic control
   * @expose {Function} startEditing - Programmatically activate edit mode
   * @expose {Function} cancelEditing - Programmatically cancel editing and revert changes
   * @expose {Ref<boolean>} isEditing - Whether the component is currently in editing mode
   */
  defineExpose({ startEditing, cancelEditing, isEditing });
</script>
<template>
  <span class="editable-text">
    <div
      v-if="!isEditing"
      ref="textRef"
      type="button"
      class="editable"
      :class="[textClass, { 'editable-empty': !text }]"
      role="button"
      tabindex="0"
      @click="() => editOnClick && startEditing()"
      @keydown.enter.prevent="startEditing()"
      @keydown.space.prevent="startEditing()"
    >
      <template v-if="text">{{ text }}</template>
      <span v-else class="placeholder-text">{{ props.placeholder }}</span>
    </div>
    <input
      v-else
      ref="inputRef"
      v-model="inputValue"
      :placeholder="props.placeholder"
      :class="[inputClass, isEditing ? 'editing' : '']"
      :style="props.preserveWidth ? { width: currentInputWidth + 'px' } : {}"
      @blur="saveChanges"
      @click.stop
      @dblclick.stop
      @keydown="handleKeydown"
    />
  </span>
</template>
<style scoped>
  input {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    outline: none;
    width: 100%;
    min-width: 50px;
  }
  input.editing {
    border: var(--border-thin) solid var(--border-action);
    border-radius: 16px;
    padding: 8px;
    background: var(--white);
  }
  .editable {
    text-align: left;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 56px;
    line-height: 20px;
    white-space: normal;
  }
  .editable:focus-visible {
    outline: var(--border-med) solid var(--border-action);
    outline-offset: var(--border-extrathin);
  }
  .placeholder-text {
    color: var(--text-subtle);
    font-style: italic;
  }
</style>
