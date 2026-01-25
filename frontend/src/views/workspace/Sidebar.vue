<script setup>
  import { watch, inject, reactive, useTemplateRef, computed, nextTick, onMounted } from "vue";
  import { useRouter } from "vue-router";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import SidebarItem from "./SidebarItem.vue";
  import SidebarMenu from "./SidebarMenu.vue";
  import Drawer from "./Drawer.vue";
  import Icon from "@/components/base/Icon.vue";

  const router = useRouter();
  const emit = defineEmits(["showComponent", "hideComponent"]);
  const items = reactive([
    {
      name: "DockableEditor",
      icon: "Code",
      label: "source",
      key: "e",
      state: false,
      type: "toggle",
    },
    {
      name: "DockableSearch",
      icon: "Search",
      label: "search",
      key: "f",
      state: false,
      type: "toggle",
    },
    { name: "Separator", state: false },
    {
      name: "DrawerSettings",
      icon: "AdjustmentsHorizontal",
      label: "settings",
      key: "t",
      state: false,
      type: "drawer",
    },
    { name: "Separator", state: false },
  ]);

  // Watcher for toggles
  watch(
    () => items.filter((item) => item.type === "toggle").map((obj) => obj.state),
    (newStates, oldStates) => {
      const toggleItems = items.filter((item) => item.type === "toggle");
      newStates.forEach((isOn, idx) => {
        const wasOn = oldStates[idx];
        if (isOn && !wasOn) emit("showComponent", toggleItems[idx].name, "right");
        else if (!isOn && wasOn) emit("hideComponent", toggleItems[idx].name, "right");
      });
    }
  );

  // Keys
  useKeyboardShortcuts(
    Object.fromEntries([
      ...items
        .filter((obj) => obj.key && obj.type === "toggle")
        .map((obj) => [`p,${obj.key}`, { fn: () => (obj.state = !obj.state) }]),
    ])
  );

  // Event handlers for SidebarMenu
  const handleItemOn = (index) => (items[index].state = true);
  const handleItemOff = (index) => (items[index].state = false);

  // Context
  const layoutOnRef = useTemplateRef("layout-on-ref");
  const focusMode = inject("focusMode");
  const mobileMode = inject("mobileMode");
  const xsMode = inject("xsMode");
  const drawerOpen = inject("drawerOpen");

  // Computed button position to avoid drawer overlap
  const focusButtonLeft = computed(() => {
    if (focusMode.value) {
      // In focus mode, position relative to viewport since sidebar is translated away
      return "16px";
    }
    // Normal mode: avoid drawer overlap if drawer is open
    return drawerOpen.value ? "calc(64px + var(--sidebar-width))" : "64px";
  });
</script>

<template>
  <div
    ref="sidebar-ref"
    data-testid="workspace-sidebar"
    class="sb-wrapper"
    :class="{ focus: focusMode, mobile: mobileMode, xs: xsMode }"
  >
    <div v-if="!mobileMode" id="logo" role="button" tabindex="0" @click="router?.push('/')">
      <Logo type="small" />
    </div>

    <SidebarMenu :items="items" @on="handleItemOn" @off="handleItemOff" />
    <Drawer :component="items.find((it) => it.type === 'drawer' && it.state)?.name ?? ''" />

    <Tooltip :anchor="layoutOnRef?.btn ?? null" content="Focus mode off" placement="top" />
  </div>
</template>

<style scoped>
  .sb-wrapper {
    position: fixed;
    height: 100%;
    z-index: 2;
    width: var(--sidebar-width);
    top: 16px;

    transform: translateX(0);
    will-change: transform;
    transition:
      opacity var(--transition-duration) ease,
      transform var(--transition-duration) ease;
  }

  .sb-wrapper.focus {
    transform: translateX(-100%);
  }

  .sb-wrapper > :is(#logo, .sb-menu) {
    opacity: 1;
    will-change: opacity;
    transition: opacity var(--transition-duration) ease;
  }

  .sb-wrapper.focus > :is(#logo, .sb-menu) {
    opacity: 0;
  }

  #logo {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 48px;
    width: 64px;
    margin-bottom: 8px;
    opacity: 1;
    &:hover {
      cursor: pointer;
    }

    & img {
      width: 30px;
      height: 30px;
    }
  }

  .sb-wrapper.mobile {
    padding: 0;
    height: 48px;
    width: 100%;
    top: unset;
    bottom: 0;
    border-top: var(--border-extrathin) solid var(--border-primary);
    background-color: var(--surface-hover);
    border-radius: 16px 16px 0 0;
  }

  .sep {
    margin-block: 8px;
    padding-block: 4px;
  }
</style>
