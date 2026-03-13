<script setup>
  import { computed, inject, provide, watch, useTemplateRef } from "vue";
  import { useListKeyboardNavigation } from "@/composables/useListKeyboardNavigation.js";
  import Topbar from "./FilesTopbar.vue";
  import FilesHeader from "./FilesHeader.vue";
  import FilesItem from "./FilesItem.vue";

  const props = defineProps({});
  const fileStore = inject("fileStore");

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

  // Breakpoints
  const xsMode = inject("xsMode");
  const panePadding = computed(() => (xsMode.value ? "8px" : "16px"));
  const gridTemplateColumns = computed(() => {
    return xsMode.value
      ? "minmax(144px, 2fr) 104px 16px 8px"
      : "minmax(144px, 2fr) minmax(80px, 1.5fr) minmax(200px, 1fr) 16px 120px 104px 16px 8px";
  });
  const shouldShowColumn = (columnName) => {
    if (["Spacer", "Tags", "Collaborators", "Structure"].includes(columnName) && xsMode.value) return false;
    return true;
  };
  provide("shouldShowColumn", shouldShowColumn);
</script>

<template>
  <Pane :custom-header="true">
    <template #header>
      <Topbar />
    </template>

    <div class="files-wrapper">
      <FilesHeader />

      <div
        v-if="visibleFiles"
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
</style>
