<script setup>
  import { ref, useTemplateRef } from "vue";
  import { IconSearch } from "@tabler/icons-vue";

  /**
   * SearchBar - Interactive search input component
   *
   * A versatile search input component with keyboard navigation, search state management,
   * and optional navigation buttons. Supports both simple search and advanced navigation
   * through search results with prev/next functionality.
   *
   * Features:
   * - Keyboard shortcuts: Enter (search/next), Shift+Enter (previous), Escape (cancel)
   * - Optional search icon and close button
   * - Navigation buttons for stepping through results
   * - Custom placeholder text and hint display
   * - Slot support for additional custom buttons
   * - Accessible focus management
   *
   * @displayName SearchBar
   * @example
   * // Basic search
   * <SearchBar
   *   placeholder="Search documents..."
   *   @submit="handleSearch"
   *   @cancel="handleCancel"
   * />
   *
   * @example
   * // With navigation buttons
   * <SearchBar
   *   :with-buttons="true"
   *   hint-text="3 of 15"
   *   @submit="handleSearch"
   *   @next="handleNext"
   *   @prev="handlePrev"
   * />
   *
   * @example
   * // With custom buttons slot
   * <SearchBar @submit="handleSearch">
   *   <template #buttons>
   *     <Button icon="Filter" @click="showFilters" />
   *   </template>
   * </SearchBar>
   */

  const props = defineProps({
    /**
     * Whether to show navigation buttons (prev/next)
     */
    withButtons: { type: Boolean, default: false },
    /**
     * Placeholder text for the search input
     * @values "Search...", "Find in document...", "Search files..."
     */
    placeholder: { type: String, default: "Search..." },
    /**
     * Hint text to display between navigation buttons (e.g., "3 of 15")
     */
    hintText: { type: String, default: "" },
    /**
     * Whether to show the search icon
     */
    showIcon: { type: Boolean, default: true },
    /**
     * Whether to show the close button
     */
    buttonClose: { type: Boolean, default: false },
    /**
     * Whether navigation buttons are disabled
     */
    buttonsDisabled: { type: Boolean, default: false },
    /**
     * Size variant: "default" (48px) or "compact" (36px)
     */
    size: {
      type: String,
      default: "default",
      validator: (v) => ["default", "compact"].includes(v),
    },
  });

  /**
   * Events emitted by the component
   * @event submit - Emitted when search is initiated (Enter key or first search)
   * @event cancel - Emitted when search is cancelled (Escape key)
   * @event next - Emitted when navigating to next result (Enter or next button)
   * @event prev - Emitted when navigating to previous result (Shift+Enter or prev button)
   */
  const emit = defineEmits(["submit", "cancel", "next", "prev", "close"]);
  const searchText = ref("");
  const inputRef = useTemplateRef("inputRef");
  const isSearching = ref(false);

  const onEscape = () => {
    if (isSearching.value) {
      isSearching.value = false;
      searchText.value = "";
      emit("cancel");
    } else {
      emit("cancel");
    }
  };

  const onEnter = (ev) => {
    if (!isSearching.value) {
      isSearching.value = true;
      emit("submit", searchText.value);
      return;
    }

    if (!ev.shiftKey) emit("next", searchText.value);
    else emit("prev", searchText.value);
  };

  const focusInput = () => inputRef.value?.focus();

  /**
   * Exposes methods for parent components
   * @expose {Function} focusInput - Focus the search input programmatically
   */
  defineExpose({ focusInput });
</script>

<template>
  <div
    class="s-wrapper text-caption"
    :class="{ compact: size === 'compact' }"
    data-testid="search-bar"
    @click.stop="focusInput"
  >
    <IconSearch v-if="showIcon" />

    <input
      ref="inputRef"
      v-model="searchText"
      data-testid="search-input"
      type="text"
      :placeholder="placeholder"
      @keyup.enter.stop="onEnter"
      @keyup.escape="onEscape"
      @click.stop
      @dblclick.stop
    />

    <div v-if="withButtons" class="match-buttons">
      <Button
        kind="tertiary"
        icon="ChevronLeft"
        size="sm"
        :disabled="buttonsDisabled"
        @click.stop="emit('prev')"
      />
      <div v-if="hintText" class="hint">
        <span class="text-caption">{{ hintText }}</span>
        <Icon name="ArrowsHorizontal" />
      </div>
      <Button
        kind="tertiary"
        icon="ChevronRight"
        size="sm"
        :disabled="buttonsDisabled"
        @click.stop="emit('next')"
      />
    </div>

    <div v-if="$slots.buttons" class="buttons">
      <slot name="buttons" />
    </div>

    <ButtonClose v-if="buttonClose" @close="emit('close')" />
  </div>
</template>

<style scoped>
  .s-wrapper {
    color: var(--extra-dark);
    background-color: var(--surface-page);
    border: 2px solid var(--border-primary);
    border-radius: 16px;
    height: 48px;
    min-width: 184px;
    display: flex;
    align-items: center;
    padding-inline: 12px 8px;
    gap: 16px;
    transition: var(--transition-bg-color), var(--transition-bd-color);

    &:has(> input:focus) {
      border-color: var(--border-action);
      box-shadow: var(--shadow-strong);
    }

    & > .tabler-icon {
      flex-shrink: 0;
    }

    & > input {
      flex: 1;
      background-color: var(--surface-page);
      border: none;
      padding-inline: 16px;
      margin: 0;
      font: inherit;
      color: inherit;
      outline: none;
      width: 100%;
      height: 100%;
    }

    &:hover {
      cursor: text;
    }

    &.compact {
      height: 36px;
      border-radius: 8px;
      padding-inline: 6px 8px;

      & > .tabler-icon {
        width: 20px;
        height: 20px;
      }
    }
  }

  .tabler-icon {
    height: 100%;
  }

  .hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    font-weight: var(--weight-medium);
    color: var(--blue-900);
    text-align: center;
  }

  .match-buttons {
    display: flex;
    flex-direction: row;
    align-items: center;

    & svg {
      margin-inline: 0;
    }
  }

  .extra-buttons {
    & :deep(svg) {
      color: var(--dark);
    }
    /* & :deep(> button) {
       padding: 0 !important;
       height: fit-content;
       } */
  }
</style>
