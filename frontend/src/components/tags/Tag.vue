<script setup>
  /**
   * Tag - A versatile tag component with color theming and optional inline editing
   *
   * A flexible tag component that displays categorization labels with visual states
   * (active/inactive) and color theming. Supports inline editing through integration
   * with EditableText component, making it perfect for tag management interfaces.
   * The component follows checkbox accessibility patterns and includes focus management.
   *
   * Features:
   * - Visual states: active (filled) and inactive (outlined) modes
   * - Color theming: red, purple, green, orange, and new-tag-color
   * - Inline editing with customizable behavior (click-to-edit, clear-on-start)
   * - Accessibility: proper ARIA attributes and keyboard navigation
   * - Programmatic editing control via exposed methods
   * - Integration with EditableText for seamless rename functionality
   * - Responsive design with CSS custom properties
   *
   * @displayName Tag
   * @example
   * // Basic tag display
   * <Tag :tag="{ name: 'Frontend', color: 'blue' }" />
   *
   * @example
   * // Active tag with color
   * <Tag
   *   :tag="{ name: 'Important', color: 'red' }"
   *   :active="true"
   * />
   *
   * @example
   * // Editable tag with rename functionality
   * <Tag
   *   :tag="{ name: 'Editable Tag', color: 'green' }"
   *   :editable="true"
   *   :edit-on-click="true"
   *   @rename="handleRename"
   * />
   *
   * @example
   * // Programmatic editing control
   * <Tag
   *   ref="tagRef"
   *   :tag="{ name: 'Click to Edit', color: 'purple' }"
   *   :editable="true"
   *   :edit-on-click="false"
   *   :clear-on-start-renaming="true"
   * />
   * <!-- Use tagRef.startEditing() to activate editing -->
   */

  import { ref, useTemplateRef } from "vue";

  defineOptions({
    name: "Tag",
  });

  const props = defineProps({
    /**
     * Tag data object containing name and color information
     * @example { name: "Frontend", color: "blue" }
     */
    tag: {
      type: Object,
      required: true,
      validator: (tag) => {
        return tag && typeof tag.name === "string" && typeof tag.color === "string";
      },
    },

    /**
     * Whether the tag is in active (filled) or inactive (outlined) state
     */
    active: { type: Boolean, default: false },

    /**
     * Whether the tag name can be edited inline
     */
    editable: { type: Boolean, default: false },

    /**
     * Whether clicking the tag should activate edit mode (when editable is true)
     */
    editOnClick: { type: Boolean, default: false },

    /**
     * Whether the input field should be cleared when editing starts
     */
    clearOnStartRenaming: { type: Boolean, default: false },
  });
  /**
   * Component events
   * @event rename - Emitted when tag name is changed via inline editing
   */
  const emit = defineEmits(["rename"]);

  const newName = ref(props.tag.name);
  const editableTextRef = useTemplateRef("editableTextRef");
  const isEditing = ref(false);

  /**
   * Handle keydown events on the button to prevent spacebar from triggering click during edit
   */
  const handleKeydown = (event) => {
    // If spacebar is pressed and we're in editing mode, prevent the default button behavior
    if (event.key === " " && isEditing.value) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  /**
   * Track editing state by listening to EditableText events
   */
  const onEditingStart = () => {
    isEditing.value = true;
  };

  const onEditingEnd = () => {
    isEditing.value = false;
  };

  /**
   * Exposes methods for programmatic control
   * @expose {Function} startEditing - Programmatically activate edit mode (only if editable is true)
   * @expose {Ref<boolean>} isEditing - Whether the tag is currently being edited
   */
  defineExpose({
    startEditing: () => {
      if (props.editable && editableTextRef.value?.startEditing) {
        editableTextRef.value.startEditing();
        isEditing.value = true;
      }
    },
    isEditing,
  });
</script>

<template>
  <button
    type="button"
    class="tag"
    :class="[active ? 'on' : 'off', tag?.color, editable ? 'editable' : '']"
    role="checkbox"
    :aria-checked="active"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <EditableText
      v-if="editable"
      ref="editableTextRef"
      v-model="newName"
      :edit-on-click="editOnClick"
      :clear-on-start="clearOnStartRenaming"
      :preserve-width="true"
      @save="(n) => emit('rename', n)"
      @editing-start="onEditingStart"
      @editing-end="onEditingEnd"
    />
    <span v-else>{{ tag.name }}</span>
  </button>
</template>

<style scoped>
  .tag {
    /* reset default button styles */
    background: transparent;
    border: none;
    font: inherit;

    display: flex;
    align-items: center;
    border-radius: 16px;
    padding-inline: 8px;
    padding-block: 4px;
    text-wrap: nowrap;
    height: 24px;
    text-align: center;
    border: var(--border-thin) solid transparent;
  }

  .tag.editable {
    cursor: pointer;
  }

  .tag.on {
    &.red {
      background-color: var(--red-300);
      color: var(--text-body);
    }

    &.purple {
      background-color: var(--purple-300);
      color: var(--text-body);
    }

    &.green {
      background-color: var(--green-300);
      color: var(--text-body);
    }

    &.orange {
      background-color: var(--orange-300);
      color: var(--text-body);
    }
  }

  .tag.off {
    &.red {
      border: var(--border-thin) solid var(--red-400);
      color: var(--red-400);
    }

    &.purple {
      border: var(--border-thin) solid var(--purple-400);
      color: var(--purple-400);
    }

    &.green {
      border: var(--border-thin) solid var(--green-400);
      color: var(--green-400);
    }

    &.orange {
      border: var(--border-thin) solid var(--orange-400);
      color: var(--orange-400);
    }

    &.new-tag-color {
      border: var(--border-thin) solid var(--gray-400);
      color: var(--gray-400);
    }
  }

  .tag:focus-visible {
    outline: var(--border-med) solid var(--border-action);
    outline-offset: var(--border-extrathin);
  }

  .tag:has(> .editable-text > input) {
    padding-inline: 0;
  }

  .tag > .editable-text > :deep(input) {
    padding-block: 0;
    background-color: transparent;
    width: inherit;
  }
</style>
