<script setup>
  /**
   * FilesItem - Interactive file item component for displaying research manuscripts
   *
   * Renders an individual RSM manuscript as a list row with interactive features
   * including hover states, keyboard navigation, file menu actions, and visual
   * feedback for selection and focus states.
   *
   * @displayName FilesItem
   * @example
   * <FilesItem v-model="fileObject" />
   */

  import { ref, inject, provide, watch, useTemplateRef, computed } from "vue";
  import { useRouter } from "vue-router";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import { File } from "@/models/File.js";
  import { downloadBlob } from "@/utils/download.js";
  import Date from "./FilesItemDate.vue";
  import FilesItemCollaborators from "./FilesItemCollaborators.vue";
  import FilesItemRole from "./FilesItemRole.vue";
  import ConfirmationModal from "@/components/ConfirmationModal.vue";
  import ScrollbarMinimap from "@/views/workspace/ScrollbarMinimap.vue";

  const file = defineModel({ type: Object, required: true });
  const api = inject("api");
  const user = inject("user");

  /**
   * File object containing manuscript data and state (already defined above)
   * @example { id: "123", title: "Paper", selected: false, focused: false, tags: [] }
   */
  const fileStore = inject("fileStore");
  const xsMode = inject("xsMode");
  const mobileMode = inject("mobileMode");

  // Minimap: provide annotations/reactions so ScrollbarMinimap can render marks.
  // Data comes from file store (no per-item API calls).
  const manuscriptRef = useTemplateRef("manuscript-ref");
  const fileAnnotations = computed(() => file.value?.annotations || []);
  const fileReactions = computed(() => file.value?.reactions || []);
  provide("manuscriptRef", manuscriptRef);
  provide("annotations", fileAnnotations);
  provide("reactions", fileReactions);

  // State
  const hovered = ref(false);
  const router = useRouter();
  const showDeleteModal = ref(false);

  // Breakpoints
  const shouldShowColumn = inject("shouldShowColumn");

  // File menu callbacks
  const open = () => File.openFile(file.value, router);
  const menuRef = useTemplateRef("menu-ref");
  const fileTitleRef = useTemplateRef("file-title-ref");
  const onRename = () => fileTitleRef.value?.startEditing();
  const onDuplicate = () => {
    const fileData = {
      ...File.toJSON(file.value),
      id: null,
      owner_id: user.value.id,
      title: file.value.title + " (Copy)",
    };
    fileStore.value.createFile(fileData);
  };
  const onDelete = () => {
    if (!file.value) return;
    showDeleteModal.value = true;
  };
  const onDownload = async () => {
    if (!file.value?.id) return;

    try {
      const title = file.value.title || "manuscript";
      const filename = title.replace(/[<>:"/\\|?*]/g, "_") + ".html";

      // Use axios to fetch with authentication headers
      const response = await api.get(`/files/${file.value.id}/download`, {
        responseType: "blob",
      });

      // Create blob and download using utility
      const blob = new Blob([response.data], { type: "text/html" });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error("Download failed:", error);
      // Could add user notification here if needed
    }
  };

  const onDownloadPdf = async () => {
    if (!file.value?.id) return;

    try {
      const title = file.value.title || "manuscript";
      const filename = title.replace(/[<>:"/\\|?*]/g, "_") + ".pdf";

      const response = await api.get(`/files/${file.value.id}/download/pdf`, {
        responseType: "blob",
        timeout: 120000,
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error("PDF download failed:", error);
    }
  };

  // Confirmation modal handlers
  const handleDeleteConfirm = async () => {
    if (!showDeleteModal.value) return; // race condition protection

    try {
      const success = await fileStore.value.deleteFile(file.value);
      if (success) showDeleteModal.value = false;
    } catch (error) {
      // Keep modal open on error
      console.error("Failed to delete file:", error);
    }
  };
  const handleDeleteClose = () => (showDeleteModal.value = false);

  // Generate confirmation message with file name
  const deleteMessage = computed(() => {
    const fileName = file.value?.title || "this file";
    return `Are you sure you want to delete "${fileName}"? This action cannot be undone.`;
  });

  // Keyboard shortcuts - activated when file is focused
  const { activate, deactivate } = useKeyboardShortcuts(
    {
      ".": { fn: () => menuRef.value?.toggle(), description: "open file menu" },
      enter: open,
      " ": { fn: open, description: "open file" },
    },
    false,
    "When a file item is selected"
  );

  // When keyboard nav is active (some file is focused), only the focused file
  // gets the current highlight. Otherwise fall back to the selected file.
  const keyboardNavActive = computed(
    () => fileStore?.value?.files?.some((f) => f.focused) ?? false
  );
  const isCurrent = computed(() => {
    if (file.value?.focused) return true;
    if (keyboardNavActive.value) return false;
    return !!file.value?.selected;
  });

  // When keyboard nav activates, clear any lingering hover highlight
  watch(keyboardNavActive, (active) => {
    if (active) hovered.value = false;
  });

  // Watch file focus state to enable/disable keyboard shortcuts
  watch(
    () => file.value?.focused,
    (newVal) => (newVal ? activate() : deactivate())
  );
</script>

<template>
  <!--
    Main file item container with interactive states and accessibility support.
    Supports both list and card display modes with hover, focus, and selection states.

    @example
    // The component automatically applies appropriate CSS classes based on props and state:
    // - .list or .cards based on mode prop
    // - .current when file is focused or selected
    // - .hovered during mouse hover
  -->
  <div
    class="item"
    role="option"
    tabindex="0"
    :aria-selected="isCurrent"
    :data-testid="`file-item-${file?.id || 'unknown'}`"
    :class="{
      current: isCurrent,
      hovered: hovered,
      mobile: mobileMode,
    }"
    @mouseenter="hovered = !keyboardNavActive"
    @mouseleave="hovered = false"
    @click="open"
  >
    <!-- Hidden manuscript for minimap DOM measurement -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="file?.html" ref="manuscript-ref" class="minimap-source" v-html="file.html" />

    <template v-if="!!file">
      <div class="title-cell" :class="{ unseen: file.unseen }">
        <FileTitle ref="file-title-ref" :file="file" />
        <FilesItemRole :role="file.role" />
      </div>

      <template v-if="!xsMode">
        <div class="minimap-cell">
          <ScrollbarMinimap :file="file" mode="compact" orientation="horizontal" />
        </div>
        <TagRow :file="file" />
        <div class="spacer"></div>
        <FilesItemCollaborators :file="file" />
      </template>

      <!-- File modification date -->
      <Date :file="file" />

      <!--
          File action menu (hidden when file is selected to prevent interference with selection UI)
          Emits rename, duplicate, and delete events handled by parent callbacks
        -->
      <FileMenu
        ref="menu-ref"
        @rename="onRename"
        @duplicate="onDuplicate"
        @delete="onDelete"
        @download="onDownload"
        @download-pdf="onDownloadPdf"
      />

      <!-- Grid layout spacer to complete the row -->
      <span class="spacer"></span>
    </template>

    <!-- Delete confirmation modal -->
    <ConfirmationModal
      :show="showDeleteModal"
      title="Delete File?"
      :message="deleteMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      :file-data="file"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteClose"
      @close="handleDeleteClose"
    />
  </div>
</template>

<style scoped>
  .minimap-source {
    position: absolute;
    visibility: hidden;
    width: 300px;
    height: auto;
    overflow: hidden;
    pointer-events: none;
    pointer-events: none;
    z-index: -1;
  }

  .item {
    --border-width: var(--border-extrathin);
    position: relative;

    color: var(--extra-dark);
    overflow-y: visible;
    transition: var(--transition-bg-color);
    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: var(--border-med) solid var(--border-action);
      outline-offset: var(--border-extrathin);
    }
  }

  .item {
    & > *:not(.minimap-source) {
      height: 56px;
      padding-right: 8px;
      transition: background 0.15s ease-in-out;
      border-top: var(--border-width) solid transparent;
      border-bottom: var(--border-width) solid transparent;
      border-bottom-color: var(--border-primary);
      overflow-y: hidden;
    }

    &.hovered:not(.current) > * {
      background-color: var(--gray-75);
    }

    &.current > * {
      background-color: var(--gray-100);
    }

    & > *:first-child {
      padding-left: calc(16px - var(--border-med));
    }

    & > .dots {
      padding-inline: 0px;
    }

    & .title-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      position: relative;
    }

    & .title-cell.unseen::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--blue-400);
      flex-shrink: 0;
      transition: opacity 0.3s ease;
    }

    & .file-title {
      border-left: var(--border-med) solid transparent;
    }

    & .minimap-cell {
      display: flex;
      align-items: center;
      padding-left: 4px;
      padding-right: 12px;
      overflow: visible;
    }

    & .minimap-cell :deep(.scrollbar-minimap.compact.horizontal) {
      width: calc(100% + 24px);
      margin-left: 12px;
      height: 16px;
      border-radius: var(--radius-sm);
      background: var(--gray-100);
      border: 1px solid var(--gray-200);
      transition:
        background 0.2s ease,
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    &:is(.hovered, .current) .minimap-cell :deep(.scrollbar-minimap.compact.horizontal) {
      background: linear-gradient(
        135deg,
        var(--blue-50),
        color-mix(in srgb, var(--blue-100) 60%, var(--gray-100))
      );
      border-color: color-mix(in srgb, var(--blue-300) 50%, var(--gray-300));
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--blue-200) 40%, transparent),
        0 1px 3px color-mix(in srgb, var(--blue-200) 30%, transparent);
    }

    &:is(.hovered, .current) .minimap-cell :deep(.mm-section::after) {
      background-color: var(--blue-400);
    }

    &:is(.hovered, .current) .minimap-cell :deep(.mm-section.level-1::after) {
      background-color: var(--blue-500);
    }

    &:is(.hovered, .current) .minimap-cell :deep(.mm-annotation) {
      color: var(--blue-400);
    }
  }

  .item :deep(.context-menu-trigger) {
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  :is(.item:hover, .item.current, .item.hovered) :deep(.context-menu-trigger),
  .item.mobile :deep(.context-menu-trigger) {
    opacity: 1;
  }

  .item :deep(.context-menu-trigger:has(> .active)),
  .item :deep(.context-menu-trigger.active) {
    opacity: 1;
  }

  /* MultiSelectTags icon color behavior - dark on hover, current, or when menu is open */
  :is(.item:hover, .item.current, .item.hovered) :deep(.cm-btn svg),
  :deep(.cm-open .cm-btn svg) {
    color: var(--extra-dark);
  }
</style>
