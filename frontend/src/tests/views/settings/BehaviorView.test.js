import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import PreferencesView from "@/views/settings/PreferencesView.vue";
import { toast } from "@/utils/toast.js";

vi.mock("@/utils/toast.js", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("PreferencesView", () => {
  let wrapper;
  const mockApi = {
    get: vi.fn().mockResolvedValue({
      data: {
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
      },
    }),
    post: vi.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.get.mockResolvedValue({
      data: {
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
      },
    });
    mockApi.post.mockResolvedValue({});

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
              '<div data-testid="section"><slot name="title" /><slot name="content" /></div>',
          },
          Checkbox: {
            name: "Checkbox",
            props: ["modelValue", "id"],
            template:
              '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" /><slot /></label>',
            emits: ["update:modelValue"],
          },
        },
        stubs: {
          IconSettings2: '<svg data-testid="icon-settings2" />',
        },
      },
    });
  });

  describe("Component Rendering", () => {
    it("renders the main pane", () => {
      expect(wrapper.find('[data-testid="pane"]').exists()).toBe(true);
    });

    it("renders the header with title", () => {
      expect(wrapper.text()).toContain("Preferences");
    });

    it("renders all settings sections", () => {
      const sections = wrapper.findAll('[data-testid="section"]');
      expect(sections.length).toBe(5);

      expect(wrapper.text()).toContain("Auto-save & Performance");
      expect(wrapper.text()).toContain("Editor");
      expect(wrapper.text()).toContain("Notifications");
      expect(wrapper.text()).toContain("Interaction & Privacy");
      expect(wrapper.text()).toContain("Mobile");
    });
  });

  describe("Settings Form Elements", () => {
    it("renders auto-save interval select", () => {
      const autoSaveSelect = wrapper.find("#auto-save-interval");
      expect(autoSaveSelect.exists()).toBe(true);
      expect(autoSaveSelect.element.value).toBe("30");

      const options = autoSaveSelect.findAll("option");
      expect(options.length).toBe(4);
      expect(options[0].text()).toBe("10 seconds");
      expect(options[1].text()).toBe("30 seconds");
      expect(options[2].text()).toBe("1 minute");
      expect(options[3].text()).toBe("5 minutes");
    });

    it("renders auto-compile delay select", () => {
      const autoCompileSelect = wrapper.find("#auto-compile-delay");
      expect(autoCompileSelect.exists()).toBe(true);
      expect(autoCompileSelect.element.value).toBe("1000");

      const options = autoCompileSelect.findAll("option");
      expect(options.length).toBe(4);
      expect(options[0].text()).toBe("500ms");
      expect(options[1].text()).toBe("1 second");
      expect(options[2].text()).toBe("2 seconds");
      expect(options[3].text()).toBe("5 seconds");
    });

    it("renders mobile menu behavior select", () => {
      const mobileMenuSelect = wrapper.find("#mobile-menu-behavior");
      expect(mobileMenuSelect.exists()).toBe(true);
      expect(mobileMenuSelect.element.value).toBe("standard");

      const options = mobileMenuSelect.findAll("option");
      expect(options.length).toBe(3);
      expect(options[0].text()).toBe("Standard");
      expect(options[1].text()).toBe("Compact");
      expect(options[2].text()).toBe("Minimal");
    });

    it("renders notification preference select", () => {
      const select = wrapper.find("#notification-preference");
      expect(select.exists()).toBe(true);
      expect(select.element.value).toBe("in-app");
    });

    it("renders email digest frequency select", () => {
      const select = wrapper.find("#email-digest");
      expect(select.exists()).toBe(true);
      expect(select.element.value).toBe("weekly");
    });
  });

  describe("Checkbox Settings", () => {
    it("renders focus mode auto-hide checkbox", () => {
      const checkbox = wrapper.findComponent({ name: "Checkbox" });
      expect(checkbox.exists()).toBe(true);
      expect(checkbox.props("id")).toBe("focus-mode-auto-hide");
    });

    it("renders all drawer default checkboxes", () => {
      const checkboxes = wrapper.findAllComponents({ name: "Checkbox" });
      const drawerCheckboxes = checkboxes.filter((checkbox) =>
        checkbox.props("id")?.includes("drawer")
      );
      expect(drawerCheckboxes.length).toBe(3);

      expect(wrapper.text()).toContain("Open annotations drawer by default");
      expect(wrapper.text()).toContain("Open margins drawer by default");
      expect(wrapper.text()).toContain("Open settings drawer by default");
    });

    it("renders sidebar auto-collapse checkbox", () => {
      expect(wrapper.text()).toContain("Auto-collapse sidebar");
    });

    it("renders sound notifications checkbox", () => {
      expect(wrapper.text()).toContain("Enable sound notifications");
    });

    it("renders notification type checkboxes", () => {
      expect(wrapper.text()).toContain("Mentions");
      expect(wrapper.text()).toContain("Comments");
      expect(wrapper.text()).toContain("Shares and collaboration invites");
      expect(wrapper.text()).toContain("System updates");
    });

    it("renders anonymous feedback checkbox", () => {
      expect(wrapper.text()).toContain("Allow anonymous feedback and comments");
    });
  });

  describe("Settings Loading", () => {
    it("loads settings from API on mount", async () => {
      await wrapper.vm.$nextTick();

      expect(mockApi.get).toHaveBeenCalledWith("/user-settings");
      expect(wrapper.vm.settings.autoSaveInterval).toBe(30);
      expect(wrapper.vm.settings.focusModeAutoHide).toBe(true);
      expect(wrapper.vm.settings.sidebarAutoCollapse).toBe(false);
      expect(wrapper.vm.settings.notificationPreference).toBe("in-app");
    });

    it("handles settings load errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockApi.get.mockRejectedValue(new Error("Load failed"));

      const errorWrapper = mount(PreferencesView, {
        global: {
          provide: { api: mockApi },
          components: {
            Pane: { template: "<div><slot /></div>" },
            Section: { props: ["variant"], template: '<div><slot name="content" /></div>' },
            Checkbox: { template: "<div />" },
          },
          stubs: {
            IconSettings2: '<svg data-testid="icon-settings2" />',
          },
        },
      });

      await errorWrapper.vm.$nextTick();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to load user settings:", expect.any(Error));
      expect(toast.error).toHaveBeenCalledWith("Failed to load preferences", {
        description: "Your default settings are being used. Please try refreshing the page.",
      });
      consoleSpy.mockRestore();
    });
  });

  describe("Settings Saving", () => {
    it("saves settings when save button clicked", async () => {
      await wrapper.vm.$nextTick();

      const saveButton = wrapper.find("[data-testid='save-settings-button']");
      expect(saveButton.exists()).toBe(true);

      await saveButton.trigger("click");

      expect(mockApi.post).toHaveBeenCalledWith("/user-settings", wrapper.vm.settings);
    });

    it("shows loading state during save", async () => {
      await wrapper.vm.$nextTick();

      mockApi.post.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const saveButton = wrapper.find("[data-testid='save-settings-button']");
      await saveButton.trigger("click");

      expect(wrapper.vm.loading).toBe(true);
      expect(saveButton.text()).toBe("Saving...");
      expect(saveButton.element.disabled).toBe(true);
    });

    it("shows saved state after successful save", async () => {
      await wrapper.vm.$nextTick();

      const saveButton = wrapper.find("[data-testid='save-settings-button']");
      await saveButton.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.saved).toBe(true);
      expect(saveButton.text()).toBe("Saved!");
      expect(saveButton.classes()).toContain("saved");

      setTimeout(() => {
        expect(wrapper.vm.saved).toBe(false);
      }, 2100);
    });

    it("handles save errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockApi.post.mockRejectedValue(new Error("Save failed"));

      await wrapper.vm.$nextTick();

      const saveButton = wrapper.find("[data-testid='save-settings-button']");
      await saveButton.trigger("click");

      expect(wrapper.vm.loading).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to save user settings:", expect.any(Error));
      expect(toast.error).toHaveBeenCalledWith("Failed to save preferences", {
        description: "Please check your connection and try again.",
      });
      consoleSpy.mockRestore();
    });
  });

  describe("Form Interactions", () => {
    it("updates settings when select values change", async () => {
      await wrapper.vm.$nextTick();

      const autoSaveSelect = wrapper.find("#auto-save-interval");
      await autoSaveSelect.setValue("60");

      expect(wrapper.vm.settings.autoSaveInterval).toBe(60);
    });

    it("updates settings when checkbox values change", async () => {
      await wrapper.vm.$nextTick();

      const checkbox = wrapper.findComponent({ name: "Checkbox" });
      await checkbox.vm.$emit("update:modelValue", false);

      expect(wrapper.vm.settings.focusModeAutoHide).toBe(false);
    });
  });

  describe("Accessibility", () => {
    it("has proper form labels", () => {
      expect(wrapper.find('label[for="auto-save-interval"]').exists()).toBe(true);
      expect(wrapper.find('label[for="auto-compile-delay"]').exists()).toBe(true);
      expect(wrapper.find('label[for="mobile-menu-behavior"]').exists()).toBe(true);
      expect(wrapper.find('label[for="notification-preference"]').exists()).toBe(true);
      expect(wrapper.find('label[for="email-digest"]').exists()).toBe(true);
    });

    it("has descriptive text for settings", () => {
      expect(wrapper.text()).toContain(
        "Automatically hide navigation and toolbars when entering focus mode"
      );
      expect(wrapper.text()).toContain("Play audio feedback for actions and notifications");
      expect(wrapper.text()).toContain("Set the default open/closed state for workspace drawers");
      expect(wrapper.text()).toContain(
        "Choose how you want to receive notifications about activity on your content"
      );
    });
  });

  describe("Component State", () => {
    it("initializes with default settings", () => {
      expect(wrapper.vm.settings.autoSaveInterval).toBe(30);
      expect(wrapper.vm.settings.focusModeAutoHide).toBe(true);
      expect(wrapper.vm.settings.soundNotifications).toBe(true);
      expect(wrapper.vm.settings.notificationPreference).toBe("in-app");
      expect(wrapper.vm.settings.emailDigestFrequency).toBe("weekly");
      expect(wrapper.vm.loading).toBe(false);
      expect(wrapper.vm.saved).toBe(false);
    });

    it("handles reactive settings updates", async () => {
      await wrapper.vm.$nextTick();

      wrapper.vm.settings.autoSaveInterval = 60;
      await wrapper.vm.$nextTick();

      const autoSaveSelect = wrapper.find("#auto-save-interval");
      expect(autoSaveSelect.element.value).toBe("60");
    });
  });
});
