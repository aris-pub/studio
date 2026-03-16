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
            template: '<button data-testid="button" @click="$emit(\'click\')"><slot /></button>',
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
      const buttons = wrapper.findAllComponents({ name: "Button" });
      const saveButton = buttons.find((b) => b.text().includes("Save Settings"));
      expect(saveButton).toBeDefined();
    });
  });

  describe("Settings Management", () => {
    it("loads user settings on mount", async () => {
      await wrapper.vm.$nextTick();
      expect(mockApi.get).toHaveBeenCalledWith("/user-settings");
    });

    it("saves settings when save button is clicked", async () => {
      const buttons = wrapper.findAllComponents({ name: "Button" });
      const button = buttons.find((b) => b.text().includes("Save Settings"));
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

      const buttons = wrapper.findAllComponents({ name: "Button" });
      const button = buttons.find((b) => b.text().includes("Save Settings"));
      await button.trigger("click");
      await wrapper.vm.$nextTick();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to save user settings:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("Reset Button", () => {
    it("renders a reset button", () => {
      const buttons = wrapper.findAllComponents({ name: "Button" });
      const resetButton = buttons.find((b) => b.text().includes("Reset"));
      expect(resetButton).toBeDefined();
    });

    it("reset button is disabled when no changes have been made", () => {
      const buttons = wrapper.findAllComponents({ name: "Button" });
      const resetButton = buttons.find((b) => b.text().includes("Reset"));
      expect(resetButton.props("disabled")).toBe(true);
    });

    it("reset button is enabled after settings are changed", async () => {
      const serverSettings = {
        autoSaveInterval: 30,
        autoCompileDelay: 1000,
        focusModeAutoHide: true,
        sidebarAutoCollapse: false,
        drawerDefaultAnnotations: false,
        drawerDefaultMargins: false,
        drawerDefaultSettings: false,
        notificationPreference: "in-app",
        notificationMentions: true,
        notificationComments: true,
        notificationShares: true,
        notificationSystem: true,
        emailDigestFrequency: "weekly",
        allowAnonymousFeedback: false,
        soundNotifications: true,
        mobileMenuBehavior: "standard",
      };
      mockApi.get.mockResolvedValue({ data: serverSettings });

      wrapper = mount(PreferencesView, {
        global: {
          provide: { api: mockApi },
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
          },
        },
      });

      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      // Change a setting via the select element
      const select = wrapper.find("#auto-save-interval");
      await select.setValue(60);
      await wrapper.vm.$nextTick();

      const buttons = wrapper.findAllComponents({ name: "Button" });
      const resetButton = buttons.find((b) => b.text().includes("Reset"));
      expect(resetButton.props("disabled")).toBe(false);
    });

    it("restores original settings when reset is clicked", async () => {
      const serverSettings = {
        autoSaveInterval: 30,
        autoCompileDelay: 1000,
        focusModeAutoHide: true,
        sidebarAutoCollapse: false,
        drawerDefaultAnnotations: false,
        drawerDefaultMargins: false,
        drawerDefaultSettings: false,
        notificationPreference: "in-app",
        notificationMentions: true,
        notificationComments: true,
        notificationShares: true,
        notificationSystem: true,
        emailDigestFrequency: "weekly",
        allowAnonymousFeedback: false,
        soundNotifications: true,
        mobileMenuBehavior: "standard",
      };
      mockApi.get.mockResolvedValue({ data: serverSettings });

      wrapper = mount(PreferencesView, {
        global: {
          provide: { api: mockApi },
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
              template: '<button data-testid="button" @click="$emit(\'click\')"><slot /></button>',
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
          },
        },
      });

      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      // Change a setting
      const select = wrapper.find("#auto-save-interval");
      await select.setValue(60);
      await wrapper.vm.$nextTick();

      // Click reset
      const buttons = wrapper.findAllComponents({ name: "Button" });
      const resetButton = buttons.find((b) => b.text().includes("Reset"));
      await resetButton.trigger("click");
      await wrapper.vm.$nextTick();

      // Verify setting was restored
      expect(wrapper.find("#auto-save-interval").element.value).toBe("30");
    });
  });
});
