/**
 * @file Unit tests for workspace Sidebar component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import Sidebar from "@/views/workspace/Sidebar.vue";

describe("Sidebar", () => {
  let wrapper;
  const mockRouter = {
    push: vi.fn(),
  };

  const createWrapper = (options = {}) => {
    const drawerOpen = ref(false);
    const focusMode = ref(false);
    const mobileMode = ref(false);
    const xsMode = ref(false);

    const wrapper = mount(Sidebar, {
      global: {
        provide: {
          drawerOpen,
          focusMode,
          mobileMode,
          xsMode,
        },
        mocks: {
          $router: mockRouter,
        },
        stubs: {
          SidebarItem: {
            template: '<div class="sidebar-item"><slot /></div>',
            props: ["icon", "label"],
          },
          SidebarMenu: {
            template: '<div class="sidebar-menu"><slot /></div>',
            props: ["items"],
            emits: ["on", "off"],
          },
          Drawer: {
            template: '<div class="drawer" :data-component="component"></div>',
            props: ["component"],
          },
          Logo: true,
          Tooltip: true,
          Icon: true,
        },
      },
      ...options,
    });

    return { wrapper, drawerOpen, focusMode, mobileMode, xsMode };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  describe("drawer state synchronization", () => {
    it("should set drawer button state to false when drawerOpen becomes false", async () => {
      const { wrapper: w, drawerOpen } = createWrapper();
      wrapper = w;
      await nextTick();

      // Get the items array from component instance
      const items = wrapper.vm.items;
      const versionsItem = items.find((item) => item.name === "DrawerVersions");
      // Simulate opening versions drawer by clicking button
      versionsItem.state = true;
      drawerOpen.value = true; // Drawer opens
      await nextTick();

      // Verify button is active
      expect(versionsItem.state).toBe(true);

      // Simulate ESC key press (useClosable sets drawerOpen to false)
      drawerOpen.value = false;
      await nextTick();

      // CRITICAL: Button state should be synchronized
      expect(versionsItem.state).toBe(false);
    });

    it("should set settings button state to false when drawerOpen becomes false", async () => {
      const { wrapper: w, drawerOpen } = createWrapper();
      wrapper = w;
      await nextTick();

      const items = wrapper.vm.items;
      const settingsItem = items.find((item) => item.name === "DrawerSettings");

      // Open settings drawer
      settingsItem.state = true;
      drawerOpen.value = true; // Drawer opens
      await nextTick();

      expect(settingsItem.state).toBe(true);

      // Simulate ESC key closing drawer
      drawerOpen.value = false;
      await nextTick();

      // Button should be deactivated
      expect(settingsItem.state).toBe(false);
    });

    it("should only affect drawer items, not toggle items", async () => {
      const { wrapper: w, drawerOpen } = createWrapper();
      wrapper = w;
      await nextTick();

      const items = wrapper.vm.items;
      const editorItem = items.find((item) => item.name === "DockableEditor");
      const versionsItem = items.find((item) => item.name === "DrawerVersions");

      // Activate both a toggle and a drawer
      editorItem.state = true;
      versionsItem.state = true;
      drawerOpen.value = true; // Drawer opens
      await nextTick();

      // Close drawer via ESC
      drawerOpen.value = false;
      await nextTick();

      // Toggle should remain active, drawer should be deactivated
      expect(editorItem.state).toBe(true);
      expect(versionsItem.state).toBe(false);
    });

    it("should handle multiple drawer buttons (only one can be active at a time)", async () => {
      const { wrapper: w, drawerOpen } = createWrapper();
      wrapper = w;
      await nextTick();

      const items = wrapper.vm.items;
      const versionsItem = items.find((item) => item.name === "DrawerVersions");
      const settingsItem = items.find((item) => item.name === "DrawerSettings");

      // Open versions
      versionsItem.state = true;
      drawerOpen.value = true; // Drawer opens
      await nextTick();

      // Switch to settings (should close versions)
      settingsItem.state = true;
      await nextTick();

      // Close via ESC
      drawerOpen.value = false;
      await nextTick();

      // Both should be deactivated
      expect(versionsItem.state).toBe(false);
      expect(settingsItem.state).toBe(false);
    });
  });
});
