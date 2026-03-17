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
          SelectBox: {
            name: "SelectBox",
            props: ["modelValue", "options", "label"],
            emits: ["update:modelValue"],
            template:
              '<div class="select-box-stub" :data-label="label"><label v-if="label" class="select-label">{{ label }}</label><span class="current-value">{{ currentLabel }}</span></div>',
            computed: {
              currentLabel() {
                const opt = (this.options || []).find(
                  (o) => (typeof o === "object" ? o.value : o) === this.modelValue
                );
                return opt ? (typeof opt === "object" ? opt.label : opt) : "";
              },
            },
          },
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
    it("uses SelectBox components instead of native selects", () => {
      const nativeSelects = wrapper.findAll("select");
      expect(nativeSelects.length).toBe(0);

      const selectBoxes = wrapper.findAllComponents({ name: "SelectBox" });
      expect(selectBoxes.length).toBe(5);
    });

    it("renders auto-save interval SelectBox with correct value and options", () => {
      const selectBox = wrapper
        .findAllComponents({ name: "SelectBox" })
        .find((c) => c.props("label") === "Auto-save interval");
      expect(selectBox).toBeDefined();
      expect(selectBox.props("modelValue")).toBe(30);
      expect(selectBox.props("options")).toEqual([
        { value: 10, label: "10 seconds" },
        { value: 30, label: "30 seconds" },
        { value: 60, label: "1 minute" },
        { value: 300, label: "5 minutes" },
      ]);
    });

    it("renders auto-compile delay SelectBox with correct value and options", () => {
      const selectBox = wrapper
        .findAllComponents({ name: "SelectBox" })
        .find((c) => c.props("label") === "Auto-compile delay");
      expect(selectBox).toBeDefined();
      expect(selectBox.props("modelValue")).toBe(1000);
      expect(selectBox.props("options")).toEqual([
        { value: 500, label: "500ms" },
        { value: 1000, label: "1 second" },
        { value: 2000, label: "2 seconds" },
        { value: 5000, label: "5 seconds" },
      ]);
    });

    it("renders mobile menu behavior SelectBox with correct value and options", () => {
      const selectBox = wrapper
        .findAllComponents({ name: "SelectBox" })
        .find((c) => c.props("label") === "Mobile menu behavior");
      expect(selectBox).toBeDefined();
      expect(selectBox.props("modelValue")).toBe("standard");
      expect(selectBox.props("options")).toEqual([
        { value: "standard", label: "Standard" },
        { value: "compact", label: "Compact" },
        { value: "minimal", label: "Minimal" },
      ]);
    });

    it("renders notification preference SelectBox", () => {
      const selectBox = wrapper
        .findAllComponents({ name: "SelectBox" })
        .find((c) => c.props("label") === "Notification method");
      expect(selectBox).toBeDefined();
      expect(selectBox.props("modelValue")).toBe("in-app");
    });

    it("renders email digest frequency SelectBox", () => {
      const selectBox = wrapper
        .findAllComponents({ name: "SelectBox" })
        .find((c) => c.props("label") === "Email digest frequency");
      expect(selectBox).toBeDefined();
      expect(selectBox.props("modelValue")).toBe("weekly");
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
            SelectBox: { template: "<div />" },
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

      expect(mockApi.post).toHaveBeenCalledWith(
        "/user-settings",
        expect.objectContaining({
          auto_save_interval: 30,
          notification_preference: "in-app",
        })
      );
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
    it("updates settings when SelectBox emits update", async () => {
      await wrapper.vm.$nextTick();

      const selectBox = wrapper
        .findAllComponents({ name: "SelectBox" })
        .find((c) => c.props("label") === "Auto-save interval");
      await selectBox.vm.$emit("update:modelValue", 60);

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
    it("has labels on all SelectBox components", () => {
      const selectBoxes = wrapper.findAllComponents({ name: "SelectBox" });
      selectBoxes.forEach((sb) => {
        expect(sb.props("label")).toBeTruthy();
      });
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

      const selectBox = wrapper
        .findAllComponents({ name: "SelectBox" })
        .find((c) => c.props("label") === "Auto-save interval");
      expect(selectBox.props("modelValue")).toBe(60);
    });
  });
});
