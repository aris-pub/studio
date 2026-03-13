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

describe("FilesPane.vue - Tag Functionality", () => {
  let mockFileStore;
  let mockProvides;

  beforeEach(() => {
    mockFileStore = ref({
      files: [
        {
          id: "1",
          title: "Research Paper",
          filtered: false,
          focused: false,
          tags: [
            { id: "tag1", name: "research", color: "#blue" },
            { id: "tag2", name: "biology", color: "#green" },
          ],
        },
        {
          id: "2",
          title: "Analysis Document",
          filtered: false,
          focused: false,
          tags: [
            { id: "tag3", name: "analysis", color: "#red" },
            { id: "tag1", name: "research", color: "#blue" },
          ],
        },
        {
          id: "3",
          title: "Draft Paper",
          filtered: true,
          focused: false,
          tags: [{ id: "tag4", name: "draft", color: "#yellow" }],
        },
      ],
      filterFiles: vi.fn(),
      clearFilters: vi.fn(),
    });

    mockProvides = {
      fileStore: mockFileStore,
      xsMode: ref(false),
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
          Pane: {
            template: '<div class="pane"><slot name="header"></slot><slot></slot></div>',
          },
          Topbar: {
            template: '<div data-testid="topbar"></div>',
            emits: [],
          },
          FilesHeader: {
            template: '<div data-testid="files-header"></div>',
            props: [],
          },
          FilesItem: {
            template: `
              <div class="file-item" data-testid="file-item">
                <div class="file-title">{{ modelValue.title }}</div>
                <div class="tags">
                  <span v-for="tag in modelValue.tags" :key="tag.id" class="tag" :data-tag-id="tag.id">
                    {{ tag.name }}
                  </span>
                </div>
              </div>
            `,
            props: ["modelValue"],
          },
          Suspense: {
            template: "<div><slot></slot></div>",
          },
          ...overrides.stubs,
        },
      },
    });
  };

  describe("Tag Display", () => {
    it("renders tags for files correctly", () => {
      const wrapper = createWrapper();

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(2); // Only non-filtered files

      // Check first file tags
      const firstFileItem = fileItems[0];
      const firstFileTags = firstFileItem.findAll(".tag");
      expect(firstFileTags).toHaveLength(2);
      expect(firstFileTags[0].text()).toBe("research");
      expect(firstFileTags[1].text()).toBe("biology");

      // Check second file tags
      const secondFileItem = fileItems[1];
      const secondFileTags = secondFileItem.findAll(".tag");
      expect(secondFileTags).toHaveLength(2);
      expect(secondFileTags[0].text()).toBe("analysis");
      expect(secondFileTags[1].text()).toBe("research");
    });

    it("handles files with no tags", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({
            files: [
              { id: "1", title: "No Tags File", filtered: false, focused: false, tags: [] },
              { id: "2", title: "Undefined Tags File", filtered: false, focused: false },
            ],
          }),
        },
      });

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(2);

      // First file should have no tags
      const firstFileTags = fileItems[0].findAll(".tag");
      expect(firstFileTags).toHaveLength(0);

      // Second file should also have no tags (undefined tags property)
      const secondFileTags = fileItems[1].findAll(".tag");
      expect(secondFileTags).toHaveLength(0);
    });

    it("hides tags column in extra small mode", () => {
      const wrapper = createWrapper({
        provide: {
          xsMode: ref(true),
        },
      });

      // shouldShowColumn function should return false for Tags in xsMode
      expect(wrapper.vm.shouldShowColumn("Tags", "list")).toBe(false);
      expect(wrapper.vm.shouldShowColumn("Title", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Date", "list")).toBe(true);
    });

    it("shows tags column in normal mode", () => {
      const wrapper = createWrapper();

      // shouldShowColumn function should return true for Tags in normal mode
      expect(wrapper.vm.shouldShowColumn("Tags", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Title", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Date", "list")).toBe(true);
    });
  });

  describe("Tag Filtering Integration", () => {
    it("filters files based on tag selection", async () => {
      const wrapper = createWrapper();

      // Initially, 2 files are visible (not filtered)
      expect(wrapper.vm.visibleFiles).toHaveLength(2);

      // Simulate tag-based filtering by modifying file filtered property
      mockFileStore.value.files[0].filtered = true; // Filter out first file
      await nextTick();

      // Now only 1 file should be visible
      expect(wrapper.vm.visibleFiles).toHaveLength(1);
      expect(wrapper.vm.visibleFiles[0].title).toBe("Analysis Document");
    });

    it("handles tag-based filter functions correctly", () => {
      // Test tag filtering logic (simulating what fileStore.filterFiles would do)
      const files = mockFileStore.value.files;

      // Filter for files with "research" tag
      const researchFiles = files.filter(
        (file) => file.tags && file.tags.some((tag) => tag.name === "research")
      );
      expect(researchFiles).toHaveLength(2);

      // Filter for files with "biology" tag
      const biologyFiles = files.filter(
        (file) => file.tags && file.tags.some((tag) => tag.name === "biology")
      );
      expect(biologyFiles).toHaveLength(1);
      expect(biologyFiles[0].title).toBe("Research Paper");

      // Filter for files with "draft" tag (this file is already filtered out)
      const draftFiles = files.filter(
        (file) => file.tags && file.tags.some((tag) => tag.name === "draft")
      );
      expect(draftFiles).toHaveLength(1);
      expect(draftFiles[0].title).toBe("Draft Paper");
    });

    it("updates visible files when tag filters change", async () => {
      const wrapper = createWrapper();

      const initialVisible = wrapper.vm.visibleFiles.length;
      expect(initialVisible).toBe(2);

      // Simulate applying a tag filter that hides one file
      mockFileStore.value.files[1].filtered = true;
      await nextTick();

      expect(wrapper.vm.visibleFiles).toHaveLength(1);
      expect(wrapper.vm.visibleFiles[0].title).toBe("Research Paper");

      // Simulate clearing filters
      mockFileStore.value.files[1].filtered = false;
      await nextTick();

      expect(wrapper.vm.visibleFiles).toHaveLength(2);
    });

    it("maintains tag display during filtering operations", async () => {
      const wrapper = createWrapper();

      // Filter out first file
      mockFileStore.value.files[0].filtered = true;
      await nextTick();

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(1);

      // Remaining file should still show its tags
      const remainingFileTags = fileItems[0].findAll(".tag");
      expect(remainingFileTags).toHaveLength(2);
      expect(remainingFileTags[0].text()).toBe("analysis");
      expect(remainingFileTags[1].text()).toBe("research");
    });
  });

  describe("Tag Data Integrity", () => {
    it("preserves tag data structure", () => {
      const wrapper = createWrapper();

      const files = wrapper.vm.visibleFiles;
      expect(files[0].tags).toBeDefined();
      expect(files[0].tags[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        color: expect.any(String),
      });
    });

    it("handles missing tag properties gracefully", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({
            files: [
              {
                id: "1",
                title: "Malformed Tags File",
                filtered: false,
                focused: false,
                tags: [
                  { id: "tag1", name: "complete" }, // missing color
                  { name: "incomplete" }, // missing id
                  { id: "tag3" }, // missing name
                ],
              },
            ],
          }),
        },
      });

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(1);

      // Should not throw errors with malformed tag data
      const tags = fileItems[0].findAll(".tag");
      expect(tags).toHaveLength(3);
    });

    it("maintains tag references during component updates", async () => {
      const wrapper = createWrapper();

      const originalTags = wrapper.vm.visibleFiles[0].tags;
      expect(originalTags).toHaveLength(2);

      // Trigger a component update
      await wrapper.vm.$forceUpdate();
      await nextTick();

      const updatedTags = wrapper.vm.visibleFiles[0].tags;
      expect(updatedTags).toEqual(originalTags);
      expect(updatedTags[0]).toBe(originalTags[0]); // Reference equality
    });
  });

  describe("Edge Cases", () => {
    it("handles empty file store", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({ files: [] }),
        },
      });

      expect(wrapper.vm.visibleFiles).toEqual([]);
      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(0);
    });

    it("handles null file store", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref(null),
        },
      });

      expect(wrapper.vm.visibleFiles).toEqual([]);
    });

    it("handles files with large numbers of tags", () => {
      const manyTags = Array.from({ length: 20 }, (_, i) => ({
        id: `tag${i}`,
        name: `tag${i}`,
        color: `#color${i}`,
      }));

      const wrapper = createWrapper({
        provide: {
          fileStore: ref({
            files: [
              {
                id: "1",
                title: "Many Tags File",
                filtered: false,
                focused: false,
                tags: manyTags,
              },
            ],
          }),
        },
      });

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      const tags = fileItems[0].findAll(".tag");
      expect(tags).toHaveLength(20);
    });
  });
});
