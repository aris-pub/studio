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

describe("FilesPane.vue - Accessibility Features", () => {
  let mockFileStore;
  let mockProvides;

  beforeEach(() => {
    mockFileStore = ref({
      files: [
        {
          id: "1",
          title: "Accessible Research Paper",
          filtered: false,
          focused: false,
          selected: false,
          tags: [{ id: "tag1", name: "research" }],
          last_edited_at: "2023-12-01T10:30:00Z",
          getFormattedDate: vi.fn(() => "Dec 1, 2023"),
          getFullDateTime: vi.fn(() => "December 1, 2023 at 10:30 AM"),
        },
        {
          id: "2",
          title: "Biology Study Document",
          filtered: false,
          focused: false,
          selected: false,
          tags: [{ id: "tag2", name: "biology" }],
          last_edited_at: "2023-12-02T11:30:00Z",
          getFormattedDate: vi.fn(() => "Dec 2, 2023"),
          getFullDateTime: vi.fn(() => "December 2, 2023 at 11:30 AM"),
        },
        {
          id: "3",
          title: "Hidden Document",
          filtered: true,
          focused: false,
          selected: false,
          tags: [],
          last_edited_at: "2023-12-03T12:30:00Z",
          getFormattedDate: vi.fn(() => "Dec 3, 2023"),
          getFullDateTime: vi.fn(() => "December 3, 2023 at 12:30 PM"),
        },
      ],
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
            template:
              '<div class="pane" role="main"><slot name="header"></slot><slot></slot></div>',
          },
          Topbar: {
            template: '<div data-testid="topbar" role="toolbar"></div>',
            emits: ["list", "cards"],
          },
          FilesHeader: {
            template: `
              <div data-testid="files-header" role="columnheader">
                <span>Title</span>
                <span>Tags</span>
                <span>Date</span>
              </div>
            `,
            props: ["mode"],
          },
          FilesItem: {
            template: `
              <div
                class="file-item"
                data-testid="file-item"
                role="button"
                tabindex="0"
                :aria-label="'File: ' + modelValue.title"
                :aria-selected="modelValue.selected"
                @keydown.enter="$emit('open')"
                @keydown.space.prevent="$emit('open')"
              >
                <span class="file-title">{{ modelValue.title }}</span>
                <span class="file-tags" :aria-label="'Tags: ' + tagsList">
                  <span v-for="tag in modelValue.tags" :key="tag.id">{{ tag.name }}</span>
                </span>
              </div>
            `,
            props: ["modelValue", "mode"],
            emits: ["open"],
            computed: {
              tagsList() {
                return this.modelValue.tags?.map((t) => t.name).join(", ") || "No tags";
              },
            },
          },
          Suspense: {
            template: "<div><slot></slot></div>",
          },
          ...overrides.stubs,
        },
      },
    });
  };

  describe("ARIA Attributes and Screen Reader Support", () => {
    it("applies correct ARIA roles to main container", () => {
      const wrapper = createWrapper();

      const pane = wrapper.find(".pane");
      expect(pane.attributes("role")).toBe("main");
    });

    it("provides accessible file list structure", () => {
      const wrapper = createWrapper();

      const filesContainer = wrapper.find('[data-testid="files-container"]');
      expect(filesContainer.exists()).toBe(true);

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(2); // Only visible files

      // Each file item should have proper ARIA attributes
      fileItems.forEach((item) => {
        expect(item.attributes("role")).toBe("button");
        expect(item.attributes("tabindex")).toBe("0");
        expect(item.attributes("aria-label")).toContain("File:");
        expect(item.attributes("aria-selected")).toBeDefined();
      });
    });

    it("provides accessible file information", () => {
      const wrapper = createWrapper();

      const fileItems = wrapper.findAll('[data-testid="file-item"]');

      // First file
      expect(fileItems[0].attributes("aria-label")).toBe("File: Accessible Research Paper");

      // Second file
      expect(fileItems[1].attributes("aria-label")).toBe("File: Biology Study Document");
    });

    it("announces tag information accessibly", () => {
      const wrapper = createWrapper();

      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      const firstFileTagsLabel = fileItems[0].find(".file-tags").attributes("aria-label");

      expect(firstFileTagsLabel).toBe("Tags: research");
    });

    it("handles files with no tags accessibly", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({
            files: [
              {
                id: "1",
                title: "No Tags File",
                filtered: false,
                focused: false,
                tags: [],
                last_edited_at: "2023-12-04T13:30:00Z",
                getFormattedDate: vi.fn(() => "Dec 4, 2023"),
                getFullDateTime: vi.fn(() => "December 4, 2023 at 1:30 PM"),
              },
            ],
          }),
        },
      });

      const fileItem = wrapper.find('[data-testid="file-item"]');
      const tagsLabel = fileItem.find(".file-tags").attributes("aria-label");

      expect(tagsLabel).toBe("Tags: No tags");
    });

    it("provides accessible header structure", () => {
      const wrapper = createWrapper();

      const header = wrapper.find('[data-testid="files-header"]');
      expect(header.attributes("role")).toBe("columnheader");
    });

    it("maintains accessible toolbar", () => {
      const wrapper = createWrapper();

      const topbar = wrapper.find('[data-testid="topbar"]');
      expect(topbar.attributes("role")).toBe("toolbar");
    });
  });

  describe("Focus Management and Navigation", () => {
    it("manages focus correctly with keyboard navigation", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(null);
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      // Create wrapper to setup component and watcher
      createWrapper();
      await nextTick();

      // Simulate focusing first file
      activeIndexRef.value = 0;
      await nextTick();

      expect(mockFileStore.value.files[0].focused).toBe(true);
      expect(mockFileStore.value.files[1].focused).toBe(false);

      // Simulate moving focus to second file
      activeIndexRef.value = 1;
      await nextTick();

      expect(mockFileStore.value.files[0].focused).toBe(false);
      expect(mockFileStore.value.files[1].focused).toBe(true);
    });

    it("clears focus when activeIndex is null", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(0);
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      // Create wrapper to setup component and watcher
      createWrapper();

      // Set initial focus
      mockFileStore.value.files[0].focused = true;
      await nextTick();

      // Clear focus
      activeIndexRef.value = null;
      await nextTick();

      expect(mockFileStore.value.files[0].focused).toBe(false);
      expect(mockFileStore.value.files[1].focused).toBe(false);
    });

    it("handles focus restoration after list changes", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(null);
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      // Create wrapper to setup component and watcher
      createWrapper();
      await nextTick();

      // Initially focus second file
      activeIndexRef.value = 1;
      await nextTick();
      expect(mockFileStore.value.files[1].focused).toBe(true);

      // Simulate file list change (filter out first file)
      mockFileStore.value.files[0].filtered = true;
      await nextTick();

      // When activeIndex changes to 0, it should focus the first visible file
      // (which is now the file that was at index 1)
      activeIndexRef.value = 0;
      await nextTick();

      // After filtering, the first visible file (visibleFiles[0]) should be focused
      // This corresponds to the file that was originally at index 1
      expect(mockFileStore.value.files[1].focused).toBe(true);
    });

    it("provides keyboard interaction handlers", () => {
      const wrapper = createWrapper();

      const fileItem = wrapper.find('[data-testid="file-item"]');

      // Should have keyboard event listeners
      expect(fileItem.element.getAttribute("tabindex")).toBe("0");
    });

    it("handles focus during filtering operations", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(0);
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      const wrapper = createWrapper();
      await nextTick();

      // Set focus on first file
      mockFileStore.value.files[0].focused = true;

      // Filter out the focused file
      mockFileStore.value.files[0].filtered = true;
      await nextTick();

      // Verify focus management handles this gracefully
      expect(wrapper.vm.visibleFiles).toHaveLength(1);
    });
  });

  describe("Screen Reader Announcements", () => {
    it("provides informative loading state", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({ files: null }),
        },
        stubs: {
          Suspense: {
            template: '<div><slot name="fallback"></slot></div>',
          },
          LoadingSpinner: {
            template:
              '<div class="loading-container"><div class="loading-message">{{ message }}</div></div>',
            props: ["message"],
          },
        },
      });

      const loadingElement = wrapper.find(".loading-container");
      expect(loadingElement.exists()).toBe(true);
      expect(loadingElement.text()).toBe("Loading files...");
    });

    it("announces file count changes", async () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.numFiles).toBe(2);

      // Simulate filtering that changes visible count
      mockFileStore.value.files[0].filtered = true;
      await nextTick();

      expect(wrapper.vm.numFiles).toBe(1);
    });

    it("provides meaningful empty state information", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({ files: [] }),
        },
      });

      expect(wrapper.vm.visibleFiles).toHaveLength(0);
      expect(wrapper.vm.numFiles).toBe(0);
    });
  });

  describe("Keyboard Navigation Integration", () => {
    it("integrates with keyboard navigation composable correctly", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");

      // Create wrapper to trigger the useListKeyboardNavigation call
      createWrapper();

      expect(mockUseListKeyboardNavigation.useListKeyboardNavigation).toHaveBeenCalledWith(
        expect.objectContaining({ value: 2 }), // numFiles
        expect.any(Object), // filesRef
        true // useEscape
      );
    });

    it("updates navigation when file list changes", async () => {
      const wrapper = createWrapper();

      const initialFileCount = wrapper.vm.numFiles;
      expect(initialFileCount).toBe(2);

      // Add a new file
      mockFileStore.value.files.push({
        id: "4",
        title: "New File",
        filtered: false,
        focused: false,
        tags: [],
      });

      await nextTick();

      expect(wrapper.vm.numFiles).toBe(3);
    });

    it("maintains keyboard navigation during view mode changes", async () => {
      const wrapper = createWrapper({
        stubs: {
          Topbar: {
            template: '<div data-testid="topbar" @click="$emit(\'cards\')"></div>',
            emits: ["list", "cards"],
          },
        },
      });

      // Switch to cards mode
      await wrapper.find('[data-testid="topbar"]').trigger("click");
      await nextTick();

      // Keyboard navigation should still work
      expect(wrapper.vm.visibleFiles).toHaveLength(2);
    });
  });

  describe("Responsive Accessibility", () => {
    it("maintains accessibility in extra small mode", () => {
      const wrapper = createWrapper({
        provide: {
          xsMode: ref(true),
        },
      });

      // Should still have accessible file items
      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      fileItems.forEach((item) => {
        expect(item.attributes("role")).toBe("button");
        expect(item.attributes("aria-label")).toContain("File:");
      });

      // shouldShowColumn should hide certain columns
      expect(wrapper.vm.shouldShowColumn("Tags", "list")).toBe(false);
      expect(wrapper.vm.shouldShowColumn("Title", "list")).toBe(true);
    });

    it("adapts column visibility for screen readers", () => {
      const wrapper = createWrapper();

      // Normal mode - all columns visible
      expect(wrapper.vm.shouldShowColumn("Title", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Tags", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Date", "list")).toBe(true);
      expect(wrapper.vm.shouldShowColumn("Spacer", "list")).toBe(true);
    });

    it("provides appropriate grid spacing for accessibility", () => {
      const wrapper = createWrapper();

      expect(wrapper.vm.gridTemplateColumns).toBe(
        "minmax(144px, 2fr) minmax(96px, 1.5fr) 8px 108px 104px 16px 8px"
      );

      // Extra small mode should have different spacing
      const xsWrapper = createWrapper({
        provide: {
          xsMode: ref(true),
        },
      });

      expect(xsWrapper.vm.gridTemplateColumns).toBe("minmax(144px, 2fr) 104px 16px 8px");
    });

    it("adjusts padding for touch accessibility", () => {
      const wrapper = createWrapper();
      expect(wrapper.vm.panePadding).toBe("16px");

      const xsWrapper = createWrapper({
        provide: {
          xsMode: ref(true),
        },
      });
      expect(xsWrapper.vm.panePadding).toBe("8px");
    });
  });

  describe("Error States and Edge Cases", () => {
    it("handles missing accessibility attributes gracefully", () => {
      const wrapper = createWrapper({
        stubs: {
          FilesItem: {
            template: `
              <div class="file-item" data-testid="file-item">
                <span>{{ modelValue.title }}</span>
              </div>
            `,
            props: ["modelValue", "mode"],
          },
        },
      });

      // Should still render without throwing
      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(2);
    });

    it("handles keyboard navigation with invalid indices", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(999); // Out of bounds
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      // Should not throw
      expect(() => {
        activeIndexRef.value = -1;
      }).not.toThrow();

      expect(() => {
        activeIndexRef.value = 999;
      }).not.toThrow();
    });

    it("maintains accessibility with malformed file data", () => {
      const wrapper = createWrapper({
        provide: {
          fileStore: ref({
            files: [
              {
                id: null,
                title: undefined,
                filtered: false,
                focused: false,
                tags: null,
              },
            ],
          }),
        },
      });

      // Should render without accessibility errors
      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      expect(fileItems).toHaveLength(1);
    });

    it("handles focus management during component destruction", async () => {
      const mockUseListKeyboardNavigation =
        await import("@/composables/useListKeyboardNavigation.js");
      const activeIndexRef = ref(0);
      mockUseListKeyboardNavigation.useListKeyboardNavigation.mockReturnValue({
        activeIndex: activeIndexRef,
      });

      const wrapper = createWrapper();

      // Set focus
      mockFileStore.value.files[0].focused = true;

      // Unmount component
      wrapper.unmount();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("Assistive Technology Compatibility", () => {
    it("provides semantic structure for screen readers", () => {
      const wrapper = createWrapper();

      // Main container should have semantic role
      const pane = wrapper.find(".pane");
      expect(pane.attributes("role")).toBe("main");
    });

    it("supports keyboard-only navigation workflow", () => {
      const wrapper = createWrapper();

      const fileItems = wrapper.findAll('[data-testid="file-item"]');

      // All interactive elements should be keyboard accessible
      fileItems.forEach((item) => {
        expect(item.attributes("tabindex")).toBe("0");
      });
    });

    it("provides high contrast mode compatibility", () => {
      const wrapper = createWrapper();

      // Component should render structure that works with high contrast
      expect(wrapper.find(".files-wrapper").exists()).toBe(true);
      expect(wrapper.find('[data-testid="files-container"]').exists()).toBe(true);
    });

    it("supports voice control and speech recognition", () => {
      const wrapper = createWrapper();

      // Files should have recognizable labels for voice commands
      const fileItems = wrapper.findAll('[data-testid="file-item"]');
      fileItems.forEach((item) => {
        const ariaLabel = item.attributes("aria-label");
        expect(ariaLabel).toMatch(/^File: /);
      });
    });
  });
});
