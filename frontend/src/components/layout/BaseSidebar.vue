<script setup>
  import { ref, computed, inject, provide, watchEffect, useTemplateRef } from "vue";
  import { useRouter } from "vue-router";
  import { File } from "@/models/File.js";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import useClosable from "@/composables/useClosable.js";
  import BaseSidebarItem from "./BaseSidebarItem.vue";

  defineOptions({
    name: "BaseSidebar",
  });

  const props = defineProps({
    sidebarItems: {
      type: Array,
      default: () => [],
      validator: (items) => {
        return items.every(
          (item) =>
            item.separator || item.isSubItemsContainer || (item.text && (item.icon || item.action))
        );
      },
    },
    fab: { type: Boolean, default: true },
  });
  const emit = defineEmits(["action", "newEmptyFile", "showFileUploadModal", "closeMobileDrawer"]);
  const menuItems = computed(() => {
    return props.sidebarItems;
  });

  // Collapsing - use only the global state
  const collapsed = inject("sidebarIsCollapsed");
  const toggleCollapsed = () => {
    collapsed.value = !collapsed.value;
  };
  provide("collapsed", collapsed);

  // Breakpoints
  const mobileMode = inject("mobileMode");

  // Mobile drawer state
  const mobileDrawerOpen = inject("mobileDrawerOpen", ref(false));

  // CTA
  const menuRef = useTemplateRef("menu-ref");
  const onCTAClick = () => menuRef.value.toggle();

  const router = useRouter();
  const goTo = (page) => {
    router.push(`/${page}`);
  };

  // Recent files
  const fileStore = inject("fileStore");
  const recentFiles = ref(["", "", ""]);
  watchEffect(() => {
    recentFiles.value = fileStore.value?.getRecentFiles(3) || ["", "", ""];
  });
  const openRecentFile = (idx) => {
    const file = recentFiles.value[idx];
    if (!file) return;
    goTo(`file/${file.id}`);
  };

  // Handle sidebar item click
  const handleItemClick = (item) => {
    if (!item.clickable && item.clickable !== undefined) return;

    if (item.route) {
      router.push(item.route);
      // Close mobile drawer after navigation
      if (mobileMode.value && mobileDrawerOpen.value) {
        emit("closeMobileDrawer");
      }
    } else if (item.action) {
      switch (item.action) {
        case "collapse":
          toggleCollapsed();
          break;
        case "newEmptyFile":
          emit("newEmptyFile");
          break;
        case "showFileUploadModal":
          emit("showFileUploadModal");
          break;
        default:
          emit("action", item.action);
      }
    } else if (item.onClick) {
      item.onClick();
    }
  };

  // Mobile drawer content ref for useClosable
  const sidebarContentRef = useTemplateRef("sidebar-content-ref");

  // Keys
  const keyboardController = useKeyboardShortcuts(
    {
      "g,h": { fn: () => goTo(""), description: "go home" },
      "g,a": { fn: () => goTo("account"), description: "go to user account" },
      "g,s": { fn: () => goTo("settings"), description: "go to settings" },
      "g,1": { fn: () => openRecentFile(0), description: "open most recent file" },
      "g,2": { fn: () => openRecentFile(1), description: "open second most recent file" },
      "g,3": { fn: () => openRecentFile(2), description: "open third most recent file" },
      n: { fn: onCTAClick, description: "open new file menu" },
      c: { fn: toggleCollapsed, description: "collapse sidebar" },
    },
    true,
    "Main"
  );

  // Setup useClosable for mobile drawer (no keyboard shortcuts for mobile)
  const { activate: activateClosable, deactivate: deactivateClosable } = useClosable({
    onClose: () => emit("closeMobileDrawer"),
    closeOnEsc: false, // Mobile devices don't have keyboards
    closeOnOutsideClick: true,
    closeOnCloseButton: false,
    autoActivate: false,
  });

  // Watch mobile drawer state to activate/deactivate useClosable
  watchEffect(() => {
    if (mobileMode.value && mobileDrawerOpen.value) {
      activateClosable();
    } else {
      deactivateClosable();
    }
  });

  const ctaAttrs = computed(() => {
    return {
      text: mobileMode.value || collapsed.value ? "" : "New File",
      placement: mobileMode.value ? "top-end" : "bottom",
      kind: mobileMode.value ? "primary" : "secondary",
      class: collapsed.value ? "collapsed" : "",
    };
  });
