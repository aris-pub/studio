<script setup>
  import { ref, reactive, computed, provide, onMounted, inject } from "vue";
  import { useRoute } from "vue-router";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import { demoFile, demoUser, demoFileStore, demoAnnotations, createDemoApi } from "./demoData.js";
  import { File } from "@/models/File.js";
  import Sidebar from "@/views/workspace/Sidebar.vue";
  import Canvas from "@/views/workspace/Canvas.vue";
  import Icon from "@/components/base/Icon.vue";

  // Create demo API instance
  const api = createDemoApi();
  provide("api", api);

  // Use ONLY injected values from App.vue (single source of truth)
  const breakpoints = inject("breakpoints");
  const xsMode = inject("xsMode");
  const mobileMode = inject("mobileMode");

  // Provide the injected values to child components
  provide("breakpoints", breakpoints);
  provide("xsMode", xsMode);

  // Demo user and file store
  const user = ref(demoUser);
  const fileStore = ref(demoFileStore);
  provide("user", user);
  provide("fileStore", fileStore);

  // Create reactive demo file
  const demoFileReactive = new File(demoFile);
  const file = computed(() => demoFileReactive);
  provide("file", file);

  // Track demo initialization state
  const isContentLoaded = ref(false);

  // Demo annotations
  const annotations = reactive(demoAnnotations);
  provide("annotations", annotations);

  // Demo file settings
  const fileSettings = ref(demoFile._settings);
  provide("fileSettings", fileSettings);

  // Panel component management
  const showEditor = ref(false);
  const showSearch = ref(false);
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
  const sidebarWidth = computed(() => (drawerOpen.value ? "360px" : "64px"));

  // Focus Mode
  const focusMode = ref(false);
  provide("focusMode", focusMode);

  // Initialize demo content
  onMounted(() => {
    // Let Canvas.vue handle content loading with structured format for tooltip support
    isContentLoaded.value = true;
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    c: () => (focusMode.value = !focusMode.value),
  });

  // Main sidebar collapsed state
  const sidebarIsCollapsed = ref(false);
  provide("sidebarIsCollapsed", sidebarIsCollapsed);

  // Development mode
  const isDev = ref(false);
  provide("isDev", isDev);
</script>

<template>
  <div class="demo-root">
    <!-- Demo banner -->
    <div v-if="!focusMode" class="demo-banner" data-testid="demo-banner">
      <div class="demo-banner-content">
        <Icon name="InfoCircle" icon-class="demo-icon" />
        <span>Demo Mode - Experience Aris workspace with sample content</span>
        <a href="/" class="demo-link" data-testid="demo-back-link">← Back to homepage</a>
      </div>
    </div>

    <div
      class="view demo-view"
      data-testid="demo-container"
      :class="{ focus: focusMode, mobile: mobileMode }"
    >
      <Sidebar @show-component="showComponent" @hide-component="hideComponent" />

      <!-- Demo loading state -->
      <div v-if="!isContentLoaded" class="demo-loading" data-testid="demo-loading">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>Loading demo workspace...</p>
        </div>
      </div>

      <!-- Demo canvas -->
      <Canvas
        v-else
        v-model="demoFileReactive"
        data-testid="demo-canvas"
        data-loaded="true"
        :show-editor="showEditor"
        :show-search="showSearch"
      />
    </div>
  </div>
</template>

<style scoped>
  .demo-root {
    height: 100vh;
    width: 100vw;
    max-width: 100vw;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    position: relative;
  }

  .view {
    --transition-duration: 0.3s;
    --sidebar-width: v-bind(sidebarWidth);

    display: flex;
    width: 100%;
    max-width: 100vw;
    flex: 1;
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

  .demo-banner {
    background: linear-gradient(135deg, var(--blue-100) 0%, var(--purple-100) 100%);
    border-bottom: 1px solid var(--border-primary);
    padding: 8px 16px;
    z-index: 1000;
    position: relative;
    flex-shrink: 0;
    height: 40px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
  }

  /* Push sidebar down to account for demo banner */
  .demo-view :deep(.sb-wrapper) {
    top: 56px;
  }

  .demo-banner-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--dark);
    width: 100%;
  }

  .demo-icon {
    color: var(--blue-600);
  }

  .demo-link {
    color: var(--blue-600);
    text-decoration: none;
    margin-left: auto;
  }

  .demo-link:hover {
    text-decoration: underline;
  }

  /* Fix demo banner to stay within viewport */
  .demo-banner {
    width: 100vw !important;
    max-width: 100vw !important;
    overflow-x: hidden;
  }

  .demo-banner-content {
    width: 100% !important;
    max-width: calc(100vw - 32px) !important;
    margin: 0 auto;
    padding: 0 16px;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .demo-link {
    flex-shrink: 0;
  }

  .demo-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 400px;
    min-height: 50vh;
  }

  .loading-content {
    text-align: center;
    color: var(--gray-600);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--gray-200);
    border-top: 3px solid var(--primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
