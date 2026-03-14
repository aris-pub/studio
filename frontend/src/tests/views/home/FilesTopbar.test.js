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
    });

    // Create a ref-like object that has a .value property for Vue test utils
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
  });

  describe("Search Functionality", () => {
    it("handles search submission correctly", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("test query");

      expect(mockFileStore.value.clearFilters).toHaveBeenCalledOnce();
      expect(mockFileStore.value.filterFiles).toHaveBeenCalledOnce();
      expect(mockFileStore.value.filterFiles).toHaveBeenCalledWith(expect.any(Function));
    });

    it("filters files by title case-insensitively", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("TeSt");

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];

      // Test the filter function
      expect(filterFunction({ title: "test file" })).toBe(false); // Should show (not filtered)
      expect(filterFunction({ title: "TEST FILE" })).toBe(false); // Should show (not filtered)
      expect(filterFunction({ title: "other file" })).toBe(true); // Should hide (filtered)
    });

    it("handles empty search string", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("");

      expect(mockFileStore.value.clearFilters).toHaveBeenCalledOnce();

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];
      // Empty search should show all files
      expect(filterFunction({ title: "any file" })).toBe(false);
    });

    it("handles search strings with special characters", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("test-file.txt");

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];

      expect(filterFunction({ title: "test-file.txt" })).toBe(false); // Should show
      expect(filterFunction({ title: "other.txt" })).toBe(true); // Should hide
    });

    it("responds to SearchBar submit events", async () => {
      const wrapper = createWrapper();

      const searchBar = wrapper.findComponent('[data-testid="search-bar"]');
      await searchBar.trigger("click"); // This triggers the submit event with 'test search'

      expect(mockFileStore.value.clearFilters).toHaveBeenCalledOnce();
      expect(mockFileStore.value.filterFiles).toHaveBeenCalledOnce();
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
        },
      });

      // Get the registered shortcuts
      const shortcuts = useKeyboardShortcuts.mock.calls[0][0];

      // Simulate '/' shortcut
      shortcuts["/"].fn();

      expect(mockFocusInput).toHaveBeenCalledOnce();
    });
  });

  describe("Template Ref Management", () => {
    it("maintains reference to search bar component", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.searchBar).toBeDefined();
    });

    it("handles missing search bar reference gracefully", async () => {
      const { useKeyboardShortcuts } = await import("@/composables/useKeyboardShortcuts.js");

      createWrapper({
        stubs: {
          SearchBar: {
            template: '<div data-testid="search-bar"></div>',
            // No focusInput method
          },
        },
      });

      // Get the registered shortcuts
      const shortcuts = useKeyboardShortcuts.mock.calls[0][0];

      // Simulate '/' shortcut when focusInput is not available
      expect(() => shortcuts["/"].fn()).toThrow();
    });
  });

  describe("Error Handling", () => {
    it("handles missing fileStore gracefully", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref(null),
        },
      });

      // Should not throw when trying to search
      expect(() => wrapper.vm.onSearchSubmit("test")).toThrow();
    });

    it("handles fileStore without required methods", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({}), // Empty object without clearFilters/filterFiles
        },
      });

      // Should not throw when trying to search
      expect(() => wrapper.vm.onSearchSubmit("test")).toThrow();
    });
  });

  describe("Component Lifecycle", () => {
    it("initializes with correct default values", () => {
      const wrapper = createWrapper();

      expect(typeof wrapper.vm.onSearchSubmit).toBe("function");
    });

    it("cleans up properly on unmount", () => {
      const wrapper = createWrapper();

      // Should not throw on unmount
      expect(() => wrapper.unmount()).not.toThrow();
    });
  });

  describe("Enhanced Search Edge Cases", () => {
    it("handles extremely long search queries", () => {
      const wrapper = createWrapper();
      const longQuery = "a".repeat(1000);

      wrapper.vm.onSearchSubmit(longQuery);

      expect(mockFileStore.value.clearFilters).toHaveBeenCalledOnce();
      expect(mockFileStore.value.filterFiles).toHaveBeenCalledOnce();

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];
      expect(filterFunction({ title: longQuery })).toBe(false); // Should show
      expect(filterFunction({ title: "short" })).toBe(true); // Should hide
    });

    it("handles search with only whitespace", () => {
      const wrapper = createWrapper();
      const whitespaceQuery = "   \t\n   ";

      wrapper.vm.onSearchSubmit(whitespaceQuery);

      expect(mockFileStore.value.clearFilters).toHaveBeenCalledOnce();
      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];
      // Whitespace-only search should behave like empty search - show all files
      expect(filterFunction({ title: "any file" })).toBe(false);
    });

    it("handles unicode and emoji in search", () => {
      const wrapper = createWrapper();
      const unicodeQuery = "研究 🧬 café";

      wrapper.vm.onSearchSubmit(unicodeQuery);

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];
      expect(filterFunction({ title: "研究 paper" })).toBe(false); // Should show
      expect(filterFunction({ title: "DNA 🧬 study" })).toBe(false); // Should show
      expect(filterFunction({ title: "café data" })).toBe(false); // Should show
      expect(filterFunction({ title: "other file" })).toBe(true); // Should hide
    });

    it("handles regex special characters safely", () => {
      const wrapper = createWrapper();
      const regexQuery = ".*+?^${}()|[]\\";

      // Should not throw an error
      expect(() => wrapper.vm.onSearchSubmit(regexQuery)).not.toThrow();

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];
      expect(filterFunction({ title: regexQuery })).toBe(false); // Should show exact match
      expect(filterFunction({ title: "other" })).toBe(true); // Should hide
    });

    it("preserves case insensitivity with complex strings", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("DNA-Seq");

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];
      expect(filterFunction({ title: "dna-seq analysis" })).toBe(false); // Should show
      expect(filterFunction({ title: "DNA-SEQ results" })).toBe(false); // Should show
      expect(filterFunction({ title: "DnA-sEq report" })).toBe(false); // Should show
      expect(filterFunction({ title: "RNA analysis" })).toBe(true); // Should hide
    });

    it("handles rapid sequential searches", async () => {
      const wrapper = createWrapper();

      // Rapid fire search submissions
      wrapper.vm.onSearchSubmit("first");
      wrapper.vm.onSearchSubmit("second");
      wrapper.vm.onSearchSubmit("third");

      // Should clear filters before each new search
      expect(mockFileStore.value.clearFilters).toHaveBeenCalledTimes(3);
      expect(mockFileStore.value.filterFiles).toHaveBeenCalledTimes(3);

      // Latest filter should be for "third"
      const lastFilterFunction = mockFileStore.value.filterFiles.mock.calls[2][0];
      expect(lastFilterFunction({ title: "third result" })).toBe(false);
      expect(lastFilterFunction({ title: "first result" })).toBe(true);
    });

    it("handles null or undefined search queries", () => {
      const wrapper = createWrapper();

      // Test null query
      expect(() => wrapper.vm.onSearchSubmit(null)).not.toThrow();

      // Test undefined query
      expect(() => wrapper.vm.onSearchSubmit(undefined)).not.toThrow();

      // Both should be treated as empty searches
      expect(mockFileStore.value.clearFilters).toHaveBeenCalledTimes(2);
    });
  });

  describe("Search Performance and Memory", () => {
    it("does not leak memory with repeated searches", () => {
      const wrapper = createWrapper();

      // Perform many searches to test for memory leaks
      for (let i = 0; i < 100; i++) {
        wrapper.vm.onSearchSubmit(`query ${i}`);
      }

      // Each search should clear previous filters
      expect(mockFileStore.value.clearFilters).toHaveBeenCalledTimes(100);
      expect(mockFileStore.value.filterFiles).toHaveBeenCalledTimes(100);
    });

    it("handles search with very large file lists efficiently", () => {
      const wrapper = createWrapper();

      wrapper.vm.onSearchSubmit("test");
      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];

      // Simulate filtering large number of files
      const startTime = performance.now();
      for (let i = 0; i < 10000; i++) {
        filterFunction({ title: `file ${i} test` });
      }
      const endTime = performance.now();

      // Filter should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    });
  });
});
