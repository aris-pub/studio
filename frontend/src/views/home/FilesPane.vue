<script setup>
  import { computed, inject, provide, watch, useTemplateRef } from "vue";
  import { useListKeyboardNavigation } from "@/composables/useListKeyboardNavigation.js";
  import Topbar from "./FilesTopbar.vue";
  import FilesHeader from "./FilesHeader.vue";
  import FilesItem from "./FilesItem.vue";

  const props = defineProps({});
  const fileStore = inject("fileStore");
  const newEmptyFile = inject("newEmptyFile", () => {});
  const showFileUploadModal = inject("showFileUploadModal", () => {});

  // Topbar ref for accessing ownership filter state
  const topbarRef = useTemplateRef("topbar-ref");

  const hasZeroFiles = computed(() => {
    const store = fileStore.value;
    if (!store) return false;
    const loaded = store.filesLoaded?.value ?? store.filesLoaded;
    return loaded && Array.isArray(store.files) && store.files.length === 0;
  });

  // Selected file
  const filesRef = useTemplateRef("files-ref");
  const visibleFiles = computed(
    () => fileStore.value?.files?.filter((file) => !file.filtered) ?? []
  );
  const numFiles = computed(() => visibleFiles.value.length);
  const { activeIndex } = useListKeyboardNavigation(numFiles, filesRef, true);
  watch(activeIndex, (newVal) => {
    if (!fileStore?.value?.files) return;
    const currentFocused = fileStore.value.files.filter((d) => d.focused);
    currentFocused.forEach((d) => (d.focused = false));
    if (newVal === null) return;
    if (visibleFiles.value[newVal]) visibleFiles.value[newVal].focused = true;
  });

  // Sync activeIndex when a file is clicked so j/k starts from that file
  watch(
    () => visibleFiles.value.findIndex((f) => f.selected),
    (idx) => {
      if (idx >= 0) activeIndex.value = idx;
    }
  );

  // Empty state for "Shared with me"
  const showSharedEmptyState = computed(() => {
    return visibleFiles.value.length === 0 && topbarRef.value?.activeSegment === 2;
  });

  // Breakpoints
  const xsMode = inject("xsMode");
  const panePadding = computed(() => (xsMode.value ? "8px" : "16px"));
  const gridTemplateColumns = computed(() => {
    return xsMode.value
      ? "minmax(144px, 2fr) 104px 16px 8px"
      : "minmax(144px, 2fr) minmax(80px, 1.5fr) minmax(200px, 1fr) 16px 120px 104px 16px 8px";
  });
  const shouldShowColumn = (columnName) => {
    if (["Spacer", "Tags", "Collaborators", "Structure"].includes(columnName) && xsMode.value)
      return false;
    return true;
  };
  provide("shouldShowColumn", shouldShowColumn);
</script>

<template>
  <Pane :custom-header="true">
    <template #header>
      <Topbar ref="topbar-ref" />
    </template>

    <div class="files-wrapper">
      <template v-if="hasZeroFiles">
        <div class="empty-state" data-testid="empty-state">
          <Icon name="Files" class="empty-state-icon" />
          <p class="empty-state-title">No files yet</p>
          <p class="empty-state-subtitle">
            Create a new file or upload an existing document to get started.
          </p>
          <div class="empty-state-actions">
            <button
              class="empty-state-btn primary"
              data-testid="empty-state-create"
              @click="newEmptyFile"
            >
              <Icon name="FilePlus" />
              Create file
            </button>
            <button
              class="empty-state-btn"
              data-testid="empty-state-upload"
              @click="showFileUploadModal"
            >
              <Icon name="Upload" />
              Upload
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <FilesHeader />

        <div
          v-if="visibleFiles.length > 0"
          ref="files-ref"
          data-testid="files-container"
          class="files"
          role="listbox"
          aria-label="Files"
        >
          <template v-for="(file, idx) in visibleFiles" :key="file.id">
            <FilesItem v-model="visibleFiles[idx]" />
          </template>
        </div>

        <div v-else-if="showSharedEmptyState" class="empty-state" data-testid="shared-empty-state">
          <Icon name="UsersGroup" class="empty-state-icon" />
          <p class="empty-state-title text-default">No shared files yet</p>
          <p class="empty-state-description text-subtle">
            Files shared with you by collaborators will appear here.
          </p>
        </div>
      </template>
    </div>
  </Pane>
</template>

<style scoped>
  .files-wrapper {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    width: 100%;
    height: 100%;
  }

  .files {
    flex: 1;
  }

  .pane-header,
  .files {
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .pane-header,
  .files > .item {
    display: grid;
    grid-template-columns: v-bind("gridTemplateColumns");
  }

  .pane-header > *,
  .files .item > * {
    overflow-x: auto;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
  }

  .pane-header > *:last-child,
  .files .item > *:last-child {
    padding-right: 8px;
  }

  .pane :deep(.content) {
    padding-block: v-bind(panePadding) !important;
  }

  .tags {
    display: flex;
    gap: 8px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    padding: 48px 24px;
    text-align: center;
  }

  .empty-state-icon {
    width: 48px;
    height: 48px;
    color: var(--text-subtle);
    margin-bottom: 8px;
  }

  .empty-state-title {
    font-size: var(--h4-size);
    font-weight: var(--weight-semi);
    color: var(--text-body);
    margin: 0;
  }

  .empty-state-subtitle {
    color: var(--text-subtle);
    margin: 0 0 16px;
    max-width: 320px;
  }

  .empty-state-actions {
    display: flex;
    gap: 12px;
  }

  .empty-state-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    border: var(--border-extrathin) solid var(--border-primary);
    background: var(--surface-primary);
    color: var(--text-body);
    font-size: var(--font-size);
    cursor: pointer;
    transition: var(--transition-bg-color), var(--transition-bd-color);
  }

  .empty-state-btn:hover {
    background: var(--surface-hover);
  }

  .empty-state-btn.primary {
    background: var(--surface-action);
    color: var(--white);
    border-color: var(--surface-action);
  }

  .empty-state-btn.primary:hover {
    background: var(--surface-action-hover, var(--blue-700));
  }

  .empty-state-btn :deep(.tabler-icon) {
    width: 18px;
    height: 18px;
  }

  .empty-state-description {
    color: var(--text-subtle);
    margin: 0;
  }
</style>
