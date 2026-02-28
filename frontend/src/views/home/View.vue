<script setup>
  import { ref, inject, computed, watchEffect } from "vue";
  import { useRouter } from "vue-router";
  import { File } from "@/models/File.js";
  import FilesPane from "./FilesPane.vue";

  const fileStore = inject("fileStore");
  const router = useRouter();

  // Trigger file/tag loading when navigating to home via SPA (store exists but not yet loaded)
  watchEffect(() => {
    if (fileStore.value && !fileStore.value.filesLoaded?.value) {
      fileStore.value.loadFiles();
      fileStore.value.loadTags();
    }
  });

  // Recent files as context sub-items for Home
  const recentFiles = ref(["", "", ""]);
  watchEffect(() => {
    recentFiles.value = fileStore.value?.getRecentFiles(3) || ["", "", ""];
  });

  const contextSubItems = computed(() => {
    const items = [];

    recentFiles.value.forEach((file, idx) => {
      if (file) {
        items.push({
          icon: "File",
          text: file.title || "Untitled",
          tooltip: `Open "${file.title}"`,
          tooltipAlways: true,
          active: false, // TODO: Could check if current workspace file matches
          onClick: () => File.openFile(file, router),
        });
      }
    });

    return items;
  });
</script>

<template>
  <BaseLayout :context-sub-items="contextSubItems">
    <div class="panes">
      <FilesPane :style="{ height: '100%' }" />
    </div>
  </BaseLayout>
</template>

<style scoped>
  .panes {
    position: relative;
    flex-grow: 1;
    height: 100%;
    border-radius: 16px;
  }
</style>
