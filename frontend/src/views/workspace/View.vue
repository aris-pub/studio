<script setup>
  import { ref, computed, inject, provide, onMounted, watch, watchEffect } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { useLocalStorage } from "@vueuse/core";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import { useAnnotations } from "@/composables/useAnnotations.js";
  import { File } from "@/models/File.js";
  import Sidebar from "./Sidebar.vue";
  import Canvas from "./Canvas.vue";
  import Icon from "@/components/base/Icon.vue";

  // Load and provide file
  const fileStore = inject("fileStore");
  const api = inject("api");
  const route = useRoute();

  // Computed properties for different states
  const isFileStoreLoading = computed(() => {
    // If fileStore itself is null, we're still loading
    return fileStore?.value === null || fileStore?.value?.isLoading === true;
  });

  const hasFileStoreError = computed(() => {
    return fileStore?.value?.error !== undefined;
  });

  const isFileStoreLoaded = computed(() => {
    // FileStore is loaded when it exists, has a files array, and is not loading
    return (
      fileStore?.value !== null &&
      fileStore?.value !== undefined &&
      Array.isArray(fileStore.value.files) &&
      !isFileStoreLoading.value
    );
  });

  // Directly fetched file — used when fileStore.files is empty (e.g. hard refresh on workspace
  // route, where the home-route bulk-load hasn't run).
  const directFile = ref(null);
  const directFileError = ref(false);

  watchEffect(async () => {
    const routeFileId = parseInt(route?.params?.file_id);
    if (isNaN(routeFileId) || !fileStore?.value) return;

    // Only fetch directly when the store doesn't have any files loaded yet
    if (fileStore.value.filesLoaded?.value) return;
    if (directFile.value?.id === routeFileId) return;

    try {
      const response = await api.get(`/files/${routeFileId}`);
      directFile.value = new File(
        { ...response.data, ownerId: response.data.owner_id },
        fileStore.value
      );
    } catch {
      directFileError.value = true;
    }
  });

  const file = computed(() => {
    const files = fileStore?.value?.files;
    const fileId = parseInt(route?.params?.file_id);

    // Return empty object if we don't have the necessary data yet
    if (isNaN(fileId)) return {};

    // Prefer file from store (has full metadata including tags, selection state)
    if (Object.values(files ?? {}).length > 0) {
      const found = Object.values(files).find((f) => f.id === fileId);
      if (found) return found;
    }

    // Fall back to directly fetched file for workspace-only navigation
    return directFile.value?.id === fileId ? directFile.value : {};
  });
  provide("file", file);

  const fileId = computed(() => file.value?.id);
  const {
    annotations,
    loading: annotationsLoading,
    fetchAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addNote,
    updateNote,
    deleteNote,
  } = useAnnotations(fileId, api);

  const activeAnnotationId = ref(null);

  const annotationActions = {
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addNote,
    updateNote,
    deleteNote,
  };

  provide("annotations", annotations);
  provide("annotationActions", annotationActions);
  provide("activeAnnotationId", activeAnnotationId);

  watch(fileId, (id) => {
    if (id) fetchAnnotations();
  }, { immediate: true });

  // Only redirect to 404 when fileStore is loaded but file is not found
  const router = useRouter();
  watch(
    [() => file.value.id, isFileStoreLoaded, hasFileStoreError, isFileStoreLoading],
    ([fileId, isLoaded, hasError, isLoading]) => {
      const routeFileId = route.params.file_id;

      // Only redirect if:
      // 1. We have a route file_id to look for
      // 2. FileStore is loaded (not loading)
      // 3. No API error occurred
      // 4. Not currently loading
      // 5. FileStore has at least some files (not empty due to API failure)
      // 6. File with that ID was not found
      const hasFiles = Object.values(fileStore?.value?.files ?? {}).length > 0;
      if (routeFileId && isLoaded && !hasError && !isLoading && hasFiles && fileId === undefined) {
        router.push({ name: "NotFound" });
      }
    },
    { immediate: true }
  );

  const fileSettings = ref({});
  onMounted(async () => {
    const fromDb = await File.getSettings(file.value, api);
    Object.assign(fileSettings.value, fromDb);
  });
  provide("fileSettings", fileSettings);

  // Panel component management (persisted across refresh)
  const showEditor = useLocalStorage("ws-panel-editor", false);
  const showSearch = useLocalStorage("ws-panel-search", false);
  provide("showEditor", showEditor);
  provide("showSearch", showSearch);

  const showComponent = (compName) => {
    if (compName === "DockableEditor") {
      showEditor.value = true;
      return;
    } else if (compName === "DockableSearch") {
      showSearch.value = true;
      return;
    }
  };
  const hideComponent = (compName) => {
    if (compName === "DockableEditor") {
      showEditor.value = false;
      return;
    } else if (compName === "DockableSearch") {
      showSearch.value = false;
      return;
    }
  };

  // Sidebar drawer
  const drawerOpen = ref(false);
  provide("drawerOpen", drawerOpen);
  const sidebarWidth = computed(() => (drawerOpen.value ? "364px" : "64px"));

  // Focus Mode (persisted across refresh)
  const focusMode = useLocalStorage("ws-panel-focus", false);
  provide("focusMode", focusMode);

  // Responsiveness
  const mobileMode = inject("mobileMode");

  // Keyboard shortcuts
  const goHome = () => router.push("/");
  useKeyboardShortcuts({
    "g,h": goHome,
    c: () => (focusMode.value = !focusMode.value),
  });
