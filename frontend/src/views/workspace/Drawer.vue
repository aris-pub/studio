<script setup>
  import { ref, inject } from "vue";
  import useClosable from "@/composables/useClosable.js";
  import DrawerMargins from "./DrawerMargins.vue";
  import DrawerActivity from "./DrawerActivity.vue";
  import DrawerSettings from "./DrawerSettings.vue";

  const props = defineProps({ component: { type: String, required: true } });
  const active = inject("drawerOpen");
  const focusMode = inject("focusMode");
  useClosable({
    onClose: () => (active.value = false),
    closeOnOutsideClick: false,
  });
  const componentMap = {
    DrawerMargins: DrawerMargins,
    DrawerActivity: DrawerActivity,
    DrawerSettings: DrawerSettings,
  };
</script>

<template>
  <div class="drawer" :class="{ active, focus: focusMode }">
    <component :is="componentMap[component]" v-if="component" />
  </div>
</template>

<style scoped>
  .drawer {
    background: var(--surface-page);
    position: absolute;
    top: -8px;
    bottom: 24px;
    left: calc(-1 * var(--sidebar-width));
    width: calc(var(--sidebar-width) - 8px);
    border-radius: 16px;
    box-shadow: var(--shadow-soft);
    overflow: hidden;
    opacity: 0;
    overflow-y: auto;
    transition:
      left 0.3s ease,
      opacity 0.3s ease;
  }

  .drawer.active {
    left: 64px;
    opacity: 1;
  }

  .drawer.focus,
  .drawer.active.focus {
    opacity: 0 !important;
    left: calc(-1 * var(--sidebar-width)) !important;
  }

  :deep(.pane) {
    padding-top: 16px;
    overflow-y: auto;
    height: 100%;
  }

  :deep(.section) {
    width: 100%;
    background-color: var(--surface-page);
  }
</style>
