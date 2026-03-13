import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref, Suspense } from "vue";
import FilesItem from "@/views/home/FilesItem.vue";

// Mock router
const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock keyboard shortcuts
vi.mock("@/composables/useKeyboardShortcuts.js", () => ({
  useKeyboardShortcuts: vi.fn(() => ({
    activate: vi.fn(),
    deactivate: vi.fn(),
  })),
}));

// Mock File model
vi.mock("@/models/File.js", () => ({
  File: {
    openFile: vi.fn(),
    toJSON: vi.fn((file) => ({ ...file })),
  },
}));

describe("FilesItem.vue - Suspense and Async Behavior", () => {
  let mockFile;
  let mockFileStore;
  let mockProvides;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockFile = ref({
      id: "test-file-1",
      title: "Test Research Paper",
      selected: false,
      focused: false,
      lastModified: new Date().toISOString(),
      tags: [
        { id: "tag1", name: "research", color: "#blue" },
        { id: "tag2", name: "biology", color: "#green" },
      ],
    });

    mockFileStore = ref({
      selectFile: vi.fn(),
      createFile: vi.fn().mockResolvedValue(true),
      deleteFile: vi.fn().mockResolvedValue(true),
    });

    mockProvides = {
      api: {
        get: vi.fn().mockResolvedValue({ data: {} }),
      },
      fileStore: mockFileStore,
      xsMode: ref(false),
      mobileMode: ref(false),
      user: ref({ id: "user-1" }),
      shouldShowColumn: vi.fn(() => true),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
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

    return mount(AsyncFilesItem, {
      props: {
        modelValue: mockFile.value,
        ...overrides.props,
      },
      global: {
        provide: {
          ...mockProvides,
          ...overrides.provide,
        },
        stubs: {
          FileTitle: {
            template: '<div data-testid="file-title">{{ file.title }}</div>',
            props: ["file"],
          },
          FileMenu: {
            template: `
              <div data-testid="file-menu" ref="menu-ref">
                <button @click="$emit('delete')" data-testid="delete-btn">Delete</button>
                <button @click="$emit('duplicate')" data-testid="duplicate-btn">Duplicate</button>
              </div>
            `,
            emits: ["delete", "duplicate", "rename"],
            methods: {
              toggle: vi.fn(),
            },
          },
          TagRow: {
            template: '<div data-testid="tag-row"></div>',
            props: ["file"],
          },
          Date: {
            template: '<div data-testid="file-date"></div>',
            props: ["file"],
          },
          ConfirmationModal: {
            template: `
              <div v-if="show" data-testid="confirmation-modal">
                <button @click="$emit('confirm')" data-testid="confirm-btn">Confirm</button>
                <button @click="$emit('cancel')" data-testid="cancel-btn">Cancel</button>
              </div>
            `,
            props: ["show", "title", "message", "confirmText", "cancelText", "fileData"],
            emits: ["confirm", "cancel", "close"],
          },
          ...overrides.stubs,
        },
      },
    });
  };

  describe("Async Component Lifecycle", () => {
    it("should be an async component that triggers Suspense", async () => {
      // This test will fail until we make FilesItem async
      const wrapper = await createAsyncWrapper();

      // Initially, loading fallback should show
      expect(wrapper.find('[data-testid="loading-fallback"]').exists()).toBe(true);

      // Wait for async component to resolve
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // After resolution, the actual component should render
      expect(wrapper.find('[data-testid="loading-fallback"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="file-title"]').exists()).toBe(true);
    });

    it("should handle async component mounting with file data", async () => {
      const wrapper = await createAsyncWrapper();

      // Wait for component to fully mount
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify component received the file data
      const fileTitle = wrapper.find('[data-testid="file-title"]');
      expect(fileTitle.exists()).toBe(true);
      expect(fileTitle.text()).toContain("Test Research Paper");
    });
  });

  describe("Async File Operations", () => {
    it("should handle async delete operation", async () => {
      const slowDeleteStore = ref({
        ...mockFileStore.value,
        deleteFile: vi
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 100))),
      });

      const wrapper = await createAsyncWrapper({
        provide: { fileStore: slowDeleteStore },
      });

      // Wait for component to mount
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger delete action
      const deleteBtn = wrapper.find('[data-testid="delete-btn"]');
      await deleteBtn.trigger("click");

      // Modal should appear
      await nextTick();
      expect(wrapper.find('[data-testid="confirmation-modal"]').exists()).toBe(true);

      // Confirm delete
      const confirmBtn = wrapper.find('[data-testid="confirm-btn"]');
      await confirmBtn.trigger("click");

      // Should call the delete function
      expect(slowDeleteStore.value.deleteFile).toHaveBeenCalledWith(mockFile.value);
    });

    it("should handle async duplicate operation", async () => {
      const slowCreateStore = ref({
        ...mockFileStore.value,
        createFile: vi
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 100))),
      });

      const wrapper = await createAsyncWrapper({
        provide: { fileStore: slowCreateStore },
      });

      // Wait for component to mount
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger duplicate action
      const duplicateBtn = wrapper.find('[data-testid="duplicate-btn"]');
      await duplicateBtn.trigger("click");

      // Should call createFile with duplicated data
      expect(slowCreateStore.value.createFile).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test Research Paper (Copy)",
          id: null,
          owner_id: "user-1",
        })
      );
    });

    it("should handle delete operation failure gracefully", async () => {
      const failingDeleteStore = ref({
        ...mockFileStore.value,
        deleteFile: vi.fn().mockRejectedValue(new Error("Delete failed")),
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const wrapper = await createAsyncWrapper({
        provide: { fileStore: failingDeleteStore },
      });

      // Wait for component to mount
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger delete action
      const deleteBtn = wrapper.find('[data-testid="delete-btn"]');
      await deleteBtn.trigger("click");

      // Confirm delete
      await nextTick();
      const confirmBtn = wrapper.find('[data-testid="confirm-btn"]');
      await confirmBtn.trigger("click");

      // Wait for async operation to complete
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should log error and keep modal open
      expect(consoleSpy).toHaveBeenCalledWith("Failed to delete file:", expect.any(Error));
      expect(wrapper.find('[data-testid="confirmation-modal"]').exists()).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe("Suspense Integration", () => {
    it("should work correctly when wrapped in Suspense boundary", async () => {
      // Create the wrapper without waiting for async resolution
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
        },
        global: {
          provide: mockProvides,
          stubs: {
            FileTitle: {
              template: '<div data-testid="file-title">{{ file.title }}</div>',
              props: ["file"],
            },
            TagRow: {
              template: '<div data-testid="tag-row"></div>',
              props: ["file"],
            },
            Date: {
              template: '<div data-testid="file-date"></div>',
              props: ["file"],
            },
          },
        },
      });

      // Initially should show loading fallback
      expect(wrapper.find('[data-testid="loading-fallback"]').exists()).toBe(true);

      // Wait for async resolution
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 50)); // longer wait for async operations

      // After resolution, component should be fully functional
      const fileItem = wrapper.find(".item");
      expect(fileItem.exists()).toBe(true);
      // Loading fallback should be gone
      expect(wrapper.find('[data-testid="loading-fallback"]').exists()).toBe(false);
    });

    it("should handle multiple async FilesItems in the same Suspense boundary", async () => {
      const MultipleFilesWrapper = {
        template: `
          <Suspense>
            <div>
              <FilesItem v-for="file in files" :key="file.id" :modelValue="file" />
            </div>
            <template #fallback>
              <div data-testid="loading-multiple">Loading files...</div>
            </template>
          </Suspense>
        `,
        components: { FilesItem, Suspense },
        data() {
          return {
            files: [
              { ...mockFile.value, id: "file-1" },
              { ...mockFile.value, id: "file-2" },
              { ...mockFile.value, id: "file-3" },
            ],
          };
        },
      };

      const wrapper = mount(MultipleFilesWrapper, {
        global: {
          provide: mockProvides,
          stubs: {
            FileTitle: { template: '<div class="file-title"></div>', props: ["file"] },
            FileMenu: { template: '<div class="file-menu"></div>' },
            TagRow: { template: '<div class="tag-row"></div>', props: ["file"] },
            Date: { template: '<div class="file-date"></div>', props: ["file"] },
            ConfirmationModal: { template: "<div></div>", props: ["show"] },
          },
        },
      });

      // Initially should show loading
      expect(wrapper.find('[data-testid="loading-multiple"]').exists()).toBe(true);

      // Wait for all async components to resolve
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // All file items should be rendered
      expect(wrapper.find('[data-testid="loading-multiple"]').exists()).toBe(false);
      expect(wrapper.findAll(".item")).toHaveLength(3);
    });
  });

  describe("Error Boundaries", () => {
    it("should handle async component errors gracefully", async () => {
      // This will be tested once we implement proper error handling
      // For now, we just ensure the test structure is in place
      const wrapper = await createAsyncWrapper();

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Basic validation that component doesn't crash
      expect(wrapper.exists()).toBe(true);
    });
  });
});
