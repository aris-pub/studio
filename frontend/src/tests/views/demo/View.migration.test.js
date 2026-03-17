import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
const mockGet = vi.fn().mockResolvedValue({ data: "<html>File Content</html>" });
vi.mock("@/views/demo/demoData.js", () => ({
  demoFile: {
    id: 999,
    title: "Test Demo File",
    source: "# Test Content",
    html: null,
  },
  demoUser: { id: 1, name: "Demo User" },
  demoFileStore: { files: [] },
  demoAnnotations: [],
  createDemoApi: () => ({
    post: mockPost,
    get: mockGet,
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

describe("Demo View Migration Tests", () => {
  let wrapper;

  beforeEach(async () => {
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

  describe("Canvas Integration", () => {
    it("uses standard Canvas component with demo data", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      const canvas = wrapper.findComponent({ name: "Canvas" });

      expect(canvas.exists()).toBe(true);
      expect(canvas.vm.$attrs.modelValue).toMatchObject({
        id: 999,
        title: expect.any(String),
      });
    });

    it("provides demo API that works with Canvas", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const provided = wrapper.vm.$.provides;

      expect(provided.api).toBeDefined();
      expect(provided.api.get).toBeDefined();
      expect(provided.api.post).toBeDefined();
      expect(provided.api.getUri).toBeDefined();
    });

    it("Canvas receives correct props for editor and search", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      const canvas = wrapper.findComponent({ name: "Canvas" });

      expect(canvas.props("showEditor")).toBe(false);
      expect(canvas.props("showSearch")).toBe(false);
    });

    it("maintains correct layout without positioning issues", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for content to load
      await vi.waitFor(() => {
        return wrapper.vm.isContentLoaded;
      });
      await nextTick();

      const canvas = wrapper.find('[data-testid="demo-canvas"]');

      // Canvas should be rendered but not have demo-specific positioning classes
      expect(canvas.exists()).toBe(true);
      expect(canvas.classes()).not.toContain("demo-canvas");
    });
  });

  describe("API Override Functionality", () => {
    it("demo API overrides main app API", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const provided = wrapper.vm.$.provides;

      // Verify the demo API is provided
      expect(provided.api).toBeDefined();
      expect(provided.api.getUri()).toBe(import.meta.env.VITE_API_BASE_URL);
    });

    it("demo API supports file content endpoint", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const provided = wrapper.vm.$.provides;
      const api = provided.api;

      // This test will pass once we implement the enhancement
      expect(typeof api.get).toBe("function");
    });

    it("demo file gets properly initialized with HTML content", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      // Wait for onMounted to execute
      await new Promise((resolve) => setTimeout(resolve, 0));

      const vm = wrapper.vm;
      expect(vm.demoFileReactive).toBeDefined();
      expect(vm.demoFileReactive.id).toBe(999);
    });
  });

  describe("Component Communication Preserved", () => {
    it("sidebar to canvas communication works", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const sidebar = wrapper.findComponent({ name: "Sidebar" });
      await sidebar.vm.$emit("show-component", "DockableEditor");

      const canvas = wrapper.findComponent({ name: "Canvas" });
      expect(canvas.props("showEditor")).toBe(true);
    });

    it("maintains all provide/inject functionality", async () => {
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

      // Verify all expected provides are still there
      expect(provided.api).toBeDefined();
      expect(provided.breakpoints).toBeDefined();
      expect(provided.xsMode).toBeDefined();
      // mobileMode is now injected from App.vue, not provided by this component
      expect(provided.user).toBeDefined();
      expect(provided.fileStore).toBeDefined();
      expect(provided.file).toBeDefined();
      expect(provided.annotations).toBeDefined();
      expect(provided.fileSettings).toBeDefined();
      expect(provided.drawerOpen).toBeDefined();
      expect(provided.focusMode).toBeDefined();
    });
  });

  describe("No Regression in Demo Features", () => {
    it("demo banner still works correctly", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const banner = wrapper.find(".demo-banner");
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toContain("Demo Mode - Experience RSM Studio workspace with sample content");
    });

    it("focus mode still toggles correctly", async () => {
      wrapper = mount(DemoView);
      await nextTick();

      const vm = wrapper.vm;
      expect(vm.focusMode).toBe(false);

      vm.focusMode = true;
      await nextTick();

      const container = wrapper.find('[data-testid="demo-container"]');
      expect(container.classes()).toContain("focus");
    });

    it("responsive behavior still works", async () => {
      // Mock mobile mode
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
  });
});
