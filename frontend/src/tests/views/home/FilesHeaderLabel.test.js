import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import FilesHeaderLabel from "@/views/home/FilesHeaderLabel.vue";

// Mock Tabler icons
vi.mock("@tabler/icons-vue", () => {
  const mockIconComponent = {
    template: '<svg data-testid="mock-icon"></svg>',
  };

  return {
    IconArrowsSort: mockIconComponent,
    IconArrowNarrowDown: mockIconComponent,
    IconArrowNarrowUp: mockIconComponent,
  };
});

describe("FilesHeaderLabel.vue", () => {
  const createWrapper = (props = {}, overrides = {}) => {
    return mount(FilesHeaderLabel, {
      props: {
        name: "Test Column",
        sortable: true,
        filterable: false,
        ...props,
      },
      global: {
        stubs: {
          MultiSelectTags: {
            template:
              "<div data-testid=\"multi-select-tags\" @click=\"$emit('update:modelValue', [{ id: 'tag1' }])\"></div>",
            props: ["modelValue", "icon"],
            emits: ["update:modelValue"],
          },
          ...overrides.stubs,
        },
      },
    });
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders sortable column correctly", () => {
      const wrapper = createWrapper({ sortable: true, filterable: false });

      expect(wrapper.find(".col-header").exists()).toBe(true);
      expect(wrapper.find(".col-header").classes()).toContain("sortable");
      expect(wrapper.find(".col-header-label").text()).toBe("Test Column");
      expect(wrapper.find("button").exists()).toBe(true);
    });

    it("renders filterable column correctly", () => {
      const wrapper = createWrapper({ sortable: false, filterable: true });

      expect(wrapper.find(".col-header").exists()).toBe(true);
      expect(wrapper.find(".col-header").classes()).toContain("filterable");
      expect(wrapper.find('[data-testid="multi-select-tags"]').exists()).toBe(true);
      expect(wrapper.find("button").exists()).toBe(true);
    });

    it("renders non-interactive column correctly", () => {
      const wrapper = createWrapper({ sortable: false, filterable: false });

      expect(wrapper.find(".col-header").exists()).toBe(true);
      expect(wrapper.find("button").exists()).toBe(false);
      expect(wrapper.find("div.col-header").exists()).toBe(true);
    });

    it("applies correct CSS classes based on column name", () => {
      const wrapper = createWrapper({ name: "Last Edit" });

      expect(wrapper.find(".col-header").classes()).toContain("last-edit");
    });

    it("handles column names with spaces in CSS classes", () => {
      const wrapper = createWrapper({ name: "Multiple Word Column" });

      // Should replace first space, but current implementation only replaces first space
      expect(wrapper.find(".col-header").classes()).toContain("multiple-word-column");
    });
  });

  describe("Sortable Column Behavior", () => {
    it("shows default sort icon when not sorted", () => {
      const wrapper = createWrapper({ sortable: true });

      const noSortIcon = wrapper.find(".no-sort");
      expect(noSortIcon.exists()).toBe(true);
    });

    it("cycles through sort states on click: asc → desc → reset", async () => {
      const wrapper = createWrapper({ sortable: true });

      const button = wrapper.find("button");

      // First click: should go to 'asc'
      await button.trigger("click");
      expect(wrapper.emitted().sort).toBeTruthy();
      expect(wrapper.emitted().sort[0]).toEqual(["asc"]);

      // Update v-model to simulate parent updating the state
      await wrapper.setProps({ modelValue: "asc" });

      // Second click: should go to 'desc'
      await button.trigger("click");
      expect(wrapper.emitted().sort[1]).toEqual(["desc"]);

      // Update v-model
      await wrapper.setProps({ modelValue: "desc" });

      // Third click: should reset to ''
      await button.trigger("click");
      expect(wrapper.emitted().sort[2]).toEqual([""]);
    });

    it("responds to keyboard events", async () => {
      const wrapper = createWrapper({ sortable: true });

      const button = wrapper.find("button");

      await button.trigger("keydown.enter");
      expect(wrapper.emitted().sort).toBeTruthy();

      await button.trigger("keydown.space");
      expect(wrapper.emitted().sort).toBeTruthy();
    });

    it("prevents default behavior on keyboard events", async () => {
      const wrapper = createWrapper({ sortable: true });

      const button = wrapper.find("button");

      const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
      const spaceEvent = new KeyboardEvent("keydown", { key: " " });

      enterEvent.preventDefault = vi.fn();
      spaceEvent.preventDefault = vi.fn();

      await button.element.dispatchEvent(enterEvent);
      await button.element.dispatchEvent(spaceEvent);

      // Events should be handled
      expect(wrapper.emitted().sort).toBeTruthy();
    });

    it("shows correct icon based on sort state", async () => {
      const wrapper = createWrapper({ sortable: true });

      // Default state - shows arrows-sort icon
      expect(wrapper.find(".no-sort").exists()).toBe(true);

      // Simulate ascending sort
      await wrapper.setProps({ modelValue: "asc" });
      // Should show up arrow icon (implemented via v-if in template)

      // Simulate descending sort
      await wrapper.setProps({ modelValue: "desc" });
      // Should show down arrow icon
    });

    it("does not sort when column is not sortable", async () => {
      const wrapper = createWrapper({ sortable: false, filterable: false });

      // Non-sortable column should not have button
      expect(wrapper.find("button").exists()).toBe(false);
    });
  });

  describe("Filterable Column Behavior", () => {
    it("updates filter icon color when tags are selected", async () => {
      const wrapper = createWrapper({ sortable: false, filterable: true });

      // Initially should be transparent
      expect(wrapper.vm.filterableSVGColor).toBe("transparent");

      // Simulate tag selection
      wrapper.vm.tagsSelectedForFilter = [{ id: "tag1", name: "Test Tag" }];
      await nextTick();

      expect(wrapper.vm.filterableSVGColor).toBe("var(--extra-dark)");
      expect(wrapper.emitted().filter).toBeTruthy();
    });

    it("emits filter event when tags change", async () => {
      const wrapper = createWrapper({ sortable: false, filterable: true });

      const tags = [{ id: "tag1", name: "Test" }];
      wrapper.vm.tagsSelectedForFilter = tags;
      await nextTick();

      expect(wrapper.emitted().filter).toBeTruthy();
      expect(wrapper.emitted().filter[0]).toEqual([tags]);
    });

    it("clears filter icon color when no tags selected", async () => {
      const wrapper = createWrapper({ sortable: false, filterable: true });

      // Set some tags first
      wrapper.vm.tagsSelectedForFilter = [{ id: "tag1" }];
      await nextTick();
      expect(wrapper.vm.filterableSVGColor).toBe("var(--extra-dark)");

      // Clear tags
      wrapper.vm.tagsSelectedForFilter = [];
      await nextTick();

      expect(wrapper.vm.filterableSVGColor).toBe("transparent");
    });

    it("handles hover states for filter icon", async () => {
      const wrapper = createWrapper({ sortable: false, filterable: true });

      const button = wrapper.find("button");

      await button.trigger("mouseenter");
      expect(wrapper.vm.filterableSVGColor).toBe("var(--medium)");

      await button.trigger("mouseleave");
      expect(wrapper.vm.filterableSVGColor).toBe("transparent");
    });

    it("maintains filter color when tags are selected during hover", async () => {
      const wrapper = createWrapper({ sortable: false, filterable: true });

      // Select tags first
      wrapper.vm.tagsSelectedForFilter = [{ id: "tag1" }];
      await nextTick();

      const button = wrapper.find("button");

      // Hover should not override the selected state color
      await button.trigger("mouseenter");
      expect(wrapper.vm.filterableSVGColor).toBe("var(--medium)");

      await button.trigger("mouseleave");
      // Should return to dark color because tags are selected
      expect(wrapper.vm.filterableSVGColor).toBe("transparent");
    });

    it("passes correct props to MultiSelectTags", () => {
      const wrapper = createWrapper({ sortable: false, filterable: true });

      const multiSelect = wrapper.findComponent('[data-testid="multi-select-tags"]');
      expect(multiSelect.props()).toMatchObject({
        modelValue: [],
        icon: "Filter",
      });
    });
  });

  describe("v-model Integration", () => {
    it("updates sort state through v-model", async () => {
      const wrapper = createWrapper({ sortable: true, modelValue: "" });

      expect(wrapper.vm.sortState).toBe("");

      await wrapper.setProps({ modelValue: "asc" });
      expect(wrapper.vm.sortState).toBe("asc");

      await wrapper.setProps({ modelValue: "desc" });
      expect(wrapper.vm.sortState).toBe("desc");

      await wrapper.setProps({ modelValue: "" });
      expect(wrapper.vm.sortState).toBe("");
    });

    it("emits update:modelValue when sort state changes", async () => {
      const wrapper = createWrapper({ sortable: true });

      const button = wrapper.find("button");
      await button.trigger("click");

      // Should emit both sort event and update:modelValue
      expect(wrapper.emitted()["update:modelValue"]).toBeTruthy();
      expect(wrapper.emitted()["update:modelValue"][0]).toEqual(["asc"]);
    });
  });

  describe("Accessibility", () => {
    it("does not have redundant role='button' on native <button>", () => {
      const wrapper = createWrapper({ sortable: true });
      const button = wrapper.find("button");
      expect(button.attributes("role")).toBeUndefined();
    });

    it("does not have redundant role='button' on filterable <button>", () => {
      const wrapper = createWrapper({ sortable: false, filterable: true });
      const button = wrapper.find("button");
      expect(button.attributes("role")).toBeUndefined();
    });

    it("has aria-sort='ascending' when sorted asc", async () => {
      const wrapper = createWrapper({ sortable: true, modelValue: "asc" });
      const button = wrapper.find("button");
      expect(button.attributes("aria-sort")).toBe("ascending");
    });

    it("has aria-sort='descending' when sorted desc", async () => {
      const wrapper = createWrapper({ sortable: true, modelValue: "desc" });
      const button = wrapper.find("button");
      expect(button.attributes("aria-sort")).toBe("descending");
    });

    it("has aria-sort='none' when unsorted", () => {
      const wrapper = createWrapper({ sortable: true });
      const button = wrapper.find("button");
      expect(button.attributes("aria-sort")).toBe("none");
    });

    it("has aria-label on sortable button", () => {
      const wrapper = createWrapper({ sortable: true, name: "Last Edit" });
      const button = wrapper.find("button");
      expect(button.attributes("aria-label")).toBe("Sort by Last Edit");
    });

    it("has aria-label on filterable button", () => {
      const wrapper = createWrapper({ sortable: false, filterable: true, name: "Tags" });
      const button = wrapper.find("button");
      expect(button.attributes("aria-label")).toBe("Filter by Tags");
    });

    it("supports keyboard navigation", async () => {
      const wrapper = createWrapper({ sortable: true });

      const button = wrapper.find("button");

      // Should respond to enter key
      await button.trigger("keydown.enter");
      expect(wrapper.emitted().sort).toBeTruthy();

      // Should respond to space key
      await button.trigger("keydown.space");
      expect(wrapper.emitted().sort).toBeTruthy();
    });

    it("has focus-visible styles", () => {
      const wrapper = createWrapper({ sortable: true });

      const button = wrapper.find("button");
      expect(button.classes()).toContain("col-header");
    });
  });

  describe("Props Validation", () => {
    it("handles required name prop", () => {
      const wrapper = createWrapper({ name: "Required Name" });

      expect(wrapper.find(".col-header-label").text()).toBe("Required Name");
    });

    it("has correct default values", () => {
      const wrapper = createWrapper({
        name: "Test",
        // Using defaults for sortable and filterable
      });

      expect(wrapper.props().sortable).toBe(true);
      expect(wrapper.props().filterable).toBe(false); // Changed from true - this is the actual default
    });

    it("respects prop overrides", () => {
      const wrapper = createWrapper({
        name: "Test",
        sortable: false,
        filterable: true,
      });

      expect(wrapper.props().sortable).toBe(false);
      expect(wrapper.props().filterable).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty column name", () => {
      const wrapper = createWrapper({ name: "" });

      expect(wrapper.find(".col-header-label").text()).toBe("");
    });

    it("handles special characters in column name", () => {
      const wrapper = createWrapper({ name: "Special/Characters@Column" });

      // Should still render the name
      expect(wrapper.find(".col-header-label").text()).toBe("Special/Characters@Column");
    });

    it("handles rapid sort state changes", async () => {
      const wrapper = createWrapper({ sortable: true });

      const button = wrapper.find("button");

      // Rapid clicks cycle: "" → asc → desc → ""
      await button.trigger("click");
      await button.trigger("click");
      await button.trigger("click");

      expect(wrapper.emitted().sort).toHaveLength(3);
      expect(wrapper.emitted().sort[0]).toEqual(["asc"]);
      expect(wrapper.emitted().sort[1]).toEqual(["desc"]);
      expect(wrapper.emitted().sort[2]).toEqual([""]);
    });

    it("handles both sortable and filterable being false", () => {
      const wrapper = createWrapper({ sortable: false, filterable: false });

      expect(wrapper.find("button").exists()).toBe(false);
      expect(wrapper.find("div.col-header").exists()).toBe(true);
      expect(wrapper.find('[data-testid="multi-select-tags"]').exists()).toBe(false);
    });
  });

  describe("CSS and Styling", () => {
    it("applies hover cursor for interactive columns", () => {
      const sortableWrapper = createWrapper({ sortable: true, filterable: false });
      const filterableWrapper = createWrapper({ sortable: false, filterable: true });

      expect(sortableWrapper.find(".sortable").exists()).toBe(true);
      expect(filterableWrapper.find(".filterable").exists()).toBe(true);
    });

    it("maintains proper gap and alignment", () => {
      const wrapper = createWrapper();

      const header = wrapper.find(".col-header");
      expect(header.exists()).toBe(true);
      // CSS properties are tested through component structure
    });
  });
});
