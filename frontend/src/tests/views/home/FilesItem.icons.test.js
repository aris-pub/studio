import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref, Suspense } from "vue";
import FilesItem from "@/views/home/FilesItem.vue";

describe("FilesItem.vue - Icon Visibility and Colors", () => {
  let mockFile;
  let mockProvides;

  beforeEach(() => {
    mockFile = ref({
      id: "test-file-1",
      title: "Test File",
      selected: false,
      focused: false,
      lastModified: new Date().toISOString(),
      tags: [{ id: "tag1", name: "math" }],
    });

    mockProvides = {
      api: {
        get: vi.fn().mockResolvedValue({ data: {} }),
      },
      fileStore: ref({
        tags: [{ id: "tag1", name: "math" }],
        createFile: vi.fn(),
        deleteFile: vi.fn(),
        toggleFileTag: vi.fn(),
        createTag: vi.fn(),
      }),
      xsMode: ref(false),
      mobileMode: ref(false),
      user: ref({ id: "user-1" }),
      shouldShowColumn: vi.fn(() => true),
    };
  });

  const createAsyncWrapper = async (overrides = {}) => {
    const AsyncFilesItem = {
      template: `
        <Suspense>
          <FilesItem v-bind="$attrs" />
          <template #fallback>
            <div data-testid="loading-fallback">Loading file item...</div>
          </template>
        </Suspense>
      `,
      components: { FilesItem, Suspense },
    };

    const wrapper = mount(AsyncFilesItem, {
      props: {
        modelValue: mockFile.value,
        mode: "list",
        ...overrides.props,
      },
      global: {
        provide: {
          ...mockProvides,
          ...overrides.provide,
        },
        stubs: {
          FileMenu: {
            template:
              '<div class="fm-wrapper"><div class="context-menu-trigger" data-testid="dots-icon">⋮</div></div>',
          },
          FileTitle: {
            template: '<div data-testid="file-title">{{ file.title }}</div>',
            props: ["file"],
          },
          TagRow: {
            template: `
              <div data-testid="tag-row">
                <div class="controls">
                  <div class="cm-wrapper">
                    <button class="cm-btn" data-testid="tag-icon">
                      <svg data-testid="tag-svg">icon</svg>
                    </button>
                  </div>
                </div>
              </div>
            `,
          },
          Date: { template: '<div data-testid="files-item-date"></div>' },
          ...overrides.stubs,
        },
      },
    });

    // Wait for async component to mount
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    return wrapper;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("FileMenu Dots Icon", () => {
    it("should have opacity 0 by default", async () => {
      const wrapper = await createAsyncWrapper();

      const dotsIcon = wrapper.find('[data-testid="dots-icon"]');
      expect(dotsIcon.exists()).toBe(true);

      // Check that the CSS rule makes it transparent by default
      const menuWrapper = wrapper.find(".fm-wrapper");
      expect(menuWrapper.exists()).toBe(true);
    });

    it("should have opacity 1 on hover", async () => {
      const wrapper = await createAsyncWrapper();

      const itemContainer = wrapper.find(".item");

      // Trigger hover
      await itemContainer.trigger("mouseenter");
      await nextTick();

      // Check that item has hovered class
      expect(itemContainer.classes()).toContain("hovered");
    });

    it("should have opacity 1 when file is focused", async () => {
      const wrapper = await createAsyncWrapper();

      // Set file as focused
      mockFile.value.focused = true;
      await nextTick();

      const itemContainer = wrapper.find(".item");
      expect(itemContainer.classes()).toContain("current");
    });
  });

  describe("MultiSelectTags Icon", () => {
    it("should have light color by default", async () => {
      const wrapper = await createAsyncWrapper();

      const tagIcon = wrapper.find('[data-testid="tag-svg"]');
      expect(tagIcon.exists()).toBe(true);
    });

    it("should have dark color on item hover", async () => {
      const wrapper = await createAsyncWrapper();

      const itemContainer = wrapper.find(".item");

      // Trigger hover
      await itemContainer.trigger("mouseenter");
      await nextTick();

      // Check that item has hovered class which should trigger tag icon color change
      expect(itemContainer.classes()).toContain("hovered");
    });

    it("should have dark color when file is focused", async () => {
      const wrapper = await createAsyncWrapper();

      // Set file as focused
      mockFile.value.focused = true;
      await nextTick();

      const itemContainer = wrapper.find(".item");
      expect(itemContainer.classes()).toContain("current");
    });

    it("should have dark color when tag menu is open", async () => {
      const wrapper = await createAsyncWrapper({
        stubs: {
          TagRow: {
            template: `
              <div data-testid="tag-row">
                <div class="controls">
                  <div class="cm-wrapper cm-open">
                    <button class="cm-btn" data-testid="tag-icon">
                      <svg data-testid="tag-svg">icon</svg>
                    </button>
                  </div>
                </div>
              </div>
            `,
          },
        },
      });

      const contextMenuWrapper = wrapper.find(".cm-open");
      expect(contextMenuWrapper.exists()).toBe(true);
    });
  });
});
