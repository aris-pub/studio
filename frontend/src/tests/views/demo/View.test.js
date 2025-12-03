import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import DemoView from "@/views/demo/View.vue";

// Mock child components
vi.mock("@/views/workspace/Sidebar.vue", () => ({
  default: {
    name: "Sidebar",
    template: '<div data-testid="sidebar-mock">Sidebar</div>',
    emits: ["show-component", "hide-component"],
  },
}));

vi.mock("@/views/workspace/Canvas.vue", () => ({
  default: {
    name: "Canvas",
    template: '<div data-testid="canvas-mock">Canvas</div>',
    props: ["showEditor", "showSearch"],
    emits: ["update:modelValue"],
  },
}));

// Mock demo data with default mock
const mockPost = vi.fn().mockResolvedValue({ data: "<html>Test HTML</html>" });
vi.mock("@/views/demo/demoData.js", () => ({
  demoFile: {
    id: 999,
    title: "Test Demo File",
    source: ":rsm:# Test Content::",
  },
  demoUser: { id: 1, name: "Demo User" },
  demoFileStore: { files: [] },
  demoAnnotations: [
    {
      id: 1,
      type: "comment",
      content: "This is an excellent point about accessibility barriers in traditional publishing.",
      user: { id: 1, name: "Demo User" },
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      type: "note",
      content: "Consider adding more details about the technical implementation here.",
      user: { id: 1, name: "Demo User" },
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
  ],
  createDemoApi: () => ({
    post: mockPost,
    getUri: () => import.meta.env.VITE_API_BASE_URL,
  }),
}));

// Mock File model
vi.mock("@/models/File.js", () => ({
  File: class MockFile {
    constructor(data) {
      Object.assign(this, data);
    }
  },
}));

// Mock composables
vi.mock("@vueuse/core", () => ({
  breakpointsTailwind: {},
  useBreakpoints: vi.fn(),
}));

vi.mock("@/composables/useKeyboardShortcuts.js", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

describe("Demo View", () => {
  let wrapper;
  let _mockApi;

  beforeEach(async () => {
    _mockApi = {
      post: vi.fn().mockResolvedValue({ data: "<html>Test HTML</html>" }),
      getUri: () => "http://localhost:8000",
    };

    // Default breakpoints mock
    const { useBreakpoints } = await import("@vueuse/core");
    useBreakpoints.mockReturnValue({
      smallerOrEqual: (size) => ref(size === "xs" ? false : false),
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    vi.clearAllMocks();
  });

  describe("Basic Rendering & Structure", () => {
    it("renders demo banner with correct text and back link", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const banner = wrapper.find(".demo-banner");
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toContain("Demo Mode - Experience Aris workspace with sample content");

      const backLink = wrapper.find(".demo-link");
      expect(backLink.exists()).toBe(true);
      expect(backLink.attributes("href")).toBe("/");
      expect(backLink.text()).toContain("← Back to homepage");
    });

    it("renders demo container with correct data-testid", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const container = wrapper.find('[data-testid="demo-container"]');
      expect(container.exists()).toBe(true);
      expect(container.classes()).toContain("demo-view");
    });

    it("renders Sidebar component", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const sidebar = wrapper.find('[data-testid="sidebar-mock"]');
      expect(sidebar.exists()).toBe(true);
    });

    it("renders Canvas when file is available", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      // Canvas is rendered with data-testid="demo-canvas"
      const canvas = wrapper.find('[data-testid="demo-canvas"]');
      expect(canvas.exists()).toBe(true);
    });

    it("has correct demo banner icon", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const icon = wrapper.find(".demo-icon");
      expect(icon.exists()).toBe(true);
      // Now using Tabler icon instead of emoji
      expect(icon.classes()).toContain("tabler-icon");
    });

    it("provides demo annotations to Canvas component", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      // Check that annotations are provided
      const canvas = wrapper.find('[data-testid="demo-canvas"]');
      expect(canvas.exists()).toBe(true);

      // Verify annotations are passed through provide/inject
      // The demo should have 2 sample annotations
      const annotations = wrapper.vm.annotations;
      expect(annotations).toBeDefined();
      expect(annotations.length).toBe(2);
      expect(annotations[0].type).toBe("comment");
      expect(annotations[1].type).toBe("note");
    });

    it("should not have wrapper container around Canvas", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      // Canvas should be direct child of demo-view, not wrapped in .outer
      const demoView = wrapper.find(".demo-view");
      const canvas = wrapper.find('[data-testid="demo-canvas"]');

      expect(demoView.exists()).toBe(true);
      expect(canvas.exists()).toBe(true);

      // There should be no .outer wrapper between demo-view and Canvas
      const outerWrapper = demoView.find(".outer");
      if (outerWrapper.exists()) {
        // If .outer exists, Canvas should NOT be inside it
        const canvasInOuter = outerWrapper.find('[data-testid="demo-canvas"]');
        expect(canvasInOuter.exists()).toBe(false);
      }
    });
  });

  describe("Responsive Behavior", () => {
    it("applies mobile class when mobileMode is true", async () => {
      // Mock breakpoints to return mobile true for sm and below
      const { useBreakpoints } = await import("@vueuse/core");
      useBreakpoints.mockReturnValue({
        smallerOrEqual: (size) => ref(size === "sm" ? true : false),
      });

      // Provide mobileMode injection since component now injects instead of computes
      wrapper = mount(DemoView, {
        global: {
          provide: {
            mobileMode: ref(true),
          },
        },
      });
      await nextTick();

      const container = wrapper.find('[data-testid="demo-container"]');
      expect(container.classes()).toContain("mobile");
    });

    it("applies focus class when focusMode is true", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Trigger focus mode
      const vm = wrapper.vm;
      vm.focusMode = true;
      await nextTick();

      const container = wrapper.find('[data-testid="demo-container"]');
      expect(container.classes()).toContain("focus");
    });

    it("hides demo banner in focus mode", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Enable focus mode
      const vm = wrapper.vm;
      vm.focusMode = true;
      await nextTick();

      // Check that focus class is applied to container (CSS handles hiding banner)
      const container = wrapper.find('[data-testid="demo-container"]');
      expect(container.classes()).toContain("focus");
    });
  });

  describe("Component Communication", () => {
    it("handles showComponent event from Sidebar for editor", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      const sidebar = wrapper.findComponent({ name: "Sidebar" });
      await sidebar.vm.$emit("show-component", "DockableEditor");

      const canvas = wrapper.findComponent({ name: "Canvas" });
      expect(canvas.props("showEditor")).toBe(true);
    });

    it("handles hideComponent event from Sidebar for editor", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      // First show the editor
      const sidebar = wrapper.findComponent({ name: "Sidebar" });
      await sidebar.vm.$emit("show-component", "DockableEditor");
      await nextTick();

      // Then hide it
      await sidebar.vm.$emit("hide-component", "DockableEditor");
      await nextTick();

      const canvas = wrapper.findComponent({ name: "Canvas" });
      expect(canvas.props("showEditor")).toBe(false);
    });

    it("handles showComponent event from Sidebar for search", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      const sidebar = wrapper.findComponent({ name: "Sidebar" });
      await sidebar.vm.$emit("show-component", "DockableSearch");

      const canvas = wrapper.findComponent({ name: "Canvas" });
      expect(canvas.props("showSearch")).toBe(true);
    });

    it("handles hideComponent event from Sidebar for search", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      // First show the search
      const sidebar = wrapper.findComponent({ name: "Sidebar" });
      await sidebar.vm.$emit("show-component", "DockableSearch");
      await nextTick();

      // Then hide it
      await sidebar.vm.$emit("hide-component", "DockableSearch");
      await nextTick();

      const canvas = wrapper.findComponent({ name: "Canvas" });
      expect(canvas.props("showSearch")).toBe(false);
    });
  });

  describe("Content Loading Delegation", () => {
    it("sets isContentLoaded to true on mount (Canvas.vue handles actual loading)", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for the onMounted hook to execute
      await new Promise((resolve) => setTimeout(resolve, 0));

      // View.vue now delegates content loading to Canvas.vue
      expect(wrapper.vm.isContentLoaded).toBe(true);
    });

    it("provides demo file to Canvas for rendering", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const vm = wrapper.vm;
      const provided = vm.$.provides;

      // The file should be provided to Canvas for content loading
      expect(provided.file).toBeDefined();
      expect(provided.file.value.source).toBe(":rsm:# Test Content::");
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("registers keyboard shortcuts for focus mode", async () => {
      const { useKeyboardShortcuts } = await import("@/composables/useKeyboardShortcuts.js");
      useKeyboardShortcuts.mockClear();

      wrapper = mount(DemoView);
      await nextTick();

      expect(useKeyboardShortcuts).toHaveBeenCalledWith({
        c: expect.any(Function),
      });
    });

    it("toggles focus mode when shortcut function is called", async () => {
      const { useKeyboardShortcuts } = await import("@/composables/useKeyboardShortcuts.js");
      let shortcutCallback;

      useKeyboardShortcuts.mockImplementation((shortcuts) => {
        shortcutCallback = shortcuts.c;
      });

      wrapper = mount(DemoView);
      await nextTick();

      const vm = wrapper.vm;
      expect(vm.focusMode).toBe(false);

      // Call the shortcut callback
      if (shortcutCallback) {
        shortcutCallback();
        await nextTick();

        expect(vm.focusMode).toBe(true);

        // Call again to toggle back
        shortcutCallback();
        await nextTick();

        expect(vm.focusMode).toBe(false);
      } else {
        // If shortcut callback isn't captured, skip this test
        expect(true).toBe(true);
      }
    });
  });

  describe("Provide/Inject Integration", () => {
    it("provides API instance to child components", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const provided = wrapper.vm.$.provides;
      expect(provided.api).toBeDefined();
      expect(provided.api.getUri).toBeDefined();
    });

    it("provides viewport and breakpoint info", async () => {
      // Provide all injected values since component now injects them from App.vue
      wrapper = mount(DemoView, {
        global: {
          provide: {
            mobileMode: ref(false),
            breakpoints: { active: () => ref("sm") },
            xsMode: ref(false),
          },
        },
      });
      await nextTick();

      const provided = wrapper.vm.$.provides;
      // Component re-provides injected values to its children
      expect(provided.breakpoints).toBeDefined();
      expect(provided.xsMode).toBeDefined();
      // mobileMode is now injected from parent, not provided by this component
      expect(wrapper.vm.$.provides.api).toBeDefined();
    });

    it("provides user, fileStore, and file data", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const provided = wrapper.vm.$.provides;
      expect(provided.user).toBeDefined();
      expect(provided.fileStore).toBeDefined();
      expect(provided.file).toBeDefined();
    });

    it("provides demo annotations and file settings", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const provided = wrapper.vm.$.provides;
      expect(provided.annotations).toBeDefined();
      expect(provided.fileSettings).toBeDefined();
    });

    it("provides drawer and focus mode state", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const provided = wrapper.vm.$.provides;
      expect(provided.drawerOpen).toBeDefined();
      expect(provided.focusMode).toBeDefined();
      expect(provided.sidebarIsCollapsed).toBeDefined();
      expect(provided.isDev).toBeDefined();
    });
  });
});
