import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import FilesTopbar from "@/views/home/FilesTopbar.vue";

// Mock useKeyboardShortcuts
vi.mock("@/composables/useKeyboardShortcuts.js", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

describe("FilesTopbar.vue", () => {
  let mockFileStore;
  let mockProvides;

  beforeEach(() => {
    mockFileStore = ref({
      clearFilters: vi.fn(),
      filterFiles: vi.fn(),
      applyFilter: vi.fn(),
      clearFilter: vi.fn(),
    });

    const mockFileStoreRef = {
      value: mockFileStore.value,
    };

    mockProvides = {
      fileStore: mockFileStoreRef,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = (overrides = {}) => {
    return mount(FilesTopbar, {
      global: {
        provide: {
          ...mockProvides,
          ...overrides.provide,
        },
        stubs: {
          SearchBar: {
            template:
              "<div data-testid=\"search-bar\" @click=\"$emit('submit', 'test search')\"></div>",
            emits: ["submit"],
            methods: {
              focusInput: vi.fn(),
            },
          },
          SegmentedControl: {
            template: '<div data-testid="segmented-control" @click="$emit(\'update:modelValue\', 1)"></div>',
            props: ["modelValue", "labels", "defaultActive"],
            emits: ["update:modelValue"],
          },
          ...overrides.stubs,
        },
      },
    });
  };

  describe("Component Rendering", () => {
    it("renders with basic structure", () => {
      const wrapper = createWrapper();

      expect(wrapper.find(".tb-wrapper").exists()).toBe(true);
      expect(wrapper.find(".tb-search").exists()).toBe(true);
      expect(wrapper.find('[data-testid="search-bar"]').exists()).toBe(true);
    });

    it("renders SearchBar component", () => {
      const wrapper = createWrapper();

      const searchBar = wrapper.findComponent('[data-testid="search-bar"]');
      expect(searchBar.exists()).toBe(true);
    });

    it("renders SegmentedControl for ownership filter", () => {
      const wrapper = createWrapper();

      expect(wrapper.find('[data-testid="segmented-control"]').exists()).toBe(true);
      expect(wrapper.find(".tb-filter").exists()).toBe(true);
    });

    it("renders filter wrapper with radiogroup role", () => {
      const wrapper = createWrapper();

      const filterDiv = wrapper.find('.tb-filter');
      expect(filterDiv.attributes("role")).toBe("radiogroup");
      expect(filterDiv.attributes("aria-label")).toBe("File ownership filter");
    });
  });

  describe("Search Functionality", () => {
    it("uses named search filter layer", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("test query");

      expect(mockFileStore.value.applyFilter).toHaveBeenCalledOnce();
      expect(mockFileStore.value.applyFilter).toHaveBeenCalledWith("search", expect.any(Function));
    });

    it("clears search layer on empty search", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("");

      expect(mockFileStore.value.clearFilter).toHaveBeenCalledWith("search");
      expect(mockFileStore.value.applyFilter).not.toHaveBeenCalled();
    });

    it("filters files by title case-insensitively", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("TeSt");

      const filterFunction = mockFileStore.value.applyFilter.mock.calls[0][1];

      expect(filterFunction({ title: "test file" })).toBe(false);
      expect(filterFunction({ title: "TEST FILE" })).toBe(false);
      expect(filterFunction({ title: "other file" })).toBe(true);
    });

    it("handles null or undefined search queries", () => {
      const wrapper = createWrapper();

      expect(() => wrapper.vm.onSearchSubmit(null)).not.toThrow();
      expect(() => wrapper.vm.onSearchSubmit(undefined)).not.toThrow();

      expect(mockFileStore.value.clearFilter).toHaveBeenCalledTimes(2);
    });

    it("handles search with only whitespace", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("   \t\n   ");

      expect(mockFileStore.value.clearFilter).toHaveBeenCalledWith("search");
    });

    it("handles unicode and emoji in search", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("研究 🧬 café");

      const filterFunction = mockFileStore.value.applyFilter.mock.calls[0][1];
      expect(filterFunction({ title: "研究 paper" })).toBe(false);
      expect(filterFunction({ title: "DNA 🧬 study" })).toBe(false);
      expect(filterFunction({ title: "café data" })).toBe(false);
      expect(filterFunction({ title: "other file" })).toBe(true);
    });

    it("responds to SearchBar submit events", async () => {
      const wrapper = createWrapper();

      const searchBar = wrapper.findComponent('[data-testid="search-bar"]');
      await searchBar.trigger("click");

      expect(mockFileStore.value.applyFilter).toHaveBeenCalledOnce();
    });
  });

  describe("Ownership Filter", () => {
    it("starts with All segment active (index 0)", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.activeSegment).toBe(0);
    });

    it("clears ownership filter when All is selected", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSegmentChange(0);

      expect(mockFileStore.value.clearFilter).toHaveBeenCalledWith("ownership");
    });

    it("filters to owned files when My files is selected", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSegmentChange(1);

      expect(mockFileStore.value.applyFilter).toHaveBeenCalledWith("ownership", expect.any(Function));

      const filterFn = mockFileStore.value.applyFilter.mock.calls[0][1];
      expect(filterFn({ role: "OWNER" })).toBe(false);
      expect(filterFn({ role: "EDITOR" })).toBe(true);
      expect(filterFn({ role: "COMMENTER" })).toBe(true);
    });

    it("filters to shared files when Shared with me is selected", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSegmentChange(2);

      expect(mockFileStore.value.applyFilter).toHaveBeenCalledWith("ownership", expect.any(Function));

      const filterFn = mockFileStore.value.applyFilter.mock.calls[0][1];
      expect(filterFn({ role: "OWNER" })).toBe(true);
      expect(filterFn({ role: "EDITOR" })).toBe(false);
      expect(filterFn({ role: "COMMENTER" })).toBe(false);
    });

    it("does not interfere with search filter", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("test");
      wrapper.vm.onSegmentChange(1);

      expect(mockFileStore.value.applyFilter).toHaveBeenCalledWith("search", expect.any(Function));
      expect(mockFileStore.value.applyFilter).toHaveBeenCalledWith("ownership", expect.any(Function));
    });
  });

  describe("Keyboard Shortcuts Integration", () => {
    it("registers keyboard shortcuts on mount", async () => {
      const { useKeyboardShortcuts } = await import("@/composables/useKeyboardShortcuts.js");

      createWrapper();

      expect(useKeyboardShortcuts).toHaveBeenCalledWith(
        {
          "/": { fn: expect.any(Function), description: "search" },
        },
        true,
        "Home view"
      );
    });

    it("keyboard shortcut '/' focuses search input", async () => {
      const { useKeyboardShortcuts } = await import("@/composables/useKeyboardShortcuts.js");

      const mockFocusInput = vi.fn();
      createWrapper({
        stubs: {
          SearchBar: {
            template: '<div data-testid="search-bar"></div>',
            methods: {
              focusInput: mockFocusInput,
            },
          },
          SegmentedControl: {
            template: '<div data-testid="segmented-control"></div>',
            props: ["modelValue", "labels", "defaultActive"],
            emits: ["update:modelValue"],
          },
        },
      });

      const shortcuts = useKeyboardShortcuts.mock.calls[0][0];
      shortcuts["/"].fn();

      expect(mockFocusInput).toHaveBeenCalledOnce();
    });
  });

  describe("Component Lifecycle", () => {
    it("initializes with correct default values", () => {
      const wrapper = createWrapper();

      expect(typeof wrapper.vm.onSearchSubmit).toBe("function");
      expect(wrapper.vm.activeSegment).toBe(0);
    });

    it("cleans up properly on unmount", () => {
      const wrapper = createWrapper();

      expect(() => wrapper.unmount()).not.toThrow();
    });
  });
});
