<script setup>
  import TextareaInput from "@/components/base/TextareaInput.vue";

  /**
   * AnnotationInputBox - Expandable annotation input component
   *
   * A specialized input component for creating annotations with expandable states
   * and integrated action buttons. Features a compact default state that can expand
   * to show additional editing controls.
   *
   * Features:
   * - Two states: compact and expanded
   * - Integrated send and edit buttons
   * - Enter key submission
   * - Placeholder text for guidance
   * - Responsive sizing based on state
   *
   * @displayName AnnotationInputBox
   * @example
   * // Basic usage
   * <AnnotationInputBox
   *   v-model="annotationText"
   *   @submit="handleSubmit"
   * />
   *
   * @example
   * // Expanded state
   * <AnnotationInputBox
   *   v-model="annotationText"
   *   :expanded="true"
   *   @submit="handleSubmit"
   * />
   *
   * @example
   * // Compact state
   * <AnnotationInputBox
   *   v-model="annotationText"
   *   :expanded="false"
   *   @submit="handleSubmit"
   * />
   */

  const props = defineProps({
    /**
     * Whether the input is in expanded state (shows edit button)
     */
    expanded: { type: Boolean, default: true },
  });

  /**
   * Events emitted by the component
   * @event submit - Emitted when text is submitted (Enter key or send button)
   */
  const emit = defineEmits(["submit"]);

  /**
   * The annotation text content (v-model)
   */
  const value = defineModel({ type: String, default: "" });

  const onSubmit = (text) => {
    emit("submit", text);
  };
</script>

<template>
  <div class="ann-input-box" :class="expanded ? 'expanded' : ''">
    <TextareaInput
      v-model="value"
      placeholder="What's on your mind?"
      layout="inline"
      :show-edit-button="expanded"
      submit-button-icon="Send2"
      submit-button-kind="tertiary"
      submit-button-size="sm"
      :compact="true"
      :rows="expanded ? 3 : 1"
      :max-height="expanded ? '64px' : '32px'"
      @submit="onSubmit"
    />
  </div>
</template>

<style scoped>
  .ann-input-box {
    width: 204px;
  }

  .ann-input-box.expanded {
    /* Additional styling for expanded state if needed */
  }
</style>
