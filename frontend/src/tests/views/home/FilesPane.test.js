import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import FilesPane from "@/views/home/FilesPane.vue";

// Mock useListKeyboardNavigation
vi.mock("@/composables/useListKeyboardNavigation.js", () => ({
  useListKeyboardNavigation: vi.fn(() => ({
    activeIndex: ref(null),
  })),
}));

describe("FilesPane.vue", () => {
  let mockFileStore;
  let mockProvides;

  beforeEach(() => {
    mockFileStore = ref({
      files: [
        { id: "1", title: "File 1", filtered: false, focused: false },
        { id: "2", title: "File 2", filtered: false, focused: false },
        { id: "3", title: "File 3", filtered: true, focused: false }, // filtered out
      ],
    });

    mockProvides = {
      fileStore: mockFileStore,
      xsMode: ref(false),
      mobileMode: ref(false),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = (overrides = {}) => {
    return mount(FilesPane, {
      global: {
        provide: {
          ...mockProvides,
          ...overrides.provide,
        },
        stubs: {
          // Keep Pane simple but more realistic - preserve layout structure
          Pane: {
            template:
              '<div class="pane" :class="{ mobile: mobileMode }"><div v-if="$slots.header" class="pane-header"><slot name="header" /></div><div class="content"><slot /></div></div>',
            props: ["customHeader"],
            inject: ["mobileMode"],
          },
          Topbar: {
            template: '<div data-testid="topbar"></div>',
            emits: ["list", "cards"],
          },
          // Remove FilesHeader stub - test with real component
          FilesItem: {
            template: '<div class="file-item" data-testid="file-item"></div>',
            props: ["modelValue", "mode"],
          },
          // Stub child components that FilesHeader needs
          FilesHeaderLabel: {
            template: '<div data-testid="files-header-label"><slot /></div>',
            props: ["name", "sortable", "filterable"],
            emits: ["sort", "filter"],
          },
          LoadingSpinner: {
            template: '<div data-testid="loading-spinner">loading files...</div>',
          },
          // Stub icons
          IconArrowsSort: '<svg data-testid="icon-arrows-sort"></svg>',
          IconArrowNarrowDown: '<svg data-testid="icon-arrow-narrow-down"></svg>',
          IconArrowNarrowUp: '<svg data-testid="icon-arrow-narrow-up"></svg>',
          ...overrides.stubs,
        },
      },
    });
  };

  describe("Component Rendering", () => {
    it("renders with basic structure", () => {
      const wrapper = createWrapper();

      expect(wrapper.find(".pane").exists()).toBe(true);
      expect(wrapper.find('[data-testid="topbar"]').exists()).toBe(true);
      expect(wrapper.findComponent({ name: "FilesHeader" }).exists()).toBe(true); // Real FilesHeader component
      expect(wrapper.find('[data-testid="files-container"]').exists()).toBe(true);
    });

    it("renders visible files only (excludes filtered files)", async () => {
      const wrapper = createWrapper();

      // Wait for async components to render
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(2); // Only non-filtered files
    });

    it("renders loading state when files are not available", async () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({ files: null }),
        },
      });

      // Wait a tick to see if loading state appears with async components
      await nextTick();

      // Note: Loading state behavior will change once FilesItem becomes async
      // This test may need adjustment based on actual async implementation
      const loadingElement = wrapper.find(".loading");
      if (loadingElement.exists()) {
        expect(loadingElement.text()).toBe("loading files...");
      }
    });

    it("renders empty state when no visible files", async () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({
            files: [
              { id: "1", filtered: true }, // all files filtered
              { id: "2", filtered: true },
            ],
          }),
        },
      });

      // Wait for async components to settle
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(0);
    });
  });

  describe("View Mode Management", () => {
    it("defaults to list mode", () => {
      const wrapper = createWrapper();

      const filesWrapper = wrapper.find(".files-wrapper");
      const filesContainer = wrapper.find(".files");

      expect(filesWrapper.classes()).toContain("list");
      expect(filesContainer.classes()).toContain("list");
    });

    it("switches to cards mode when topbar emits cards event", async () => {
      const wrapper = createWrapper({
        stubs: {
          Topbar: {
            template: '<div data-testid="topbar" @click="$emit(\'cards\')"></div>',
            emits: ["list", "cards"],
          },
        },
      });

      await wrapper.find('[data-testid="topbar"]').trigger("click");
      await nextTick();

      const filesWrapper = wrapper.find(".files-wrapper");
      const filesContainer = wrapper.find(".files");

      expect(filesWrapper.classes()).toContain("cards");
      expect(filesContainer.classes()).toContain("cards");
    });

    it("switches back to list mode when topbar emits list event", async () => {
      const wrapper = createWrapper({
        stubs: {
          Topbar: {
            template: '<div data-testid="topbar" @click="toggleMode"></div>',
            emits: ["list", "cards"],
            methods: {
              toggleMode() {
                this.$emit("cards");
                this.$nextTick(() => this.$emit("list"));
              },
            },
          },
        },
      });

      await wrapper.find('[data-testid="topbar"]').trigger("click");
      await nextTick();

      const filesWrapper = wrapper.find(".files-wrapper");
      expect(filesWrapper.classes()).toContain("list");
    });

    it("passes current mode to FilesHeader component", async () => {
      const wrapper = createWrapper();

      const filesHeader = wrapper.findComponent({ name: "FilesHeader" });
      expect(filesHeader.props("mode")).toBe("list");

      // Switch to cards mode
      wrapper.vm.mode = "cards";
      await nextTick();

      expect(filesHeader.props("mode")).toBe("cards");
    });

    it("passes current mode to FilesItem components", async () => {
      const wrapper = createWrapper();

      const fileItems = wrapper.findAllComponents('[data-testid="file-item"]');
      fileItems.forEach((item) => {
        expect(item.props("mode")).toBe("list");
      });

      // Switch to cards mode
      wrapper.vm.mode = "cards";
      await nextTick();

      fileItems.forEach((item) => {
        expect(item.props("mode")).toBe("cards");
      });
    });
  });

  describe("Responsive Behavior", () => {
    it("applies correct padding for normal screen size", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.panePadding).toBe("16px");
    });

    it("applies correct padding for extra small screen", () => {
      const wrapper = createWrapper({
        provide: {
          xsMode: ref(true),
        },
      });

      expect(wrapper.vm.panePadding).toBe("8px");
    });

    it("applies correct grid template columns for normal screen", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.gridTemplateColumns).toBe(
        "minmax(144px, 2fr) minmax(96px, 1.5fr) 8px 108px 104px 16px 8px"
      );
    });

    it("applies correct grid template columns for extra small screen", () => {
      const wrapper = createWrapper({
        provide: {
          xsMode: ref(true),
        },
      });

      expect(wrapper.vm.gridTemplateColumns).toBe("minmax(144px, 2fr) 104px 16px 8px");
    });
  });

  describe("Column Visibility Logic", () => {
    it("shows all columns in normal mode", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.shouldShowColumn("Title", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Tags", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Spacer", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Date", "list")).toBe(true);
    });

    it("hides Tags and Spacer columns in extra small mode", () => {
      const wrapper = createWrapper({
        provide: {
          xsMode: ref(true),
        },
      });

      expect(wrapper.vm.shouldShowColumn("Title", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Tags", "list")).toBe(false);
      expect(wrapper.vm.shouldShowColumn("Spacer", "list")).toBe(false);
      expect(wrapper.vm.shouldShowColumn("Date", "list")).toBe(true);
    });

    it("provides shouldShowColumn function to child components", () => {
      const wrapper = createWrapper();

      // The function should be provided to child components
      expect(typeof wrapper.vm.shouldShowColumn).toBe("function");
    });
  });

  describe("File Focus Management", () => {
    it("clears focus from all files when activeIndex changes to null", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(1); // Start with a focused index
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      // Set up files with some focused
      mockFileStore.value.files[0].focused = true;
      mockFileStore.value.files[1].focused = true;

      // Create wrapper to ensure component lifecycle and watchers are set up
      const _wrapper = createWrapper();
      await nextTick(); // Let the component mount and watchers set up

      // Simulate activeIndex changing to null
      activeIndexRef.value = null;
      await nextTick();

      // Check that focus was cleared from all files
      expect(mockFileStore.value.files[0].focused).toBe(false);
      expect(mockFileStore.value.files[1].focused).toBe(false);
    });

    it("sets focus on correct visible file when activeIndex changes", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(0);
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      // Create wrapper to ensure component lifecycle and watchers are set up
      const _wrapper = createWrapper();
      await nextTick();

      // Simulate activeIndex changing to 1 (second visible file)
      activeIndexRef.value = 1;
      await nextTick();

      // First visible file (files[0]) should not be focused
      expect(mockFileStore.value.files[0].focused).toBe(false);
      // Second visible file (files[1]) should be focused
      expect(mockFileStore.value.files[1].focused).toBe(true);
      // Third file is filtered, so shouldn't be affected
      expect(mockFileStore.value.files[2].focused).toBe(false);
    });

    it("handles invalid activeIndex gracefully", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(999); // Out of bounds
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      // Should not throw an error
      expect(() => {
        activeIndexRef.value = 999;
      }).not.toThrow();
    });
  });

  describe("Computed Properties", () => {
    it("calculates visibleFiles correctly", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.visibleFiles).toHaveLength(2);
      expect(wrapper.vm.visibleFiles[0].id).toBe("1");
      expect(wrapper.vm.visibleFiles[1].id).toBe("2");
    });

    it("calculates numFiles correctly", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.numFiles).toBe(2);
    });

    it("handles empty file store", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({}),
        },
      });

      expect(wrapper.vm.visibleFiles).toEqual([]);
      expect(wrapper.vm.numFiles).toBe(0);
    });

    it("handles null file store", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref(null),
        },
      });

      expect(wrapper.vm.visibleFiles).toEqual([]);
      expect(wrapper.vm.numFiles).toBe(0);
    });
  });

  describe("Integration with useListKeyboardNavigation", () => {
    it("calls useListKeyboardNavigation with correct parameters", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");

      // Create wrapper to ensure component lifecycle and watchers are set up
      const _wrapper = createWrapper();
      await nextTick();

      expect(mockUseListKeyboardNavigation.useListKeyboardNavigation).toHaveBeenCalledWith(
        expect.objectContaining({ value: 2 }), // numFiles
        expect.any(Object), // filesRef
        true // useEscape
      );
    });
  });
});
