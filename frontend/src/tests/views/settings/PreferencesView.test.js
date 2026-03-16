import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import PreferencesView from "@/views/settings/PreferencesView.vue";

let routeLeaveGuard = null;
vi.mock("vue-router", () => ({
  onBeforeRouteLeave: (guard) => {
    routeLeaveGuard = guard;
  },
}));

describe("PreferencesView", () => {
  let wrapper;

  const mockApi = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    routeLeaveGuard = null;

    wrapper = mount(PreferencesView, {
      global: {
        provide: {
          api: mockApi,
        },
        components: {
          Pane: {
            name: "Pane",
            template:
              '<div data-testid="pane"><header data-testid="pane-header"><slot name="header" /></header><div data-testid="pane-content"><slot /></div></div>',
          },
          Section: {
            name: "Section",
            props: ["variant"],
            template:
              '<div data-testid="section"><div data-testid="section-title"><slot name="title" /></div><div data-testid="section-content"><slot name="content" /></div></div>',
          },
          Button: {
            name: "Button",
            props: ["disabled", "kind"],
            template: '<button data-testid="button"><slot /></button>',
          },
          Checkbox: {
            name: "Checkbox",
            props: ["modelValue", "id"],
            template: '<label data-testid="checkbox"><slot /></label>',
          },
        },
        stubs: {
          IconSettings2: {
            name: "IconSettings2",
            template: '<svg data-testid="icon-settings2" />',
          },
          Icon: {
            name: "Icon",
            props: ["name", "size"],
            template: '<svg data-testid="icon" />',
          },
        },
      },
    });
  });

  describe("Heading Hierarchy", () => {
    it("uses h1 as the top-level heading for proper WCAG hierarchy", () => {
      const heading = wrapper.find('[data-testid="pane-header"] h1');
      expect(heading.exists()).toBe(true);
      expect(heading.text()).toBe("Preferences");
    });

    it("does not use h3 for the page heading", () => {
      const h3 = wrapper.find('[data-testid="pane-header"] h3');
      expect(h3.exists()).toBe(false);
    });
  });

  describe("Component Rendering", () => {
    it("renders the main pane", () => {
      expect(wrapper.find('[data-testid="pane"]').exists()).toBe(true);
    });

    it("renders all five setting sections", () => {
      const sections = wrapper.findAll('[data-testid="section"]');
      expect(sections.length).toBe(5);
    });

    it("renders the save button", () => {
      const button = wrapper.findComponent({ name: "Button" });
      expect(button.exists()).toBe(true);
      expect(button.text()).toContain("Save Settings");
    });
  });

  describe("Unsaved Changes Detection", () => {
    it("detects unsaved changes when a setting differs from saved values", async () => {
      await nextTick();

      // Initially no unsaved changes
      expect(wrapper.vm.hasUnsavedChanges).toBe(false);

      // Modify a setting
      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();

      expect(wrapper.vm.hasUnsavedChanges).toBe(true);
    });

    it("clears unsaved state after successful save", async () => {
      await nextTick();

      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();
      expect(wrapper.vm.hasUnsavedChanges).toBe(true);

      // Trigger save
      const button = wrapper.findComponent({ name: "Button" });
      await button.trigger("click");
      await nextTick();

      expect(wrapper.vm.hasUnsavedChanges).toBe(false);
    });

    it("detects changes across multiple setting types", async () => {
      await nextTick();

      wrapper.vm.settings.focusModeAutoHide = false;
      wrapper.vm.settings.notificationPreference = "email";
      await nextTick();

      expect(wrapper.vm.hasUnsavedChanges).toBe(true);
    });
  });

  describe("Browser Navigation Protection", () => {
    beforeEach(() => {
      window.addEventListener = vi.fn();
      window.removeEventListener = vi.fn();
    });

    it("adds beforeunload listener when there are unsaved changes", async () => {
      await nextTick();

      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();

      expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });

    it("removes beforeunload listener when changes are reverted", async () => {
      await nextTick();

      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();

      // Revert to original
      wrapper.vm.settings.autoSaveInterval = 30;
      await nextTick();

      expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });

    it("removes beforeunload listener on component unmount", async () => {
      await nextTick();
      wrapper.unmount();
      expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });
  });

  describe("Unsaved Changes Warning Banner", () => {
    it("shows warning banner when there are unsaved changes", async () => {
      await nextTick();

      expect(wrapper.find(".status-message.warning").exists()).toBe(false);

      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();

      const warning = wrapper.find(".status-message.warning");
      expect(warning.exists()).toBe(true);
      expect(warning.text()).toContain("You have unsaved changes");
    });

    it("hides warning banner when changes are reverted", async () => {
      await nextTick();

      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();
      expect(wrapper.find(".status-message.warning").exists()).toBe(true);

      wrapper.vm.settings.autoSaveInterval = 30;
      await nextTick();
      expect(wrapper.find(".status-message.warning").exists()).toBe(false);
    });

    it("hides warning banner after successful save", async () => {
      await nextTick();

      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();
      expect(wrapper.find(".status-message.warning").exists()).toBe(true);

      const button = wrapper.findComponent({ name: "Button" });
      await button.trigger("click");
      await nextTick();

      expect(wrapper.find(".status-message.warning").exists()).toBe(false);
    });

    it("has correct accessibility attributes", async () => {
      await nextTick();

      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();

      const warning = wrapper.find(".status-message.warning");
      expect(warning.attributes("role")).toBe("status");
      expect(warning.attributes("aria-live")).toBe("polite");
    });
  });

  describe("In-App Navigation Protection", () => {
    it("registers a route leave guard", () => {
      expect(routeLeaveGuard).toBeTypeOf("function");
    });

    it("allows navigation when there are no unsaved changes", async () => {
      await nextTick();
      const result = routeLeaveGuard();
      expect(result).not.toBe(false);
    });

    it("blocks navigation when user cancels and there are unsaved changes", async () => {
      await nextTick();
      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();

      vi.spyOn(window, "confirm").mockReturnValue(false);
      const result = routeLeaveGuard();
      expect(window.confirm).toHaveBeenCalled();
      expect(result).toBe(false);
      window.confirm.mockRestore();
    });

    it("allows navigation when user confirms and there are unsaved changes", async () => {
      await nextTick();
      wrapper.vm.settings.autoSaveInterval = 60;
      await nextTick();

      vi.spyOn(window, "confirm").mockReturnValue(true);
      const result = routeLeaveGuard();
      expect(window.confirm).toHaveBeenCalled();
      expect(result).not.toBe(false);
      window.confirm.mockRestore();
    });
  });

  describe("Settings Management", () => {
    it("loads user settings on mount", async () => {
      await wrapper.vm.$nextTick();
      expect(mockApi.get).toHaveBeenCalledWith("/user-settings");
    });

    it("saves settings when save button is clicked", async () => {
      const button = wrapper.findComponent({ name: "Button" });
      await button.trigger("click");

      expect(mockApi.post).toHaveBeenCalledWith(
        "/user-settings",
        expect.objectContaining({
          autoSaveInterval: 30,
          notificationPreference: "in-app",
        })
      );
    });

    it("handles save errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockApi.post.mockRejectedValue(new Error("Save failed"));

      const button = wrapper.findComponent({ name: "Button" });
      await button.trigger("click");
      await wrapper.vm.$nextTick();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to save user settings:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
