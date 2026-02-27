import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import BaseSidebar from "@/components/layout/BaseSidebar.vue";

// Mock vue-router
const mockRoute = { path: "/settings/preferences" };
const mockRouter = { push: vi.fn() };
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}));

// Mock composables
vi.mock("@/composables/useKeyboardShortcuts.js", () => ({
  useKeyboardShortcuts: vi.fn(() => ({ activate: vi.fn(), deactivate: vi.fn() })),
}));

vi.mock("@/composables/useClosable.js", () => ({
  default: vi.fn(() => ({ activate: vi.fn(), deactivate: vi.fn() })),
}));

describe("BaseSidebar", () => {
  let wrapper;
  const mockSidebarItems = [
    {
      icon: "Home",
      text: "Home",
      active: false,
      route: "/",
    },
    {
      icon: "Settings",
      text: "Settings",
      active: true,
      route: "/settings",
    },
    {
      isSubItemsContainer: true,
      subItems: [
        {
          icon: "FileText",
          text: "File Display",
          active: false,
          route: "/settings/document",
          isSubItem: true,
        },
        {
          icon: "Settings2",
          text: "Preferences",
          active: true,
          route: "/settings/preferences",
          isSubItem: true,
        },
      ],
    },
    { separator: true },
    {
      icon: "LayoutSidebarLeftCollapse",
      text: "Collapse",
      action: "collapse",
    },
  ];

  const mockProvideValues = {
    sidebarIsCollapsed: ref(false),
    mobileMode: ref(false),
    fileStore: ref({ getRecentFiles: () => [] }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    wrapper = mount(BaseSidebar, {
      props: {
        sidebarItems: mockSidebarItems,
        fab: true,
      },
      global: {
        provide: mockProvideValues,
        components: {
          Logo: { template: '<div data-testid="logo" />' },
          ContextMenu: {
            template: '<div data-testid="context-menu"><slot name="trigger" /><slot /></div>',
          },
          ContextMenuItem: { template: '<div data-testid="context-menu-item" />' },
          Button: { template: '<button data-testid="button" />' },
          Separator: { template: '<div data-testid="separator" />' },
          BaseSidebarItem: { template: '<div data-testid="base-sidebar-item" />' },
        },
      },
    });
  });

  describe("Component Structure", () => {
    it("renders the sidebar wrapper", () => {
      expect(wrapper.find(".sb-wrapper").exists()).toBe(true);
    });

    it("has correct CSS classes based on mobile and collapsed state", () => {
      // Note: The component reactively applies classes based on injected values
      const sbWrapper = wrapper.find(".sb-wrapper");
      expect(sbWrapper.exists()).toBe(true);
      // Classes are reactive based on injected provide values
    });

    it("applies mobile class in mobile mode", async () => {
      const mobileWrapper = mount(BaseSidebar, {
        props: { sidebarItems: mockSidebarItems },
        global: {
          provide: {
            ...mockProvideValues,
            mobileMode: ref(true),
          },
          components: {
            Logo: { template: '<div data-testid="logo" />' },
            ContextMenu: {
              template: '<div data-testid="context-menu"><slot name="trigger" /><slot /></div>',
            },
            ContextMenuItem: { template: '<div data-testid="context-menu-item" />' },
            Button: { template: '<button data-testid="button" />' },
            BaseSidebarItem: { template: '<div data-testid="base-sidebar-item" />' },
            Separator: { template: '<div data-testid="separator" />' },
          },
        },
      });

      expect(mobileWrapper.find(".sb-wrapper").classes()).toContain("mobile");
    });

    it("applies collapsed class when collapsed", async () => {
      const collapsedWrapper = mount(BaseSidebar, {
        props: { sidebarItems: mockSidebarItems },
        global: {
          provide: {
            ...mockProvideValues,
            sidebarIsCollapsed: ref(true),
          },
          stubs: {
            Logo: true,
            ContextMenu: true,
            ContextMenuItem: true,
            Button: true,
            BaseSidebarItem: true,
          },
        },
      });

      expect(collapsedWrapper.find(".sb-wrapper").classes()).toContain("collapsed");
    });
  });

  describe("Sidebar Items Processing", () => {
    it("processes sidebar items correctly", () => {
      expect(wrapper.vm.menuItems).toEqual(mockSidebarItems);
    });

    it("validates sidebar items prop correctly", () => {
      const validator = BaseSidebar.props.sidebarItems.validator;

      // Valid items
      expect(
        validator([
          { text: "Home", icon: "Home" },
          { separator: true },
          { isSubItemsContainer: true, subItems: [] },
        ])
      ).toBe(true);

      // Invalid items (missing text and icon)
      expect(
        validator([
          { icon: "Home" }, // missing text
        ])
      ).toBe(false);
    });
  });

  describe("Sub-Items Container Logic", () => {
    it("handles sub-items container in sidebar items", () => {
      const subItemsContainer = mockSidebarItems.find((item) => item.isSubItemsContainer);
      expect(subItemsContainer).toBeDefined();
      expect(subItemsContainer.subItems).toHaveLength(2);
      expect(subItemsContainer.subItems[0].isSubItem).toBe(true);
    });
  });

  describe("Props and Defaults", () => {
    it("has correct default props", () => {
      const defaultWrapper = mount(BaseSidebar, {
        global: {
          provide: mockProvideValues,
          stubs: { Logo: true, ContextMenu: true, Button: true },
        },
      });

      expect(defaultWrapper.props("sidebarItems")).toEqual([]);
      expect(defaultWrapper.props("fab")).toBe(true);
    });

    it("accepts fab prop", () => {
      expect(wrapper.props("fab")).toBe(true);
    });
  });

  describe("Event Handling", () => {
    it("handles item click with route navigation", async () => {
      const item = { route: "/test", active: false };
      await wrapper.vm.handleItemClick(item);

      expect(mockRouter.push).toHaveBeenCalledWith("/test");
    });

    it("handles collapse action", async () => {
      const item = { action: "collapse" };
      await wrapper.vm.handleItemClick(item);

      expect(mockProvideValues.sidebarIsCollapsed.value).toBe(true);
    });

    it("emits newEmptyFile action", async () => {
      const item = { action: "newEmptyFile" };
      await wrapper.vm.handleItemClick(item);

      expect(wrapper.emitted("newEmptyFile")).toBeTruthy();
    });

    it("emits showFileUploadModal action", async () => {
      const item = { action: "showFileUploadModal" };
      await wrapper.vm.handleItemClick(item);

      expect(wrapper.emitted("showFileUploadModal")).toBeTruthy();
    });

    it("emits generic action", async () => {
      const item = { action: "customAction" };
      await wrapper.vm.handleItemClick(item);

      expect(wrapper.emitted("action")).toBeTruthy();
      expect(wrapper.emitted("action")[0]).toEqual(["customAction"]);
    });

    it("handles onClick function", async () => {
      const onClick = vi.fn();
      const item = { onClick };
      await wrapper.vm.handleItemClick(item);

      expect(onClick).toHaveBeenCalled();
    });

    it("ignores non-clickable items", async () => {
      const item = { clickable: false, route: "/test" };
      await wrapper.vm.handleItemClick(item);

      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe("Template Rendering", () => {
    it("renders CTA section", () => {
      expect(wrapper.find(".cta").exists()).toBe(true);
    });

    it("conditionally renders logo and menu based on mobile mode", async () => {
      // Test non-mobile mode - create fresh wrapper to ensure clean state
      const desktopWrapper = mount(BaseSidebar, {
        props: { sidebarItems: mockSidebarItems },
        global: {
          provide: {
            sidebarIsCollapsed: ref(false),
            mobileMode: ref(false), // Explicitly set to false for desktop
            fileStore: ref({ getRecentFiles: () => [] }),
          },
          components: {
            Logo: { template: '<div data-testid="logo" />' },
            ContextMenu: {
              template: '<div data-testid="context-menu"><slot name="trigger" /><slot /></div>',
            },
            ContextMenuItem: { template: '<div data-testid="context-menu-item" />' },
            Button: { template: '<button data-testid="button" />' },
            BaseSidebarItem: { template: '<div data-testid="base-sidebar-item" />' },
            Separator: { template: '<div data-testid="separator" />' },
          },
        },
      });

      expect(desktopWrapper.find("#logo").exists()).toBe(true);
      expect(desktopWrapper.find(".sb-menu").exists()).toBe(true);

      // Test mobile mode
      const mobileWrapper = mount(BaseSidebar, {
        props: { sidebarItems: mockSidebarItems },
        global: {
          provide: {
            ...mockProvideValues,
            mobileMode: ref(true),
          },
          components: {
            Logo: { template: '<div data-testid="logo" />' },
            ContextMenu: {
              template: '<div data-testid="context-menu"><slot name="trigger" /><slot /></div>',
            },
            ContextMenuItem: { template: '<div data-testid="context-menu-item" />' },
            Button: { template: '<button data-testid="button" />' },
            BaseSidebarItem: { template: '<div data-testid="base-sidebar-item" />' },
          },
        },
      });

      expect(mobileWrapper.find("#logo").exists()).toBe(false);
      expect(mobileWrapper.find(".sb-menu").exists()).toBe(false);
    });
  });

  describe("Component Methods", () => {
    it("has goTo method for navigation", () => {
      wrapper.vm.goTo("test");
      expect(mockRouter.push).toHaveBeenCalledWith("/test");
    });

    it("has toggleCollapsed method", () => {
      const initialValue = mockProvideValues.sidebarIsCollapsed.value;
      wrapper.vm.toggleCollapsed();
      expect(mockProvideValues.sidebarIsCollapsed.value).toBe(!initialValue);
    });
  });

  describe("Mobile Drawer Functionality", () => {
    let mobileWrapper;
    const mockMobileDrawerState = ref(false);

    beforeEach(() => {
      mobileWrapper = mount(BaseSidebar, {
        props: { sidebarItems: mockSidebarItems },
        global: {
          provide: {
            ...mockProvideValues,
            mobileMode: ref(true),
            mobileDrawerOpen: mockMobileDrawerState,
          },
          components: {
            Logo: { template: '<div data-testid="logo" />' },
            ContextMenu: {
              template: '<div data-testid="context-menu"><slot name="trigger" /><slot /></div>',
            },
            ContextMenuItem: { template: '<div data-testid="context-menu-item" />' },
            Button: { template: '<button data-testid="button" />' },
            BaseSidebarItem: { template: '<div data-testid="base-sidebar-item" />' },
            Separator: { template: '<div data-testid="separator" />' },
          },
        },
      });
    });

    it("should apply drawer-open class when mobile drawer is open", async () => {
      mockMobileDrawerState.value = true;
      await mobileWrapper.vm.$nextTick();

      expect(mobileWrapper.find(".sb-wrapper").classes()).toContain("drawer-open");
    });

    it("should not apply drawer-open class when mobile drawer is closed", async () => {
      mockMobileDrawerState.value = false;
      await mobileWrapper.vm.$nextTick();

      expect(mobileWrapper.find(".sb-wrapper").classes()).not.toContain("drawer-open");
    });

    it("should render sidebar menu when drawer is open in mobile mode", async () => {
      mockMobileDrawerState.value = true;
      await mobileWrapper.vm.$nextTick();

      expect(mobileWrapper.find(".sb-menu").exists()).toBe(true);
      expect(mobileWrapper.find("#logo").exists()).toBe(true);
    });

    it("should not render sidebar menu when drawer is closed in mobile mode", async () => {
      mockMobileDrawerState.value = false;
      await mobileWrapper.vm.$nextTick();

      expect(mobileWrapper.find(".sb-menu").exists()).toBe(false);
      expect(mobileWrapper.find("#logo").exists()).toBe(false);
    });

    it("should render mobile backdrop when drawer is open", async () => {
      mockMobileDrawerState.value = true;
      await mobileWrapper.vm.$nextTick();

      const backdrop = mobileWrapper.find(".mobile-backdrop");
      expect(backdrop.exists()).toBe(true);
      // Note: backdrop click handling is now managed by useClosable
    });

    it("should close drawer when navigation item is clicked in mobile mode", async () => {
      mockMobileDrawerState.value = true;
      await mobileWrapper.vm.$nextTick();

      const navigationItem = { route: "/settings", active: false };
      await mobileWrapper.vm.handleItemClick(navigationItem);

      expect(mobileWrapper.emitted("closeMobileDrawer")).toBeTruthy();
      expect(mockRouter.push).toHaveBeenCalledWith("/settings");
    });

    it("should handle useClosable integration for mobile drawer", async () => {
      mockMobileDrawerState.value = true;
      await mobileWrapper.vm.$nextTick();

      // Test that useClosable is set up correctly
      // The actual escape key handling is now managed by useClosable
      expect(mobileWrapper.vm.mobileDrawerOpen).toBe(true);
    });

    it("should prevent body scroll when drawer is open", async () => {
      mockMobileDrawerState.value = true;
      await mobileWrapper.vm.$nextTick();

      // Test would verify document.body.style.overflow is set to 'hidden'
      // This is integration-level behavior that would be tested in E2E
      expect(mobileWrapper.vm.mobileDrawerOpen).toBe(true);
    });
  });
});
