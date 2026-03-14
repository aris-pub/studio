<script setup>
  import { ref, inject, computed, watchEffect, onMounted, onUnmounted } from "vue";
  import { useRouter } from "vue-router";
  import { File } from "@/models/File.js";
  import FilesPane from "./FilesPane.vue";

  const fileStore = inject("fileStore");
  const router = useRouter();

  const refreshFiles = () => {
    if (!fileStore.value) return;
    fileStore.value.loadFiles();
    fileStore.value.loadTags();
  };

  // Load on first visit
  watchEffect(() => {
    if (fileStore.value && !fileStore.value.filesLoaded?.value) {
      refreshFiles();
    }
  });

  // Refresh when tab becomes visible again (e.g. user returns after receiving a share invitation)
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && fileStore.value?.filesLoaded?.value) {
      refreshFiles();
    }
  };

  onMounted(() => {
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Refresh on every navigation to home (not just first load)
    if (fileStore.value?.filesLoaded?.value) {
      refreshFiles();
    }
  });

  onUnmounted(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
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
    border-radius: var(--radius-lg);
  }
</style>
