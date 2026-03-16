import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import PreferencesView from "@/views/settings/PreferencesView.vue";

describe("PreferencesView", () => {
  let wrapper;

  const mockApi = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();

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
          SelectBox: {
            name: "SelectBox",
            props: ["modelValue", "options", "label"],
            template:
              '<div data-testid="select-box"><span class="select-label">{{ label }}</span></div>',
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

  describe("SelectBox Usage", () => {
    it("uses SelectBox components instead of native selects", () => {
      const nativeSelects = wrapper.findAll("select");
      expect(nativeSelects.length).toBe(0);
    });

    it("renders five SelectBox components for dropdown settings", () => {
      const selectBoxes = wrapper.findAll('[data-testid="select-box"]');
      expect(selectBoxes.length).toBe(5);
    });

    it("passes label props to SelectBox components", () => {
      const selectBoxes = wrapper.findAllComponents({ name: "SelectBox" });
      const labels = selectBoxes.map((sb) => sb.props("label"));
      expect(labels).toContain("Auto-save interval");
      expect(labels).toContain("Auto-compile delay");
      expect(labels).toContain("Notification method");
      expect(labels).toContain("Email digest frequency");
      expect(labels).toContain("Mobile menu behavior");
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