</script>

<template>
  <div
    class="view"
    data-testid="workspace-container"
    :class="{ focus: focusMode, mobile: mobileMode }"
  >
    <Sidebar
      :initial-panel-state="{ DockableEditor: showEditor, DockableSearch: showSearch }"
      @show-component="showComponent"
      @hide-component="hideComponent"
    />

    <!-- Loading state -->
    <div v-if="isFileStoreLoading" class="state-message">
      <p>Loading files...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="hasFileStoreError" class="state-message error">
      <p>Error loading files: {{ fileStore.value.error }}</p>
      <Button kind="secondary" @click="$router.push('/')">Go back home</Button>
    </div>

    <!-- Normal state -->
    <Canvas
      v-else-if="file && file.id"
      v-model="file"
      data-testid="workspace-canvas"
      :show-editor="showEditor"
      :show-search="showSearch"
    />

    <!-- No file found state (after files loaded but target file not found) -->
    <div v-else-if="isFileStoreLoaded" class="state-message">
      <p>File not found</p>
      <p>The file you're looking for doesn't exist or you don't have access to it.</p>
      <Button kind="secondary" @click="$router.push('/')">Go back home</Button>
    </div>

    <!-- Focus mode exit button - positioned outside sidebar to avoid transform issues -->
    <Transition name="focus-button" appear>
      <Button
        v-show="focusMode"
        class="focus-mode-exit-button"
        kind="tertiary"
        icon="Layout"
        @click="focusMode = false"
      />
    </Transition>

    <!-- <div class="menus" :class="{ focus: focusMode, mobile: mobileMode }">
         <Button v-if="mobileMode" kind="tertiary" icon="Home" @click="goHome" />
         <UserMenu />
         </div> -->
  </div>
</template>

<style scoped>
  .view {
    --transition-duration: 0.3s;
    --sidebar-width: v-bind(sidebarWidth);

    display: flex;
    width: 100%;
    padding: 8px 8px 8px 0;
    will-change: padding;
    transition: padding var(--transition-duration) ease;
    position: relative;
    overflow-x: hidden;
  }

  .view.mobile {
    padding: 0;
  }

  .view.focus {
    padding: 0;
  }

  .outer {
    width: calc(100% - 64px);
    position: relative;
    left: var(--sidebar-width);
  }

  .view.mobile > .outer {
    width: 100%;
    left: 0;
  }

  .menus {
    position: absolute;
    bottom: 0px;
    left: 0px;
    height: 64px;
    display: flex;
    align-items: center;
    z-index: 2;
    padding: 8px;
    gap: 8px;
    background-color: transparent;

    opacity: 1;
    transform: translateX(0);
    will-change: opacity, transform;
    transition:
      opacity var(--transition-duration) ease,
      transform var(--transition-duration) ease;
  }

  .view.mobile > .menus {
    display: none;
  }

  .menus.focus {
    opacity: 0;
    transform: translateX(100%);
  }

  .state-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: calc(100% - 64px);
    text-align: center;
    padding: 32px;
    gap: 16px;
    position: relative;
    left: 64px;
    background: v-bind(fileSettings.background);
    border-radius: 16px;
  }

  .state-message.error {
    color: var(--error);
  }

  .focus-mode-exit-button {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 9999;
  }

  .focus-button-enter-active {
    transition: all 0.3s ease-out;
  }

  .focus-button-leave-active {
    transition: all 0.3s ease-in;
  }

  .focus-button-enter-from {
    transform: translateX(-60px);
    opacity: 0;
  }

  .focus-button-leave-to {
    transform: translateX(-60px);
    opacity: 0;
  }
</style>