</script>

<template>
  <div
    class="sb-wrapper"
    :class="{
      mobile: mobileMode,
      collapsed: collapsed,
      'drawer-open': mobileMode && mobileDrawerOpen,
    }"
  >
    <!-- Mobile backdrop -->
    <div
      v-if="mobileMode && mobileDrawerOpen"
      class="mobile-backdrop"
      @click="emit('closeMobileDrawer')"
    ></div>

    <!-- Desktop mode: direct children for CSS compatibility -->
    <template v-if="!mobileMode">
      <div id="logo">
        <Logo :type="collapsed ? 'small' : 'full'" alt="Aris logo" />
      </div>

      <div class="cta">
        <ContextMenu
          ref="menu-ref"
          data-testid="create-file-button"
          variant="slot"
          :placement="ctaAttrs.placement"
        >
          <template #trigger="{ toggle }">
            <Button :icon="'CirclePlus'" v-bind="ctaAttrs" @click="toggle" />
          </template>
          <ContextMenuItem icon="File" caption="Empty file" @click="emit('newEmptyFile')" />
          <ContextMenuItem icon="Upload" caption="Upload" @click="emit('showFileUploadModal')" />
        </ContextMenu>
      </div>

      <div class="sb-menu">
        <template v-for="(item, index) in menuItems" :key="`item-${index}`">
          <Separator v-if="item.separator" />
          <div v-else-if="item.isSubItemsContainer" class="sub-items-container">
            <BaseSidebarItem
              v-for="(subItem, subIndex) in item.subItems"
              :key="`sub-item-${subIndex}`"
              :icon="subItem.icon"
              :icon-collapsed="subItem.iconCollapsed"
              :text="subItem.text"
              :tooltip="subItem.tooltip"
              :tooltip-always="subItem.tooltipAlways"
              :active="subItem.active"
              :clickable="subItem.clickable"
              :is-sub-item="subItem.isSubItem"
              :class="subItem.class"
              @click="handleItemClick(subItem)"
            />
          </div>
          <BaseSidebarItem
            v-else
            :icon="item.icon"
            :icon-collapsed="item.iconCollapsed"
            :text="item.text"
            :tooltip="item.tooltip"
            :tooltip-always="item.tooltipAlways"
            :active="item.active"
            :clickable="item.clickable"
            :is-sub-item="item.isSubItem"
            :class="item.class"
            @click="handleItemClick(item)"
          />
        </template>
      </div>
    </template>

    <!-- Mobile mode: drawer content when open -->
    <div v-if="mobileMode && mobileDrawerOpen" ref="sidebar-content-ref" class="sidebar-content">
      <div id="logo">
        <Logo :type="collapsed ? 'small' : 'full'" alt="Aris logo" />
      </div>

      <div class="cta">
        <ContextMenu
          ref="menu-ref"
          data-testid="create-file-button"
          variant="slot"
          :placement="ctaAttrs.placement"
        >
          <template #trigger="{ toggle }">
            <Button :icon="'CirclePlus'" v-bind="ctaAttrs" @click="toggle" />
          </template>
          <ContextMenuItem icon="File" caption="Empty file" @click="emit('newEmptyFile')" />
          <ContextMenuItem icon="Upload" caption="Upload" @click="emit('showFileUploadModal')" />
        </ContextMenu>
      </div>

      <div class="sb-menu">
        <template v-for="(item, index) in menuItems" :key="`item-${index}`">
          <Separator v-if="item.separator" />
          <div v-else-if="item.isSubItemsContainer" class="sub-items-container">
            <BaseSidebarItem
              v-for="(subItem, subIndex) in item.subItems"
              :key="`sub-item-${subIndex}`"
              :icon="subItem.icon"
              :icon-collapsed="subItem.iconCollapsed"
              :text="subItem.text"
              :tooltip="subItem.tooltip"
              :tooltip-always="subItem.tooltipAlways"
              :active="subItem.active"
              :clickable="subItem.clickable"
              :is-sub-item="subItem.isSubItem"
              :class="subItem.class"
              @click="handleItemClick(subItem)"
            />
          </div>
          <BaseSidebarItem
            v-else
            :icon="item.icon"
            :icon-collapsed="item.iconCollapsed"
            :text="item.text"
            :tooltip="item.tooltip"
            :tooltip-always="item.tooltipAlways"
            :active="item.active"
            :clickable="item.clickable"
            :is-sub-item="item.isSubItem"
            :class="item.class"
            @click="handleItemClick(item)"
          />
        </template>
      </div>
    </div>

    <!-- Mobile FAB when drawer is closed -->
    <div v-if="mobileMode && !mobileDrawerOpen && fab" class="cta fab">
      <ContextMenu
        ref="menu-ref"
        data-testid="create-file-button"
        variant="slot"
        :placement="ctaAttrs.placement"
      >
        <template #trigger="{ toggle }">
          <Button :icon="'CirclePlus'" v-bind="ctaAttrs" @click="toggle" />
        </template>
        <ContextMenuItem icon="File" caption="Empty file" @click="emit('newEmptyFile')" />
        <ContextMenuItem icon="Upload" caption="Upload" @click="emit('showFileUploadModal')" />
      </ContextMenu>
    </div>
  </div>
