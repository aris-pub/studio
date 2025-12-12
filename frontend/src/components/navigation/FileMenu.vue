<script setup>
  import { computed, useTemplateRef } from "vue";
  import ContextMenu from "./ContextMenu.vue";

  /**
   * FileMenu - Adaptive file operations menu
   *
   * A dual-mode menu component that provides file operations (share, download, rename,
   * duplicate, delete) in either a dropdown context menu or horizontal button row layout.
   * Automatically adapts child component props based on the selected mode.
   *
   * Features:
   * - Dual display modes: ContextMenu (dropdown) or ButtonRow (horizontal)
   * - File operations: Share, Download, Rename, Duplicate, Delete
   * - Visual danger styling for destructive actions (Delete)
   * - Programmatic toggle control via exposed methods
   * - Automatic prop adaptation for different modes
   *
   * @displayName FileMenu
   * @example
   * // Context menu mode (default)
   * <FileMenu
   *   @rename="handleRename"
   *   @duplicate="handleDuplicate"
   *   @delete="handleDelete"
   * />
   *
   * @example
   * // Button row mode
   * <FileMenu
   *   mode="ButtonRow"
   *   @rename="handleRename"
   *   @duplicate="handleDuplicate"
   *   @delete="handleDelete"
   * />
   *
   * @example
   * // Programmatic control
   * <FileMenu ref="fileMenuRef" />
   * // fileMenuRef.value.toggle()
   */

  defineOptions({
    name: "FileMenu",
  });

  const props = defineProps({
    /**
     * Icon for the menu trigger (when in ContextMenu mode)
     * @values "Dots", "Menu", "MoreHorizontal"
     */
    icon: { type: String, default: "Dots" },
    /**
     * Display mode for the menu
     * @values "ContextMenu", "ButtonRow"
     */
    mode: { type: String, default: "ContextMenu" },
  });

  /**
   * Events emitted by the component
   * @event rename - Emitted when rename action is clicked
   * @event duplicate - Emitted when duplicate action is clicked
   * @event delete - Emitted when delete action is clicked
   * @event download - Emitted when download action is clicked
   */
  const emit_ = defineEmits(["rename", "duplicate", "delete", "download"]);
  const emit = (event) => {
    // Only try to toggle if the ref is available and has the toggle method
    if (menuRef.value && typeof menuRef.value.toggle === "function") {
      menuRef.value.toggle();
    }
    emit_(event);
  };

  const comp = computed(() => (props.mode === "ContextMenu" ? "ContextMenuItem" : "Button"));
  const menuComponent = computed(() => (props.mode === "ContextMenu" ? ContextMenu : "div"));
  const childProps = (icon, caption) => {
    if (props.mode === "ContextMenu") return { icon: icon, caption: caption };
    else if (props.mode === "ButtonRow")
      return { icon: icon, caption: caption, kind: "tertiary", size: "sm", textFloat: "bottom" };
  };

  const menuRef = useTemplateRef("menu-ref");

  /**
   * Exposes methods for parent components
   * @expose {Function} toggle - Toggle the menu open/closed state (ContextMenu mode only)
   */
  defineExpose({ toggle: () => menuRef.value?.toggle() });
</script>

<template>
  <div class="fm-wrapper" data-testid="file-menu" :class="mode">
    <component :is="menuComponent" ref="menu-ref" variant="dots">
      <component
        :is="comp"
        v-bind="childProps('Share3', 'Share')"
        data-testid="file-menu-share"
        @click.stop
      />
      <component
        :is="comp"
        v-bind="childProps('Download', 'Download')"
        data-testid="file-menu-download"
        @click.stop="emit('download')"
      />
      <Separator />
      <component
        :is="comp"
        v-bind="childProps('Edit', 'Rename')"
        data-testid="file-menu-rename"
        @click.stop="emit('rename')"
      />
      <component
        :is="comp"
        v-bind="childProps('Copy', 'Duplicate')"
        data-testid="file-menu-duplicate"
        @click.stop="emit('duplicate')"
      />
      <component
        :is="comp"
        v-bind="childProps('TrashX', 'Delete')"
        class="danger"
        data-testid="file-menu-delete"
        @click.stop="emit('delete')"
      />
    </component>
  </div>
</template>

<style scoped>
  .fm-wrapper {
    width: fit-content;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fm-wrapper.ButtonRow {
    height: 32px;
  }

  :deep(.danger) {
    color: var(--text-error);
  }
  :deep(.danger:hover) {
    background-color: var(--surface-error) !important;
    color: var(--text-error);
    border-color: var(--surface-error) !important;
  }
  :deep(.danger) .tabler-icon {
    color: var(--icon-error);
  }
  :deep(.danger:hover) .tabler-icon {
    color: var(--icon-error);
  }
</style>
