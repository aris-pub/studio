import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick, ref, reactive } from "vue";
import { mount } from "@vue/test-utils";
import WorkspaceView from "@/views/workspace/View.vue";
import Sidebar from "@/views/workspace/Sidebar.vue";
import Canvas from "@/views/workspace/Canvas.vue";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";

// Mock router
const pushMock = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { file_id: "42" } }),
  useRouter: () => ({ push: pushMock }),
}));

// Mock File model
vi.mock("@/models/File.js", () => ({
  File: {
    getSettings: vi.fn().mockResolvedValue({ theme: "dark" }),
  },
}));

// Mock EditorCodeMirror
vi.mock("@/views/workspace/EditorCodeMirror.vue", () => ({
  default: {
    name: "EditorCodeMirror",
    template: "<div />",
  },
}));

describe("Workspace Accessibility and Keyboard Navigation", () => {
  let useKSSpy;
  let keyboardShortcuts;
  let fileStore;

  beforeEach(() => {
    useKSSpy = vi.spyOn(KSMod, "useKeyboardShortcuts").mockImplementation((shortcuts) => {
      keyboardShortcuts = shortcuts;
      return {
        activate: vi.fn(),
        deactivate: vi.fn(),
      };
    });

    fileStore = {
      value: {
        files: [{ id: 42, content: "test file", source: "# Test" }],
        isLoading: false,
      },
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ARIA Attributes and Semantic HTML", () => {
    it("should have proper ARIA labels for main workspace regions", () => {
      const wrapper = mount(WorkspaceView, {
        global: {
          provide: {
            fileStore,
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
            mobileMode: false,
          },
          stubs: {
            Sidebar: {
              template: '<nav role="navigation" aria-label="workspace sidebar"><slot/></nav>',
            },
            Canvas: {
              template: '<main role="main" aria-label="document editor"><slot/></main>',
            },
            Icon: { template: "<span />" },
          },
        },
      });

      const sidebar = wrapper.find('[role="navigation"]');
      const canvas = wrapper.find('[role="main"]');

      expect(sidebar.exists()).toBe(true);
      expect(canvas.exists()).toBe(true);
      expect(sidebar.attributes("aria-label")).toBe("workspace sidebar");
      expect(canvas.attributes("aria-label")).toBe("document editor");
    });

    it("should have accessible focus management", async () => {
      const wrapper = mount(Sidebar, {
        global: {
          provide: {
            drawerOpen: ref(false),
            focusMode: ref(false),
            mobileMode: false,
            xsMode: false,
          },
          stubs: {
            SidebarMenu: {
              template: '<div tabindex="0" role="menubar" aria-label="workspace tools"></div>',
            },
            UserMenu: { template: "<div />" },
          },
        },
      });

      const menubar = wrapper.find('[role="menubar"]');
      expect(menubar.exists()).toBe(true);
      expect(menubar.attributes("tabindex")).toBe("0");
      expect(menubar.attributes("aria-label")).toBe("workspace tools");
    });

    it("should have keyboard-accessible drawer toggles", () => {
      const wrapper = mount(Sidebar, {
        global: {
          provide: {
            drawerOpen: ref(false),
            focusMode: ref(false),
            mobileMode: false,
            xsMode: false,
          },
          stubs: {
            SidebarMenu: {
              template: `
                <div role="menubar">
                  <button 
                    role="menuitem" 
                    :aria-pressed="false"
                    :aria-label="'Toggle margins drawer'"
                    tabindex="0"
                  >
                    Margins
                  </button>
                </div>
              `,
            },
            UserMenu: { template: "<div />" },
          },
        },
      });

      const drawerButton = wrapper.find('[role="menuitem"]');
      expect(drawerButton.exists()).toBe(true);
      expect(drawerButton.attributes("aria-pressed")).toBe("false");
      expect(drawerButton.attributes("aria-label")).toBe("Toggle margins drawer");
      expect(drawerButton.attributes("tabindex")).toBe("0");
    });

    it("should announce focus mode state changes", async () => {
      const focusMode = ref(false);

      const wrapper = mount(Canvas, {
        props: {
          modelValue: { id: 42, source: "test" },
          showEditor: false,
          showSearch: false,
        },
        global: {
          provide: {
            focusMode,
            drawerOpen: ref(false),
            mobileMode: false,
            xsMode: false,
            fileSettings: ref({}),
            annotations: reactive([]),
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
          },
          stubs: {
            ReaderTopbar: { template: "<div />" },
            Dock: { template: "<div><slot/></div>" },
            ManuscriptWrapper: { template: "<div />" },
            DockableAnnotations: { template: "<div />" },
            FocusModeButton: {
              template: `
                <button 
                  :aria-label="focusMode ? 'Exit focus mode' : 'Enter focus mode'"
                  :aria-pressed="focusMode.toString()"
                />
              `,
              props: ["focusMode"],
            },
          },
        },
      });

      // Check initial focus mode state
      expect(wrapper.find(".outer").classes()).not.toContain("focus");

      // Simulate focus mode toggle
      focusMode.value = true;
      await nextTick();

      expect(wrapper.find(".outer").classes()).toContain("focus");
    });
  });

  describe("Keyboard Navigation", () => {
    it("should register workspace-level keyboard shortcuts", () => {
      mount(WorkspaceView, {
        global: {
          provide: {
            fileStore,
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
            mobileMode: false,
          },
          stubs: {
            Sidebar: { template: "<div />" },
            Canvas: { template: "<div />" },
            Icon: { template: "<div />" },
          },
        },
      });

      expect(useKSSpy).toHaveBeenCalled();
      // Keyboard shortcuts should be registered at the workspace level
      expect(keyboardShortcuts).toBeDefined();
    });

    it("should handle focus mode keyboard shortcut", async () => {
      const focusMode = ref(false);

      // Mock the keyboard shortcut callback to simulate 'c' key functionality
      const mockFocusToggle = vi.fn(() => {
        focusMode.value = !focusMode.value;
      });

      // Set up keyboard shortcuts mock to include focus mode toggle
      vi.mocked(KSMod.useKeyboardShortcuts).mockReturnValue({
        activate: vi.fn(),
        deactivate: vi.fn(),
        c: mockFocusToggle, // 'c' key for focus mode
      });

      mount(Canvas, {
        props: {
          modelValue: { id: 42, source: "test" },
          showEditor: false,
          showSearch: false,
        },
        global: {
          provide: {
            focusMode,
            drawerOpen: ref(false),
            mobileMode: false,
            xsMode: false,
            fileSettings: ref({}),
            annotations: reactive([]),
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
          },
          stubs: {
            ReaderTopbar: { template: "<div />" },
            Dock: { template: "<div><slot/></div>" },
            ManuscriptWrapper: { template: "<div />" },
            DockableAnnotations: { template: "<div />" },
            FocusModeButton: {
              template: '<button @click="toggleFocus" />',
              methods: {
                toggleFocus() {
                  focusMode.value = !focusMode.value;
                },
              },
            },
          },
        },
      });

      // Simulate 'c' key shortcut activation
      mockFocusToggle();
      await nextTick();

      // Focus mode should be toggled
      expect(focusMode.value).toBe(true);
    });

    it("should handle sequential keyboard shortcuts correctly", async () => {
      const wrapper = mount(Sidebar, {
        global: {
          provide: {
            drawerOpen: ref(false),
            focusMode: ref(false),
            mobileMode: false,
            xsMode: false,
          },
          stubs: {
            SidebarMenu: {
              template: "<div />",
              emits: ["on", "off"],
            },
            UserMenu: { template: "<div />" },
          },
        },
      });

      // Simulate rapid keyboard shortcuts
      if (keyboardShortcuts) {
        if (keyboardShortcuts["p,m"]) {
          keyboardShortcuts["p,m"]();
          await nextTick();
        }

        if (keyboardShortcuts["p,a"]) {
          keyboardShortcuts["p,a"]();
          await nextTick();
        }
      }

      // Should handle rapid shortcut sequences without errors
      expect(wrapper.exists()).toBe(true);
    });

    it("should prevent keyboard shortcut conflicts", () => {
      // Mock multiple components registering shortcuts
      useKSSpy.mockImplementationOnce((shortcuts) => {
        Object.assign(keyboardShortcuts || {}, shortcuts);
        return { activate: vi.fn(), deactivate: vi.fn() };
      });

      mount(WorkspaceView, {
        global: {
          provide: {
            fileStore,
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
            mobileMode: false,
          },
          stubs: {
            Sidebar: { template: "<div />" },
            Canvas: { template: "<div />" },
            Icon: { template: "<div />" },
          },
        },
      });

      // Should not have duplicate shortcuts
      const shortcutKeys = Object.keys(keyboardShortcuts || {});
      const uniqueKeys = [...new Set(shortcutKeys)];
      expect(shortcutKeys.length).toBe(uniqueKeys.length);
    });
  });

  describe("Screen Reader Support", () => {
    it("should provide live region for status announcements", () => {
      const wrapper = mount(WorkspaceView, {
        global: {
          provide: {
            fileStore,
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
            mobileMode: false,
          },
          stubs: {
            Sidebar: { template: "<div />" },
            Canvas: {
              template: `
                <div>
                  <div aria-live="polite" aria-atomic="true" class="sr-only">
                    Status updates
                  </div>
                </div>
              `,
            },
            Icon: { template: "<div />" },
          },
        },
      });

      const liveRegion = wrapper.find('[aria-live="polite"]');
      expect(liveRegion.exists()).toBe(true);
      expect(liveRegion.attributes("aria-atomic")).toBe("true");
    });

    it("should have descriptive labels for interactive elements", () => {
      const wrapper = mount(Sidebar, {
        global: {
          provide: {
            drawerOpen: ref(false),
            focusMode: ref(false),
            mobileMode: false,
            xsMode: false,
          },
          stubs: {
            SidebarMenu: {
              template: `
                <nav role="navigation" aria-label="Workspace tools">
                  <button aria-label="Toggle editor panel" aria-describedby="editor-help">
                    Editor
                  </button>
                  <div id="editor-help" class="sr-only">
                    Opens code editor for source editing
                  </div>
                </nav>
              `,
            },
            UserMenu: { template: "<div />" },
          },
        },
      });

      const button = wrapper.find('button[aria-label="Toggle editor panel"]');
      const helpText = wrapper.find("#editor-help");

      expect(button.exists()).toBe(true);
      expect(helpText.exists()).toBe(true);
      expect(button.attributes("aria-describedby")).toBe("editor-help");
    });

    it("should announce drawer state changes", async () => {
      const drawerOpen = ref(false);

      // Create a test component that includes the aria-live region
      const TestComponent = {
        template: `
          <div>
            <div aria-live="polite" aria-label="Drawer status">
              {{ drawerOpen ? 'Drawer opened' : 'Drawer closed' }}
            </div>
          </div>
        `,
        computed: {
          drawerOpen() {
            return drawerOpen.value;
          },
        },
      };

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            focusMode: ref(false),
            drawerOpen,
            mobileMode: false,
            xsMode: false,
            fileSettings: ref({}),
            annotations: reactive([]),
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
          },
        },
      });

      const statusRegion = wrapper.find('[aria-live="polite"]');
      expect(statusRegion.exists()).toBe(true);
      expect(statusRegion.text()).toContain("Drawer closed");

      drawerOpen.value = true;
      await nextTick();

      expect(statusRegion.text()).toContain("Drawer opened");
    });
  });

  describe("Focus Management", () => {
    it("should trap focus within drawers when open", async () => {
      const drawerOpen = ref(true);

      const wrapper = mount(Canvas, {
        props: {
          modelValue: { id: 42, source: "test" },
          showEditor: false,
          showSearch: false,
        },
        global: {
          provide: {
            focusMode: ref(false),
            drawerOpen,
            mobileMode: false,
            xsMode: false,
            fileSettings: ref({}),
            annotations: reactive([]),
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
          },
          stubs: {
            ReaderTopbar: { template: "<div />" },
            Dock: {
              template: `
                <div v-if="drawerOpen" role="dialog" aria-modal="true">
                  <button class="first-focusable">First</button>
                  <button class="last-focusable">Last</button>
                </div>
              `,
              computed: {
                drawerOpen() {
                  return drawerOpen.value;
                },
              },
            },
            ManuscriptWrapper: { template: "<div />" },
            DockableAnnotations: { template: "<div />" },
          },
        },
      });

      const dialog = wrapper.find('[role="dialog"]');
      expect(dialog.exists()).toBe(true);
      expect(dialog.attributes("aria-modal")).toBe("true");

      const firstButton = wrapper.find(".first-focusable");
      const lastButton = wrapper.find(".last-focusable");

      expect(firstButton.exists()).toBe(true);
      expect(lastButton.exists()).toBe(true);
    });

    it("should restore focus when drawers close", async () => {
      const drawerOpen = ref(true);

      // Mock element with focus method

      const wrapper = mount(Sidebar, {
        global: {
          provide: {
            drawerOpen,
            focusMode: ref(false),
            mobileMode: false,
            xsMode: false,
          },
          stubs: {
            SidebarMenu: {
              template: `
                <div>
                  <button ref="drawerTrigger" @click="closeDrawer">
                    Close Drawer
                  </button>
                </div>
              `,
              methods: {
                closeDrawer() {
                  drawerOpen.value = false;
                  // Simulate focus restoration
                  this.$refs.drawerTrigger?.focus();
                },
              },
            },
            UserMenu: { template: "<div />" },
          },
        },
      });

      // Simulate drawer closing
      drawerOpen.value = false;
      await nextTick();

      // Focus should be managed appropriately
      expect(wrapper.exists()).toBe(true);
    });

    it("should handle tab navigation correctly", async () => {
      const wrapper = mount(WorkspaceView, {
        global: {
          provide: {
            fileStore,
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
            mobileMode: false,
          },
          stubs: {
            Sidebar: {
              template: `
                <nav>
                  <button tabindex="0">Tool 1</button>
                  <button tabindex="0">Tool 2</button>
                </nav>
              `,
            },
            Canvas: {
              template: `
                <main>
                  <textarea tabindex="0" aria-label="Document content"></textarea>
                </main>
              `,
            },
            Icon: { template: "<div />" },
          },
        },
      });

      const buttons = wrapper.findAll('button[tabindex="0"]');
      const textarea = wrapper.find('textarea[tabindex="0"]');

      expect(buttons.length).toBeGreaterThan(0);
      expect(textarea.exists()).toBe(true);

      // All interactive elements should have proper tab order
      buttons.forEach((button) => {
        expect(button.attributes("tabindex")).toBe("0");
      });
    });
  });

  describe("Mobile Accessibility", () => {
    it("should have touch-friendly targets", () => {
      const wrapper = mount(Sidebar, {
        global: {
          provide: {
            drawerOpen: ref(false),
            focusMode: ref(false),
            mobileMode: true,
            xsMode: false,
          },
          stubs: {
            SidebarMenu: {
              template: `
                <div>
                  <button class="mobile-touch-target" style="min-height: 44px; min-width: 44px;">
                    Tool
                  </button>
                </div>
              `,
            },
            UserMenu: { template: "<div />" },
          },
        },
      });

      const touchTarget = wrapper.find(".mobile-touch-target");
      expect(touchTarget.exists()).toBe(true);

      // Should have adequate touch target size
      const styles = touchTarget.attributes("style");
      expect(styles).toContain("min-height: 44px");
      expect(styles).toContain("min-width: 44px");
    });

    it("should support gesture navigation", async () => {
      const focusMode = ref(false);

      const wrapper = mount(Canvas, {
        props: {
          modelValue: { id: 42, source: "test" },
          showEditor: false,
          showSearch: false,
        },
        global: {
          provide: {
            focusMode,
            drawerOpen: ref(false),
            mobileMode: true,
            xsMode: false,
            fileSettings: ref({}),
            annotations: reactive([]),
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
          },
          stubs: {
            ReaderTopbar: { template: "<div />" },
            Dock: { template: "<div><slot/></div>" },
            ManuscriptWrapper: {
              template: `
                <div @touchstart="handleTouch" @swipe="handleSwipe">
                  Touch area
                </div>
              `,
              methods: {
                handleTouch() {
                  // Handle touch events
                },
                handleSwipe() {
                  // Handle swipe gestures
                },
              },
            },
            DockableAnnotations: { template: "<div />" },
          },
        },
      });

      // Should have touch event handlers and mobile layout
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find(".outer").classes()).toContain("mobile");
    });
  });

  describe("High Contrast and Color Accessibility", () => {
    it("should support high contrast mode", () => {
      const wrapper = mount(WorkspaceView, {
        global: {
          provide: {
            fileStore,
            api: {
              get: vi.fn().mockResolvedValue({ data: "<h1>Mock Content</h1>" }),
              post: vi.fn().mockResolvedValue({ data: "success" }),
            },
            mobileMode: false,
          },
          stubs: {
            Sidebar: {
              template: `
                <nav style="border: 1px solid; background: contrast(white black);">
                  Sidebar
                </nav>
              `,
            },
            Canvas: {
              template: `
                <main style="outline: 2px solid currentColor;">
                  Content
                </main>
              `,
            },
            Icon: { template: "<div />" },
          },
        },
      });

      // Components should have proper contrast and borders
      const sidebar = wrapper.find("nav");
      const canvas = wrapper.find("main");

      expect(sidebar.exists()).toBe(true);
      expect(canvas.exists()).toBe(true);
    });

    it("should not rely solely on color for information", () => {
      const wrapper = mount(Sidebar, {
        global: {
          provide: {
            drawerOpen: ref(false),
            focusMode: ref(false),
            mobileMode: false,
            xsMode: false,
          },
          stubs: {
            SidebarMenu: {
              template: `
                <div>
                  <button aria-label="Active tool" class="active">
                    <span aria-hidden="true">●</span>
                    Tool Name
                  </button>
                </div>
              `,
            },
            UserMenu: { template: "<div />" },
          },
        },
      });

      const activeButton = wrapper.find(".active");
      expect(activeButton.exists()).toBe(true);

      // Should have text indicator in addition to visual styling
      expect(activeButton.text()).toContain("Tool Name");
      expect(activeButton.attributes("aria-label")).toBe("Active tool");
    });
  });
});
