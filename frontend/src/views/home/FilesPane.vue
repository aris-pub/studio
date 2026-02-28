<script setup>
  import { ref, computed, inject, provide, watch, useTemplateRef } from "vue";
  import { useListKeyboardNavigation } from "@/composables/useListKeyboardNavigation.js";
  import Topbar from "./FilesTopbar.vue";
  import FilesHeader from "./FilesHeader.vue";
  import FilesItem from "./FilesItem.vue";
  import LoadingSpinner from "@/components/base/LoadingSpinner.vue";

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
      : "minmax(144px, 2fr) minmax(96px, 1.5fr) 8px 108px 104px 16px 8px";
  });
  const shouldShowColumn = (columnName, mode) => {
    if (["Spacer", "Tags", "Collaborators"].includes(columnName) && xsMode.value)
      return false;
    return true;
  };
  provide("shouldShowColumn", shouldShowColumn);

  // Mode: list or cards
  const mode = ref("list");
</script>

<template>
  <Pane :custom-header="true">
    <template #header>
      <Topbar @list="mode = 'list'" @cards="mode = 'cards'" />
    </template>

    <div class="files-wrapper" :class="mode">
      <FilesHeader :mode="mode" />

      <Suspense>
        <div
          v-if="visibleFiles"
          ref="files-ref"
          data-testid="files-container"
          class="files"
          :class="mode"
        >
          <template v-for="(file, idx) in visibleFiles" :key="file.id">
            <FilesItem v-model="visibleFiles[idx]" :mode="mode" />
          </template>
        </div>

        <template #fallback>
          <LoadingSpinner message="Loading files..." />
        </template>
      </Suspense>
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

  .files.list {
    flex: 1;
  }

  .pane-header.list,
  .files.list {
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .pane-header.list,
  .files.list > .item {
    display: grid;
    /* grid-template-columns: minmax(144px, 2fr) minmax(48px, 1.25fr) 8px 104px 16px 8px; */
    grid-template-columns: v-bind("gridTemplateColumns");
  }

  .pane-header.list > *,
  .files.list .item > * {
    overflow-x: auto;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
  }

  .pane-header.list > *:first-child,
  .files.list .item > *:first-child {
  }

  .pane-header.list > *:last-child,
  .files.list .item > *:last-child {
    padding-right: 8px;
  }

  .pane :deep(.content) {
    padding-block: v-bind(panePadding) !important;
  }

  .files-wrapper.cards {
  }

  .files.cards {
    padding-top: 16px;
    overflow-y: auto;
    columns: auto 250px;
    column-gap: 16px;

    & > .cards {
      break-inside: avoid;
    }
  }

  .tags {
    display: flex;
    gap: 8px;
  }
</style>
