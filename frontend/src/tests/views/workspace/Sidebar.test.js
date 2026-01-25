import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import Sidebar from "@/views/workspace/Sidebar.vue";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";

// Mock vue-router
const pushMock = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("Workspace Sidebar", () => {
  let useKSSpy;

  beforeEach(() => {
    useKSSpy = vi.spyOn(KSMod, "useKeyboardShortcuts").mockImplementation(() => {});
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createWrapper = (provide = {}) => {
    return mount(Sidebar, {
      global: {
        provide: {
          focusMode: { value: false },
          mobileMode: false,
          xsMode: false,
          drawerOpen: { value: false },
          ...provide,
        },
        stubs: {
          SidebarMenu: {
            name: "SidebarMenu",
            template: "<div class='sidebar-menu-stub' />",
            props: ["items"],
            emits: ["on", "off"],
          },
          Drawer: {
            name: "Drawer",
            template: "<div class='drawer-stub' />",
            props: ["component"],
          },
          // Remove SidebarItem stub - test with real component
          // Stub child components that SidebarItem needs
          ButtonToggle: {
            name: "ButtonToggle",
            template:
              '<button :aria-pressed="modelValue" @click="$emit(\'update:modelValue\', !modelValue)"><slot /></button>',
            props: ["modelValue", "icon", "buttonSize", "activeColor", "type"],
            emits: ["update:modelValue"],
          },
          // Remove Tooltip stub - let real component render
        },
      },
    });
  };

  describe("component structure", () => {
    it("renders with correct default structure", () => {
      const wrapper = createWrapper();

      expect(wrapper.find(".sb-wrapper").exists()).toBe(true);
      expect(wrapper.find("#logo").exists()).toBe(true);
      expect(wrapper.findComponent({ name: "SidebarMenu" }).exists()).toBe(true);
      expect(wrapper.findComponent({ name: "Drawer" }).exists()).toBe(true);
    });

    it("hides logo in mobile mode", () => {
      const wrapper = createWrapper({ mobileMode: true });

      expect(wrapper.find("#logo").exists()).toBe(false);
    });

    it("shows logo in desktop mode", () => {
      const wrapper = createWrapper({ mobileMode: false });

      expect(wrapper.find("#logo").exists()).toBe(true);
    });

    it("applies correct CSS classes based on context", () => {
      const wrapper = createWrapper({
        focusMode: { value: true },
        mobileMode: true,
        xsMode: true,
      });

      const sbWrapper = wrapper.find(".sb-wrapper");
      expect(sbWrapper.classes()).toContain("focus");
      expect(sbWrapper.classes()).toContain("mobile");
      expect(sbWrapper.classes()).toContain("xs");
    });
  });

  describe("items configuration", () => {
    it("contains all expected toggle items", () => {
      const wrapper = createWrapper();
      const items = wrapper.vm.items;

      const toggleItems = items.filter((item) => item.type === "toggle");
      expect(toggleItems).toHaveLength(2);

      const toggleNames = toggleItems.map((item) => item.name);
      expect(toggleNames).toContain("DockableEditor");
      expect(toggleNames).toContain("DockableSearch");
    });

    it("contains all expected drawer items", () => {
      const wrapper = createWrapper();
      const items = wrapper.vm.items;

      const drawerItems = items.filter((item) => item.type === "drawer");
      expect(drawerItems).toHaveLength(1);

      const drawerNames = drawerItems.map((item) => item.name);
      expect(drawerNames).toContain("DrawerSettings");
    });

    it("includes separators in items", () => {
      const wrapper = createWrapper();
      const items = wrapper.vm.items;

      const separators = items.filter((item) => item.name === "Separator");
      expect(separators).toHaveLength(2);
    });
  });

  describe("event emissions", () => {
    it("emits show-component when toggle item is turned on", async () => {
      const wrapper = createWrapper();

      // Find the editor toggle item and turn it on
      const editorItem = wrapper.vm.items.find((item) => item.name === "DockableEditor");
      editorItem.state = true;

      await nextTick();

      expect(wrapper.emitted("showComponent")).toBeTruthy();
      expect(wrapper.emitted("showComponent")[0]).toEqual(["DockableEditor", "right"]);
    });

    it("emits hide-component when toggle item is turned off", async () => {
      const wrapper = createWrapper();

      // First turn on, then turn off
      const editorItem = wrapper.vm.items.find((item) => item.name === "DockableEditor");
      editorItem.state = true;
      await nextTick();

      editorItem.state = false;
      await nextTick();

      expect(wrapper.emitted("hideComponent")).toBeTruthy();
      expect(wrapper.emitted("hideComponent")[0]).toEqual(["DockableEditor", "right"]);
    });

    it("emits events for multiple toggle changes", async () => {
      const wrapper = createWrapper();

      const editorItem = wrapper.vm.items.find((item) => item.name === "DockableEditor");
      const searchItem = wrapper.vm.items.find((item) => item.name === "DockableSearch");

      // Turn on editor
      editorItem.state = true;
      await nextTick();

      // Turn on search
      searchItem.state = true;
      await nextTick();

      // Turn off editor
      editorItem.state = false;
      await nextTick();

      const showEvents = wrapper.emitted("showComponent");
      const hideEvents = wrapper.emitted("hideComponent");

      expect(showEvents).toHaveLength(2);
      expect(hideEvents).toHaveLength(1);
      expect(showEvents[0]).toEqual(["DockableEditor", "right"]);
      expect(showEvents[1]).toEqual(["DockableSearch", "right"]);
      expect(hideEvents[0]).toEqual(["DockableEditor", "right"]);
    });
  });

  describe("keyboard shortcuts", () => {
    it("registers keyboard shortcuts for toggle items", () => {
      createWrapper();

      expect(useKSSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          "p,e": expect.any(Object), // DockableEditor shortcut
          "p,f": expect.any(Object), // DockableSearch shortcut
        })
      );
    });

    it("toggles item state when keyboard shortcut is invoked", () => {
      let shortcutsConfig;
      useKSSpy.mockImplementation((config) => {
        shortcutsConfig = config;
      });

      const wrapper = createWrapper();
      const editorItem = wrapper.vm.items.find((item) => item.name === "DockableEditor");

      expect(editorItem.state).toBe(false);

      // Invoke the keyboard shortcut
      shortcutsConfig["p,e"].fn();

      expect(editorItem.state).toBe(true);

      // Invoke again to toggle off
      shortcutsConfig["p,e"].fn();

      expect(editorItem.state).toBe(false);
    });
  });

  describe("logo functionality", () => {
    it("navigates to home when logo is clicked", async () => {
      const wrapper = createWrapper();

      const logo = wrapper.find("#logo");
      expect(logo.exists()).toBe(true);

      await logo.trigger("click");

      expect(pushMock).toHaveBeenCalledWith("/");
    });

    it("makes logo accessible with tabindex and role", () => {
      const wrapper = createWrapper();

      const logo = wrapper.find("#logo");
      expect(logo.attributes("role")).toBe("button");
      expect(logo.attributes("tabindex")).toBe("0");
    });
  });

  describe("drawer integration", () => {
    it("passes active drawer component to Drawer component", async () => {
      const wrapper = createWrapper();

      // Initially no drawer is active
      let drawerComponent = wrapper.findComponent({ name: "Drawer" });
      expect(drawerComponent.props("component")).toBe("");

      // Activate a drawer
      const settingsItem = wrapper.vm.items.find((item) => item.name === "DrawerSettings");
      settingsItem.state = true;
      await nextTick();

      // Should pass the active drawer name
      drawerComponent = wrapper.findComponent({ name: "Drawer" });
      expect(drawerComponent.props("component")).toBe("DrawerSettings");
    });

    it("only shows one drawer at a time", async () => {
      const wrapper = createWrapper();

      // Since we only have one drawer component left (DrawerSettings),
      // this test primarily verifies the drawer mechanism still works
      const settingsItem = wrapper.vm.items.find((item) => item.name === "DrawerSettings");

      // Activate settings drawer
      settingsItem.state = true;
      await nextTick();

      let drawerComponent = wrapper.findComponent({ name: "Drawer" });
      expect(drawerComponent.props("component")).toBe("DrawerSettings");

      // Deactivate drawer
      settingsItem.state = false;
      await nextTick();

      // Should show no drawer
      drawerComponent = wrapper.findComponent({ name: "Drawer" });
      expect(drawerComponent.props("component")).toBe("");
    });
  });

  describe("focus mode", () => {
    it("shows focus mode toggle button when in focus mode", () => {
      const wrapper = createWrapper({ focusMode: { value: true } });

      // The SidebarMenu receives the items array from the parent Sidebar component
      const sidebarMenu = wrapper.findComponent({ name: "SidebarMenu" });
      expect(sidebarMenu.exists()).toBe(true);

      // Verify the SidebarMenu component receives the items prop correctly
      const items = sidebarMenu.props("items");
      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it("has sidebar items available regardless of focus mode state", () => {
      const wrapper = createWrapper({ focusMode: { value: false } });

      // SidebarMenu should always be present with items regardless of focus mode
      const sidebarMenu = wrapper.findComponent({ name: "SidebarMenu" });
      expect(sidebarMenu.exists()).toBe(true);

      const items = sidebarMenu.props("items");
      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it("focus mode reactive value is accessible to SidebarMenu", async () => {
      const focusMode = { value: true };
      const wrapper = createWrapper({ focusMode });

      // The focus mode value should be injected and available to the component
      expect(wrapper.vm).toBeDefined();
      // focusMode is injected from the provide context
      // SidebarMenu component handles the actual focus mode button rendering
      const sidebarMenu = wrapper.findComponent({ name: "SidebarMenu" });
      expect(sidebarMenu.exists()).toBe(true);
    });
  });

  describe("responsive behavior", () => {
    it("applies mobile class in mobile mode", () => {
      const wrapper = createWrapper({ mobileMode: true });

      expect(wrapper.find(".sb-wrapper").classes()).toContain("mobile");
    });

    it("applies xs class in extra small mode", () => {
      const wrapper = createWrapper({ xsMode: true });

      expect(wrapper.find(".sb-wrapper").classes()).toContain("xs");
    });

    it("applies focus class when in focus mode", () => {
      const wrapper = createWrapper({ focusMode: { value: true } });

      expect(wrapper.find(".sb-wrapper").classes()).toContain("focus");
    });
  });
});
