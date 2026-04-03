<script setup>
  import { inject, computed } from "vue";
  import useClosable from "@/composables/useClosable.js";
  import BottomSheet from "@/components/base/BottomSheet.vue";
  import DrawerMargins from "./DrawerMargins.vue";
  import DrawerActivity from "./DrawerActivity.vue";
  import DrawerSettings from "./DrawerSettings.vue";
  import DrawerVersions from "./DrawerVersions.vue";
  import DrawerShare from "./DrawerShare.vue";
  import DrawerFile from "./DrawerFile.vue";

  const props = defineProps({ component: { type: String, required: true } });
  const active = inject("drawerOpen");
  const focusMode = inject("focusMode");
  const mobileMode = inject("mobileMode", false);

  useClosable({
    onClose: () => (active.value = false),
    closeOnOutsideClick: false,
  });

  const componentMap = {
    DrawerMargins: DrawerMargins,
    DrawerActivity: DrawerActivity,
    DrawerSettings: DrawerSettings,
    DrawerVersions: DrawerVersions,
    DrawerShare: DrawerShare,
    DrawerFile: DrawerFile,
  };

  const mobileDrawers = new Set(["DrawerSettings", "DrawerFile"]);
  const useMobileSheet = computed(() => mobileMode?.value && mobileDrawers.has(props.component));

  const drawerTitle = computed(() => {
    const titles = {
      DrawerSettings: "Document Display",
      DrawerFile: "File Info",
    };
    return titles[props.component] || "";
  });
</script>

<template>
  <BottomSheet
    v-if="useMobileSheet"
    :model-value="active"
    :title="drawerTitle"
    @update:model-value="active = $event"
  >
    <component :is="componentMap[component]" />
  </BottomSheet>
  <div v-else class="drawer" :class="{ active, focus: focusMode }">
    <component :is="componentMap[component]" v-if="component" />
  </div>
</template>

<style scoped>
  .drawer {
    background: var(--surface-page);
    position: absolute;
    top: -8px;
    bottom: 24px;
    left: 64px;
    width: calc(var(--sidebar-width) - 8px);
    border-radius: 16px;
    box-shadow: var(--shadow-soft);
    overflow: hidden;
    opacity: 0;
    overflow-y: auto;
    transform: translateX(calc(-64px - var(--sidebar-width)));
    transition:
      transform 0.3s ease,
      opacity 0.3s ease;
  }

  .drawer.active {
    transform: translateX(0);
    opacity: 1;
  }

  .drawer.focus,
  .drawer.active.focus {
    opacity: 0 !important;
    transform: translateX(calc(-64px - var(--sidebar-width))) !important;
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
