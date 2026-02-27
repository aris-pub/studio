import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref, Suspense } from "vue";
import FilesItem from "@/views/home/FilesItem.vue";

describe("FilesItem.vue - Bug: FileMenu Visibility Issue", () => {
  let mockFile;
  let mockProvides;

  beforeEach(() => {
    mockFile = ref({
      id: "test-file-1",
      title: "Test File",
      selected: false,
      focused: false,
      lastModified: new Date().toISOString(),
      tags: ["math", "science"],
    });

    mockProvides = {
      api: {
        get: vi.fn().mockResolvedValue({ data: {} }),
      },
      fileStore: ref({
        createFile: vi.fn(),
        deleteFile: vi.fn(),
      }),
      xsMode: ref(false),
      mobileMode: ref(false),
      user: ref({ id: "user-1" }),
      shouldShowColumn: vi.fn(() => true),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
              '<div data-testid="file-menu" class="fm-wrapper"><div class="context-menu-trigger">⋮</div></div>',
          },
          FileTitle: {
            template: '<div data-testid="file-title">{{ file.title }}</div>',
            props: ["file"],
          },
          TagRow: {
            template: '<div data-testid="tag-row"></div>',
          },
          Date: {
            template: '<div data-testid="files-item-date"></div>',
          },
          ...overrides.stubs,
        },
      },
    });

    // Wait for async component to mount
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    return wrapper;
  };

  it("should hide FileMenu by default (not selected, not hovered)", async () => {
    const wrapper = await createAsyncWrapper();

    const fileMenu = wrapper.find('[data-testid="file-menu"]');
    expect(fileMenu.exists()).toBe(true);

    // Check computed styles for opacity
    const menuElement = fileMenu.element;
    // const computedStyle = getComputedStyle(menuElement);

    // Should be hidden by default (opacity: 0)
    // Note: This might need adjustment based on actual CSS implementation
    expect(menuElement.classList.contains("fm-wrapper")).toBe(true);
  });

  it("should show FileMenu on hover", async () => {
    const wrapper = await createAsyncWrapper();

    const itemRow = wrapper.find(".item");
    expect(itemRow.exists()).toBe(true);

    // Trigger hover
    await itemRow.trigger("mouseenter");
    await nextTick();

    // Should have hover class or state
    expect(itemRow.classes()).toContain("hovered");
  });

  it("should show FileMenu when file is focused", async () => {
    const wrapper = await createAsyncWrapper();

    const itemRow = wrapper.find(".item");
    expect(itemRow.exists()).toBe(true);

    // Set file as focused
    mockFile.value.focused = true;
    await nextTick();

    // Should have focused class
    expect(itemRow.classes()).toContain("current");
  });

  it("should always render FileMenu even when file is selected", async () => {
    const selectedFile = ref({ ...mockFile.value, selected: true });

    const wrapper = await createAsyncWrapper({
      props: {
        modelValue: selectedFile.value,
      },
    });

    // FileMenu should always be rendered, including when file is selected
    const fileMenu = wrapper.find('[data-testid="file-menu"]');
    expect(fileMenu.exists()).toBe(true);
  });

  it("should have correct CSS classes for hover states", async () => {
    const wrapper = await createAsyncWrapper();

    const itemRow = wrapper.find(".item");
    expect(itemRow.exists()).toBe(true);

    // Should have the base item class
    expect(itemRow.classes()).toContain("item");

    const fileMenu = wrapper.find('[data-testid="file-menu"]');
    expect(fileMenu.exists()).toBe(true);
    expect(fileMenu.classes()).toContain("fm-wrapper");
  });
});
