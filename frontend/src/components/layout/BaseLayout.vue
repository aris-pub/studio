<script setup>
  /**
   * BaseLayout - The main layout component for application views.
   *
   * This component provides the overall structure including a configurable sidebar,
   * top-right menus (notifications, user menu), and a main content area via its default slot.
   * It manages the display of file upload modals and integrates with keyboard shortcuts
   * for navigation and user menu access.
   *
   * @displayName BaseLayout
   * @example
   * // Basic usage with sidebar items
   * <BaseLayout :sidebar-items="navItems">
   *   <Pane>Your main content goes here.</Pane>
   * </BaseLayout>
   *
   * @example
   * // With floating action button disabled
   * <BaseLayout :sidebar-items="navItems" :fab="false">
   *   <Pane>Content without FAB.</Pane>
   * </BaseLayout>
   */
  import { ref, computed, inject, useTemplateRef, provide, watchEffect } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import UploadFile from "@/views/home/ModalUploadFile.vue";
  import HamburgerMenu from "@/components/HamburgerMenu.vue";
  import UserMenu from "@/components/navigation/UserMenu.vue";

  const props = defineProps({
    fab: { type: Boolean, default: true },
    contextSubItems: { type: Array, default: () => [] },
  });

  const emit = defineEmits(["newEmptyFile", "showFileUploadModal"]);

  const mobileMode = inject("mobileMode");
  const fileStore = inject("fileStore");
  const user = inject("user");
  const route = useRoute();
  const router = useRouter();

  // Mobile drawer state
  const mobileDrawerOpen = ref(false);
  provide("mobileDrawerOpen", mobileDrawerOpen);

  // Create unified main sidebar items
  const mainSidebarItems = computed(() => [
    {
      icon: "Home",
      text: "Home",
      active: route.path === "/" || route.name === "home",
      route: "/",
    },
    {
      icon: "User",
      text: "Account",
      active: route.path.startsWith("/account"),
      route: "/account",
    },
    {
      icon: "Settings",
      text: "Settings",
      active: route.path.startsWith("/settings"),
      route: "/settings",
    },
    { separator: true },
    {
      icon: "LayoutSidebarLeftCollapse",
      iconCollapsed: "LayoutSidebarLeftExpand",
      text: "Collapse",
      tooltip: "Expand",
      action: "collapse",
    },
  ]);

  // Combine main items with context sub-items
  const allSidebarItems = computed(() => {
    const items = [];

    mainSidebarItems.value.forEach((item) => {
      items.push(item);

      // Insert sub-items container after the active main item
      if (item.active && !item.separator && !item.action && props.contextSubItems.length > 0) {
        items.push({
          isSubItemsContainer: true,
          subItems: props.contextSubItems.map((subItem) => ({
            ...subItem,
            isSubItem: true,
          })),
        });
      }
    });

    return items;
  });

  // New empty file
  const newEmptyFile = async () => {
    try {
      const newFile = await fileStore.value.createFile({
        title: "",
        ownerId: user.value.id,
        source: "# New File\n\nThe possibilities are *endless*!\n",
      });
      router.push(`/file/${newFile.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const showModal = ref(false);
  const isHome = computed(() => route.fullPath === "/");

  provide("newEmptyFile", newEmptyFile);
  provide("showFileUploadModal", () => {
    showModal.value = true;
  });

  // UserMenu keyboard shortcut removed - now handled by UserMenuDrawer

  // Handle sidebar item actions
  const handleSidebarAction = (action) => {
    switch (action) {
      case "newEmptyFile":
        newEmptyFile();
        break;
      case "showFileUploadModal":
        showModal.value = true;
        break;
      default:
        console.warn(`Unknown sidebar action: ${action}`);
    }
  };

  // Mobile drawer controls
  const toggleMobileDrawer = () => {
    mobileDrawerOpen.value = !mobileDrawerOpen.value;
  };

  const closeMobileDrawer = () => {
    mobileDrawerOpen.value = false;
  };

  // Prevent body scroll when mobile drawer is open
  watchEffect(() => {
    if (mobileMode.value && mobileDrawerOpen.value) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  });
</script>

<template>
  <div class="view" :class="{ mobile: mobileMode }">
    <BaseSidebar
      :sidebar-items="allSidebarItems"
      :fab="fab"
      @action="handleSidebarAction"
      @new-empty-file="newEmptyFile"
      @show-file-upload-modal="showModal = true"
      @close-mobile-drawer="closeMobileDrawer"
    />

    <div class="menus" :class="{ mobile: mobileMode }">
      <HamburgerMenu v-if="mobileMode" />
      <UserMenu />
    </div>

    <slot />

    <div v-if="showModal" class="modal">
      <UploadFile @close="showModal = false" />
    </div>
  </div>
</template>

<style scoped>
  .view {
    --transition-duration: 0.3s;

    position: relative;
    display: flex;
    flex-grow: 2;
    padding: 8px 8px 8px 0;
    height: 100%;
  }

  .view.mobile {
    padding: 0;
  }

  .menus {
    position: absolute;
    right: 24px;
    top: 24px;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .menus.mobile {
    top: 8px;
    right: 8px;
  }

  .modal {
    position: absolute;
    width: 100vw;
    height: 100vh;
    backdrop-filter: blur(2px) brightness(0.9);
    z-index: 999;
  }
</style>