</template>

<style scoped>
  .sb-wrapper {
    --expanded-width: 192px;
    --collapsed-width: 64px;
    --transition-duration: 0.3s;

    height: 100%;
    transition:
      min-width var(--transition-duration) ease-out,
      max-width var(--transition-duration) ease-out,
      flex-basis var(--transition-duration) ease-out;
  }

  .sb-wrapper:not(.mobile):not(.collapsed) {
    flex-basis: var(--expanded-width);
    min-width: var(--expanded-width);
    max-width: var(--expanded-width);
    flex-grow: 0;
    flex-shrink: 0;

    & .cta {
      display: flex;
      justify-content: center;
      padding-block: 10px;
      padding-inline: 16px;
      width: 100%;
    }

    & .cta > .cm-wrapper :deep(button) {
      padding-left: 24px !important;
      padding-right: 30px !important;
      width: 100%;
      gap: 0px;
    }

    & > #logo img {
      height: 64px;
      margin: 8px 0 0 6px;
      transform: scale(0.65);
    }
  }

  .sb-wrapper:not(.mobile).collapsed {
    padding-top: 8px;
    min-width: var(--collapsed-width);
    max-width: var(--collapsed-width);
    flex-basis: var(--collapsed-width);
    flex-grow: 0;

    & > * {
      margin: 0 auto;
    }

    & > #logo {
      margin-bottom: 8px;
      padding-inline: 16px;

      img {
        margin: 0 0 -8px 0;
        width: 30px;
        height: 30px;
      }
    }

    & > .cta {
      padding-block: 10px;
      padding-inline: 8px;
    }

    & > .cta > .cm-wrapper > :deep(button) {
      width: 48px;
    }
  }

  .sb-wrapper:not(.mobile) {
    #logo img {
      transition:
        width var(--transition-duration) ease-out,
        margin-inline var(--transition-duration) ease-out;
    }
  }

  .sb-wrapper.mobile {
    width: 0;
    height: 0;
    position: fixed;
    z-index: 999;
  }

  .sb-wrapper.mobile.drawer-open {
    width: 100vw;
    height: 100vh;
    top: 0;
    left: 0;
    z-index: 1000;
  }

  .sb-wrapper.mobile.drawer-open .sidebar-content {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    height: 100vh;
    background: var(--gray-50);
    border-right: 1px solid var(--gray-200);
    padding: 16px;
    overflow-y: auto;
    z-index: 1002;
    transform: translateX(0);
    transition: transform 0.3s ease-out;
  }

  .mobile-backdrop {
    position: fixed;
    top: 0;
    left: 280px; /* Start backdrop after sidebar width */
    width: calc(100vw - 280px); /* Cover remaining width */
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1001;
    cursor: pointer;
  }

  /* Mobile drawer sidebar content styling */
  .sb-wrapper.mobile.drawer-open .sidebar-content #logo {
    margin-bottom: 24px;
    padding-inline: 0;
  }

  .sb-wrapper.mobile.drawer-open .sidebar-content #logo img {
    height: 48px;
    margin: 0;
  }

  .sb-wrapper.mobile.drawer-open .sidebar-content .cta {
    padding-block: 10px;
    padding-inline: 0;
  }

  .sb-wrapper.mobile.drawer-open .sidebar-content .sb-menu {
    padding-top: 8px;
    height: auto;
  }

  /* Hide FAB when drawer is open */
  .sb-wrapper.mobile.drawer-open .cta.fab {
    display: none;
  }

  #logo {
    display: flex;
    justify-content: center;

    img {
      margin: 0 auto;
    }
  }

  .sb-menu {
    padding-top: 8px;
    height: calc(100% - 64px - 32px - 16px - 16px - 8px);
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }

    & :deep(div.sb-item span.sb-text) {
      transition:
        opacity var(--transition-duration) ease-out,
        max-width var(--transition-duration) ease-out;
    }

    & :deep(div.sb-item:not(.collapsed) span.sb-text) {
      opacity: 1;
      max-width: var(--expanded-width);
    }

    & :deep(div.sb-item.collapsed span.sb-text) {
      opacity: 0;
      max-width: 0;
    }
  }

  .sb-menu > * {
    margin-block: 8px;
  }

  .sb-menu > .sep {
    margin-block: 12px;
  }

  .sub-items-container {
    background-color: var(--gray-200);
    border-radius: 8px;
    margin-inline: 8px;
    padding-block: 6px;
  }

  .sub-items-container > .sb-item.sub-item > :deep(.sb-text) {
    width: calc(100% - 24px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sb-menu > *:first-child {
    margin-top: 2px;
  }

  .sb-menu > *,
  .cta > .cm-wrapper > :deep(button) {
    gap: 4px;
    text-wrap: nowrap;
    white-space: nowrap;
  }

  .cta.fab {
    position: fixed;
    bottom: 16px;
    right: 16px;
  }

  .cta {
    transition: padding-inline 0.2s ease 0.1s;
  }

  .cta:not(.mobile) > .cm-wrapper > :deep(button:has(> .btn-text)) {
  }

  .cta > .cm-wrapper > :deep(button) {
    overflow-x: hidden;
    transition:
      width var(--transition-duration) ease,
      padding var(--transition-duration) ease;
  }

  .cta > .cm-wrapper > :deep(button > .btn-text) {
    max-width: calc(var(--sidebar-width) - 16px - 32px);
    opacity: 1;
    transition:
      opacity var(--transition-duration) ease,
      width var(--transition-duration) ease,
      max-width var(--transition-duration) ease;
  }

  .cta > .cm-wrapper > :deep(button.collapsed > .btn-text) {
    width: 0;
    opacity: 0;
    max-width: 0;
  }

  /* Overwrite Button padding so collapsing transition works well */
  .cta > .cm-wrapper > :deep(button.collapsed) {
    padding: calc(8px - var(--border-thin)) !important;
    gap: 0px;
  }

  .sc-wrapper {
    margin-left: 20px;
    margin-bottom: 0;
  }
</style>
