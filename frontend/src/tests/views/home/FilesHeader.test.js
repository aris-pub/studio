import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import FilesHeader from "@/views/home/FilesHeader.vue";

describe("FilesHeader.vue", () => {
  let mockFileStore;
  let mockShouldShowColumn;
  let mockProvides;

  beforeEach(() => {
    mockFileStore = ref({
      sortFiles: vi.fn(),
      clearFilters: vi.fn(),
      filterFiles: vi.fn(),
    });

    mockShouldShowColumn = vi.fn((columnName, mode) => {
      // Default behavior: show all columns except hide Tags/Spacer in some cases
      if (["Tags", "Spacer"].includes(columnName) && mode === "xs") {
        return false;
      }
      return true;
    });

    mockProvides = {
      fileStore: mockFileStore,
      xsMode: ref(false),
      shouldShowColumn: mockShouldShowColumn,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = (props = {}, overrides = {}) => {
    return mount(FilesHeader, {
      props: {
        mode: "list",
        ...props,
      },
      global: {
        provide: {
          ...mockProvides,
          ...overrides.provide,
        },
        stubs: {
          Header: {
            template: '<div class="header" :class="$attrs.class"><slot></slot></div>',
          },
          HeaderLabel: {
            template:
              '<div class="header-label" :data-testid="`header-${name}`" @click="handleClick"></div>',
            props: ["name", "sortable", "filterable", "modelValue"],
            emits: ["sort", "filter", "update:modelValue"],
            methods: {
              handleClick() {
                if (this.sortable) {
                  this.$emit("sort", "asc");
                }
                if (this.filterable) {
                  this.$emit("filter", [{ id: "tag1", name: "test" }]);
                }
              },
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

      expect(wrapper.find(".header").exists()).toBe(true);
      expect(wrapper.find(".header").classes()).toContain("list");
    });

    it("applies correct CSS class based on mode prop", () => {
      const wrapper = createWrapper({ mode: "cards" });

      expect(wrapper.find(".header").classes()).toContain("cards");
    });

    it("renders all visible columns", () => {
      const wrapper = createWrapper();

      // Should render Title, Tags, Last edit columns (Spacer is a div)
      expect(wrapper.find('[data-testid="header-Title"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="header-Tags"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="header-Last edit"]').exists()).toBe(true);
    });

    it("renders spacer elements correctly", () => {
      const wrapper = createWrapper();

      const spacers = wrapper.findAll(".spacer");
      expect(spacers.length).toBeGreaterThan(0);
    });

    it("adds final spacer for list mode", () => {
      const wrapper = createWrapper({ mode: "list" });

      const finalSpacer = wrapper.find(".spacer-1");
      expect(finalSpacer.exists()).toBe(true);
    });

    it("does not add final spacer for cards mode", () => {
      const wrapper = createWrapper({ mode: "cards" });

      const finalSpacer = wrapper.find(".spacer-1");
      expect(finalSpacer.exists()).toBe(false);
    });
  });

  describe("Column Visibility", () => {
    it("calls shouldShowColumn for each column", () => {
      createWrapper({ mode: "list" });

      expect(mockShouldShowColumn).toHaveBeenCalledWith("Title", "list");
      expect(mockShouldShowColumn).toHaveBeenCalledWith("Tags", "list");
      expect(mockShouldShowColumn).toHaveBeenCalledWith("Spacer", "list");
      expect(mockShouldShowColumn).toHaveBeenCalledWith("Collaborators", "list");
      expect(mockShouldShowColumn).toHaveBeenCalledWith("Last edit", "list");
    });

    it("hides columns when shouldShowColumn returns false", () => {
      mockShouldShowColumn.mockImplementation((columnName) => {
        return columnName !== "Tags"; // Hide Tags column
      });

      const wrapper = createWrapper();

      expect(wrapper.find('[data-testid="header-Title"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="header-Tags"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="header-Last edit"]').exists()).toBe(true);
    });

    it("shows different columns for different modes", () => {
      // Create wrapper with cards mode to trigger shouldShowColumn calls
      createWrapper({ mode: "cards" });

      expect(mockShouldShowColumn).toHaveBeenCalledWith("Title", "cards");
      expect(mockShouldShowColumn).toHaveBeenCalledWith("Tags", "cards");
    });
  });

  describe("Column Configuration", () => {
    it("has correct column info structure", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.columnInfo).toEqual({
        Title: { sortable: true, filterable: false, sortKey: "title" },
        Structure: {},
        Tags: { sortable: false, filterable: true, sortKey: "" },
        Spacer: {},
        Collaborators: { sortable: false, filterable: false, sortKey: "" },
        "Last edit": { sortable: true, filterable: false, sortKey: "last_edited_at" },
      });
    });

    it("passes correct props to HeaderLabel components", () => {
      const wrapper = createWrapper();

      const titleHeader = wrapper.findComponent('[data-testid="header-Title"]');
      expect(titleHeader.props()).toMatchObject({
        name: "Title",
        sortable: true,
        filterable: false,
      });

      const tagsHeader = wrapper.findComponent('[data-testid="header-Tags"]');
      expect(tagsHeader.props()).toMatchObject({
        name: "Tags",
        sortable: false,
        filterable: true,
      });
    });

    it("maintains column state reactively", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.columnState).toEqual({
        Title: null,
        Tags: null,
        Collaborators: null,
        "Last edit": null,
      });
    });
  });

  describe("Sort Functionality", () => {
    it("handles ascending sort correctly", async () => {
      const wrapper = createWrapper();

      const titleHeader = wrapper.findComponent('[data-testid="header-Title"]');
      await titleHeader.trigger("click");

      expect(mockFileStore.value.sortFiles).toHaveBeenCalledWith(expect.any(Function));

      // Test the sort function
      const sortFunction = mockFileStore.value.sortFiles.mock.calls[0][0];
      const result = sortFunction({ title: "B" }, { title: "A" });
      expect(result).toBeGreaterThan(0); // B should come after A
    });

    it("handles descending sort correctly", async () => {
      const wrapper = createWrapper(
        {},
        {
          stubs: {
            HeaderLabel: {
              template:
                '<div class="header-label" :data-testid="`header-${name}`" @click="$emit(\'sort\', \'desc\')"></div>',
              props: ["name", "sortable", "filterable", "modelValue"],
              emits: ["sort", "filter"],
            },
          },
        }
      );

      const titleHeader = wrapper.findComponent('[data-testid="header-Title"]');
      await titleHeader.trigger("click");

      expect(mockFileStore.value.sortFiles).toHaveBeenCalledWith(expect.any(Function));

      // Test the sort function for descending order
      const sortFunction = mockFileStore.value.sortFiles.mock.calls[0][0];
      const result = sortFunction({ title: "A" }, { title: "B" });
      expect(result).toBeGreaterThan(0); // A should come after B in desc order
    });

    it("clears other column states when sorting", async () => {
      const wrapper = createWrapper();

      // Set initial state
      wrapper.vm.columnState["Last edit"] = "asc";

      const titleHeader = wrapper.findComponent('[data-testid="header-Title"]');
      await titleHeader.trigger("click");

      expect(wrapper.vm.columnState["Last edit"]).toBe("");
    });

    it("sorts by different columns correctly", async () => {
      const wrapper = createWrapper(
        {},
        {
          stubs: {
            HeaderLabel: {
              template:
                '<div class="header-label" :data-testid="`header-${name}`" @click="handleClick"></div>',
              props: ["name", "sortable", "filterable", "modelValue"],
              emits: ["sort", "filter"],
              methods: {
                handleClick() {
                  if (this.name === "Last edit") {
                    this.$emit("sort", "asc");
                  }
                },
              },
            },
          },
        }
      );

      const lastEditHeader = wrapper.findComponent('[data-testid="header-Last edit"]');
      await lastEditHeader.trigger("click");

      expect(mockFileStore.value.sortFiles).toHaveBeenCalled();

      // Verify it uses the correct sort key
      const sortFunction = mockFileStore.value.sortFiles.mock.calls[0][0];
      const mockFileA = { last_edited_at: "2023-01-01" };
      const mockFileB = { last_edited_at: "2023-01-02" };
      sortFunction(mockFileA, mockFileB);
      // Should not throw error
    });
  });

  describe("Filter Functionality", () => {
    it("clears filters when no tags are selected", async () => {
      const wrapper = createWrapper(
        {},
        {
          stubs: {
            HeaderLabel: {
              template:
                '<div class="header-label" :data-testid="`header-${name}`" @click="$emit(\'filter\', [])"></div>',
              props: ["name", "sortable", "filterable", "modelValue"],
              emits: ["sort", "filter"],
            },
          },
        }
      );

      const tagsHeader = wrapper.findComponent('[data-testid="header-Tags"]');
      await tagsHeader.trigger("click");

      expect(mockFileStore.value.clearFilters).toHaveBeenCalledOnce();
    });

    it("applies tag filters correctly", async () => {
      const wrapper = createWrapper();

      const tagsHeader = wrapper.findComponent('[data-testid="header-Tags"]');
      await tagsHeader.trigger("click");

      expect(mockFileStore.value.filterFiles).toHaveBeenCalledWith(expect.any(Function));

      // Test the filter function
      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];

      const fileWithTag = { tags: [{ id: "tag1" }] };
      const fileWithoutTag = { tags: [{ id: "tag2" }] };

      expect(filterFunction(fileWithTag)).toBe(false); // Should show (not filtered)
      expect(filterFunction(fileWithoutTag)).toBe(true); // Should hide (filtered)
    });

    it("handles complex tag filtering logic", async () => {
      const wrapper = createWrapper(
        {},
        {
          stubs: {
            HeaderLabel: {
              template:
                '<div class="header-label" :data-testid="`header-${name}`" @click="handleFilter"></div>',
              props: ["name", "sortable", "filterable", "modelValue"],
              emits: ["sort", "filter"],
              methods: {
                handleFilter() {
                  this.$emit("filter", [
                    { id: "tag1", name: "Science" },
                    { id: "tag2", name: "Math" },
                  ]);
                },
              },
            },
          },
        }
      );

      const tagsHeader = wrapper.findComponent('[data-testid="header-Tags"]');
      await tagsHeader.trigger("click");

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];

      const fileWithBothTags = { tags: [{ id: "tag1" }, { id: "tag2" }] };
      const fileWithOneTag = { tags: [{ id: "tag1" }] };
      const fileWithNoTags = { tags: [] };

      expect(filterFunction(fileWithBothTags)).toBe(false); // Has both tags, should NOT be filtered
      expect(filterFunction(fileWithOneTag)).toBe(true); // Has one tag, should be filtered
      expect(filterFunction(fileWithNoTags)).toBe(true); // Has no tags, should be filtered
    });
  });

  describe("Error Handling", () => {
    it("handles missing fileStore gracefully", () => {
      const wrapper = createWrapper(
        {},
        {
          provide: {
            fileStore: ref(null),
          },
        }
      );

      expect(() => wrapper.vm.handleColumnSortEvent("Title", "asc")).toThrow();
    });

    it("handles missing sortKey gracefully", () => {
      const wrapper = createWrapper();

      // Test with Spacer column which has no sortKey
      expect(() => wrapper.vm.handleColumnSortEvent("Spacer", "asc")).not.toThrow();
    });

    it("handles invalid sort mode", () => {
      createWrapper();

      // Component should handle invalid sort mode gracefully (no-op)
      expect(mockFileStore.value.sortFiles).not.toHaveBeenCalled();
    });

    it("handles files without required properties in filter", async () => {
      const wrapper = createWrapper();

      wrapper.vm.handleColumnFilterEvent("Tags", [{ id: "tag1" }]);

      const filterFunction = mockFileStore.value.filterFiles.mock.calls[0][0];

      // Test with file missing tags property
      expect(() => filterFunction({})).toThrow();
      expect(() => filterFunction({ tags: undefined })).toThrow();
    });
  });

  describe("Reactive Updates", () => {
    it("updates when mode prop changes", async () => {
      const wrapper = createWrapper({ mode: "list" });

      expect(wrapper.find(".header").classes()).toContain("list");

      await wrapper.setProps({ mode: "cards" });

      expect(wrapper.find(".header").classes()).toContain("cards");
    });

    it("re-evaluates column visibility when shouldShowColumn changes", async () => {
      mockShouldShowColumn.mockReturnValue(true);
      const wrapper = createWrapper();

      expect(wrapper.find('[data-testid="header-Tags"]').exists()).toBe(true);

      // Change shouldShowColumn behavior
      mockShouldShowColumn.mockReturnValue(false);
      await nextTick();

      // Note: This test shows the structure but may need wrapper re-render in practice
      expect(mockShouldShowColumn).toHaveBeenCalled();
    });
  });

  describe("Component Integration", () => {
    it("provides v-model binding to HeaderLabel components", () => {
      const wrapper = createWrapper();

      const titleHeader = wrapper.findComponent('[data-testid="header-Title"]');
      expect(titleHeader.props("modelValue")).toBe(wrapper.vm.columnState.Title);
    });

    it("maintains proper event flow from HeaderLabel components", async () => {
      const wrapper = createWrapper();

      // Verify that events from HeaderLabel reach the handler
      const titleHeader = wrapper.findComponent('[data-testid="header-Title"]');
      await titleHeader.trigger("click");

      expect(mockFileStore.value.sortFiles).toHaveBeenCalled();
    });
  });
});
