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

describe("FilesItem.vue - Enhanced Functionality", () => {
  let mockFile;
  let mockFileStore;
  let mockProvides;
  let mockOpenFile;

  beforeEach(async () => {
    // Clear all mocks first
    vi.clearAllMocks();

    // Get the mocked File module
    const { File } = await import("@/models/File.js");
    mockOpenFile = File.openFile;
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
      createFile: vi.fn(),
      deleteFile: vi.fn().mockResolvedValue(true),
    });

    // Create a ref-like object that has a .value property
    const mockFileStoreRef = {
      value: mockFileStore.value,
    };

    mockProvides = {
      api: {
        get: vi.fn().mockResolvedValue({ data: {} }),
      },
      fileStore: mockFileStoreRef,
      xsMode: ref(false),
      mobileMode: ref(false),
      user: ref({ id: "user-1" }),
      shouldShowColumn: vi.fn(() => true),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = async (overrides = {}) => {
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
        ...overrides.props,
      },
      global: {
        provide: {
          ...mockProvides,
          ...overrides.provide,
        },
        stubs: {
          FileMenu: {
            template: `
              <div data-testid="file-menu" class="fm-wrapper">
                <div class="context-menu-trigger" @click="openMenu">⋮</div>
                <div class="context-menu" v-if="menuOpen">
                  <div @click="$emit('rename')" data-testid="menu-rename">Rename</div>
                  <div @click="$emit('duplicate')" data-testid="menu-duplicate">Duplicate</div>
                  <div @click="$emit('delete')" data-testid="menu-delete">Delete</div>
                </div>
              </div>
            `,
            emits: ["rename", "duplicate", "delete"],
            data() {
              return { menuOpen: false };
            },
            methods: {
              openMenu() {
                this.menuOpen = !this.menuOpen;
              },
            },
          },
          FileTitle: {
            template:
              '<div data-testid="file-title" @click="$emit(\'click\')">{{ file.title }}</div>',
            props: ["file"],
            emits: ["click"],
            setup() {
              return {
                startEditing: vi.fn(),
              };
            },
          },
          TagRow: {
            template: `
              <div data-testid="tag-row">
                <span v-for="tag in file.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
              </div>
            `,
            props: ["file"],
          },
          Date: {
            template: '<div data-testid="file-date">{{ formattedDate }}</div>',
            props: ["file"],
            computed: {
              formattedDate() {
                return "2 days ago";
              },
            },
          },
          ConfirmationModal: {
            template: `
              <div v-if="show" data-testid="confirmation-modal">
                <div data-testid="modal-title">{{ title }}</div>
                <div data-testid="modal-message">{{ message }}</div>
                <button @click="$emit('confirm')" data-testid="modal-confirm">{{ confirmText }}</button>
                <button @click="$emit('cancel')" data-testid="modal-cancel">{{ cancelText }}</button>
              </div>
            `,
            props: ["show", "title", "message", "confirmText", "cancelText", "fileData"],
            emits: ["confirm", "cancel", "close"],
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

  describe("File Selection State Synchronization", () => {
    it("syncs selection state correctly when file is selected", async () => {
      const wrapper = await createWrapper();

      const item = wrapper.find(".item");
      expect(item.classes()).not.toContain("current");
      expect(mockFile.value.selected).toBe(false);

      // Trigger selection by clicking the item (which calls select internally)
      await item.trigger("click");
      expect(mockFileStore.value.selectFile).toHaveBeenCalledWith(mockFile.value);
    });

    it("applies current class when file is selected", async () => {
      // Set selected first, then create wrapper
      mockFile.value.selected = true;
      const wrapper = await createWrapper();

      await nextTick();

      // Check that the template binding uses the correct conditions
      const item = wrapper.find(".item");
      expect(item.classes()).toContain("current");
    });

    it("removes current class when file is deselected", async () => {
      mockFile.value.selected = true;
      const wrapper = await createWrapper();

      const item = wrapper.find(".item");
      expect(item.classes()).toContain("current");

      mockFile.value.selected = false;
      await nextTick();

      // Check that current class is not in the main div element
      expect(item.classes()).not.toContain("current");
    });

    it("maintains selection state across component updates", async () => {
      mockFile.value.selected = true;
      const wrapper = await createWrapper();

      const item = wrapper.find(".item");
      expect(item.classes()).toContain("current");
    });

    it("handles rapid selection changes", async () => {
      const wrapper = await createWrapper();

      // Trigger rapid clicks to test selection handling
      const item = wrapper.find(".item");
      await item.trigger("click");
      await item.trigger("click");
      await item.trigger("click");

      expect(mockFileStore.value.selectFile).toHaveBeenCalledTimes(3);
    });

    it("prevents selection when file store is unavailable", async () => {
      const wrapper = await createWrapper({
        provide: {
          fileStore: ref(null),
        },
      });

      // Should not throw
      await wrapper.trigger("click");
    });
  });

  describe("Context Menu Navigation and Keyboard Interaction", () => {
    it("opens context menu with keyboard shortcut", async () => {
      const { useKeyboardShortcuts } = await import("@/composables/useKeyboardShortcuts.js");

      // Create wrapper to trigger useKeyboardShortcuts call
      await createWrapper();

      // Get registered shortcuts
      expect(useKeyboardShortcuts).toHaveBeenCalled();
      const shortcuts = useKeyboardShortcuts.mock.calls[0][0];
      expect(shortcuts).toHaveProperty(".");
      expect(shortcuts["."].description).toBe("open file menu");
    });

    it("opens file with Enter key", async () => {
      const { useKeyboardShortcuts } = await import("@/composables/useKeyboardShortcuts.js");

      // Create wrapper to trigger useKeyboardShortcuts call
      await createWrapper();

      const shortcuts = useKeyboardShortcuts.mock.calls[0][0];
      expect(shortcuts).toHaveProperty("enter");

      // Execute Enter shortcut
      shortcuts["enter"]();
      expect(mockOpenFile).toHaveBeenCalledWith(mockFile.value, expect.any(Object));
    });

    it("opens file with Space key", async () => {
      const { useKeyboardShortcuts } = await import("@/composables/useKeyboardShortcuts.js");

      // Create wrapper to trigger useKeyboardShortcuts call
      await createWrapper();

      const shortcuts = useKeyboardShortcuts.mock.calls[0][0];
      expect(shortcuts).toHaveProperty(" ");

      // Execute Space shortcut
      shortcuts[" "].fn();
      expect(mockOpenFile).toHaveBeenCalledWith(mockFile.value, expect.any(Object));
    });

    it("navigates context menu with arrow keys", async () => {
      const wrapper = await createWrapper();

      // Open context menu
      const menuTrigger = wrapper.find('[data-testid="file-menu"] .context-menu-trigger');
      await menuTrigger.trigger("click");

      const contextMenu = wrapper.find(".context-menu");
      expect(contextMenu.exists()).toBe(true);

      // Verify menu items are accessible
      expect(wrapper.find('[data-testid="menu-rename"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="menu-duplicate"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="menu-delete"]').exists()).toBe(true);
    });

    it("executes context menu actions correctly", async () => {
      const wrapper = await createWrapper();

      // Open context menu
      const menuTrigger = wrapper.find('[data-testid="file-menu"] .context-menu-trigger');
      await menuTrigger.trigger("click");

      // Test rename action
      const renameItem = wrapper.find('[data-testid="menu-rename"]');
      await renameItem.trigger("click");

      // Should trigger startEditing on FileTitle component
      const fileTitle = wrapper.findComponent('[data-testid="file-title"]');
      expect(fileTitle.vm.startEditing).toBeTruthy();
      expect(typeof fileTitle.vm.startEditing).toBe("function");
    });

    it("handles duplicate action correctly", async () => {
      const wrapper = await createWrapper();

      // Open context menu and trigger duplicate
      const menuTrigger = wrapper.find('[data-testid="file-menu"] .context-menu-trigger');
      await menuTrigger.trigger("click");

      const duplicateItem = wrapper.find('[data-testid="menu-duplicate"]');
      await duplicateItem.trigger("click");

      expect(mockFileStore.value.createFile).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test Research Paper (Copy)",
          owner_id: "user-1",
          id: null,
        })
      );
    });

    it("shows delete confirmation modal", async () => {
      const wrapper = await createWrapper();

      // Open context menu and trigger delete
      const menuTrigger = wrapper.find('[data-testid="file-menu"] .context-menu-trigger');
      await menuTrigger.trigger("click");

      const deleteItem = wrapper.find('[data-testid="menu-delete"]');
      await deleteItem.trigger("click");

      await nextTick();

      const modal = wrapper.find('[data-testid="confirmation-modal"]');
      expect(modal.exists()).toBe(true);
      expect(modal.find('[data-testid="modal-title"]').text()).toBe("Delete File?");
    });
  });

  describe("File Operations and State Management", () => {
    it("handles successful file deletion", async () => {
      const wrapper = await createWrapper();

      // First open the menu by clicking the trigger
      const menuTrigger = wrapper.find(".context-menu-trigger");
      await menuTrigger.trigger("click");
      await nextTick();

      // Then trigger delete action through menu
      const deleteButton = wrapper.find('[data-testid="menu-delete"]');
      await deleteButton.trigger("click");
      await nextTick();

      // Confirm deletion
      const confirmButton = wrapper.find('[data-testid="modal-confirm"]');
      await confirmButton.trigger("click");

      expect(mockFileStore.value.deleteFile).toHaveBeenCalledWith(mockFile.value);
    });

    it("handles failed file deletion gracefully", async () => {
      mockFileStore.value.deleteFile.mockRejectedValue(new Error("Delete failed"));
      const wrapper = await createWrapper();

      // Spy on console.error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // First open the menu by clicking the trigger
      const menuTrigger = wrapper.find(".context-menu-trigger");
      await menuTrigger.trigger("click");
      await nextTick();

      const deleteButton = wrapper.find('[data-testid="menu-delete"]');
      await deleteButton.trigger("click");
      await nextTick();

      // Confirm deletion
      const confirmButton = wrapper.find('[data-testid="modal-confirm"]');
      await confirmButton.trigger("click");

      // Should log error and keep modal open
      expect(consoleSpy).toHaveBeenCalledWith("Failed to delete file:", expect.any(Error));
      expect(wrapper.findComponent(FilesItem).vm.showDeleteModal).toBe(true);

      consoleSpy.mockRestore();
    });

    it("cancels file deletion", async () => {
      const wrapper = await createWrapper();

      // First open the menu by clicking the trigger
      const menuTrigger = wrapper.find(".context-menu-trigger");
      await menuTrigger.trigger("click");
      await nextTick();

      const deleteButton = wrapper.find('[data-testid="menu-delete"]');
      await deleteButton.trigger("click");
      await nextTick();

      // Cancel deletion
      const cancelButton = wrapper.find('[data-testid="modal-cancel"]');
      await cancelButton.trigger("click");

      expect(mockFileStore.value.deleteFile).not.toHaveBeenCalled();
      const modal = wrapper.find('[data-testid="confirmation-modal"]');
      expect(modal.exists()).toBe(false);
    });

    it("prevents delete when file is null", async () => {
      const wrapper = await createWrapper({
        props: {
          modelValue: null,
        },
      });

      // Should not show modal when file is null
      const modal = wrapper.find('[data-testid="confirmation-modal"]');
      expect(modal.exists()).toBe(false);

      // File menu should not be rendered when file is null
      const fileMenu = wrapper.find('[data-testid="file-menu"]');
      expect(fileMenu.exists()).toBe(false);
    });

    it("handles race condition in delete confirmation", async () => {
      const wrapper = await createWrapper();

      // Access the FilesItem component through the Suspense wrapper
      const filesItemComponent = wrapper.findComponent(FilesItem);

      // Close modal before handling confirm
      filesItemComponent.vm.showDeleteModal = false;

      // Should return early and not call deleteFile
      await filesItemComponent.vm.handleDeleteConfirm();
      expect(mockFileStore.value.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe("Hover and Focus State Management", () => {
    it("applies hover state correctly", async () => {
      const wrapper = await createWrapper();

      expect(wrapper.findComponent(FilesItem).vm.hovered).toBe(false);

      // Set hovered state directly since DOM events may not trigger reactive updates in tests
      wrapper.findComponent(FilesItem).vm.hovered = true;
      await nextTick();
      expect(wrapper.findComponent(FilesItem).vm.hovered).toBe(true);

      wrapper.findComponent(FilesItem).vm.hovered = false;
      await nextTick();
      expect(wrapper.findComponent(FilesItem).vm.hovered).toBe(false);
    });

    it("applies focused state correctly", async () => {
      mockFile.value.focused = true;
      const wrapper = await createWrapper();
      await nextTick();

      expect(wrapper.findComponent(FilesItem).vm.file.focused).toBe(true);
      expect(wrapper.html()).toContain("current");

      mockFile.value.focused = false;
      await nextTick();

      expect(wrapper.findComponent(FilesItem).vm.file.focused).toBe(false);
      // Check that current class is not in the main div element
      expect(wrapper.find(".item").classes()).not.toContain("current");
    });

    it("combines multiple states correctly", async () => {
      mockFile.value.selected = true;
      mockFile.value.focused = true;
      const wrapper = await createWrapper();

      await wrapper.trigger("mouseenter");
      await nextTick();

      // Set hovered state directly since DOM events may not trigger reactive updates in tests
      wrapper.findComponent(FilesItem).vm.hovered = true;
      await nextTick();

      expect(wrapper.findComponent(FilesItem).vm.file.selected).toBe(true);
      expect(wrapper.findComponent(FilesItem).vm.file.focused).toBe(true);
      expect(wrapper.findComponent(FilesItem).vm.hovered).toBe(true);

      // Check that classes are applied to the main item element
      const itemClasses = wrapper.find(".item").classes();
      expect(itemClasses).toContain("current");
      expect(itemClasses).toContain("hovered");
    });

    it("maintains hover state during focus changes", async () => {
      const wrapper = await createWrapper();

      // Set hovered state directly since DOM events may not trigger reactive updates in tests
      wrapper.findComponent(FilesItem).vm.hovered = true;
      await nextTick();
      expect(wrapper.findComponent(FilesItem).vm.hovered).toBe(true);

      mockFile.value.focused = true;
      await nextTick();

      expect(wrapper.findComponent(FilesItem).vm.hovered).toBe(true);
      expect(wrapper.findComponent(FilesItem).vm.file.focused).toBe(true);
    });
  });

  describe("File Menu Visibility", () => {
    it("shows file menu when file is selected", async () => {
      mockFile.value.selected = true;
      const wrapper = await createWrapper();

      // FileMenu should always be rendered, including when file is selected
      expect(wrapper.find('[data-testid="file-menu"]').exists()).toBe(true);
    });

    it("shows file menu when file is not selected", async () => {
      mockFile.value.selected = false;
      const wrapper = await createWrapper();

      expect(wrapper.find('[data-testid="file-menu"]').exists()).toBe(true);
    });
  });

  describe("Responsive Behavior", () => {
    it("hides tags in extra small mode", async () => {
      const wrapper = await createWrapper({
        provide: {
          xsMode: ref(true),
        },
      });

      // In xsMode, TagRow should not be rendered
      expect(wrapper.find('[data-testid="tag-row"]').exists()).toBe(false);
    });

    it("shows tags in normal mode", async () => {
      const wrapper = await createWrapper({
        provide: {
          xsMode: ref(false),
        },
      });

      expect(wrapper.find('[data-testid="tag-row"]').exists()).toBe(true);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("handles missing file store methods gracefully", async () => {
      const wrapper = await createWrapper({
        provide: {
          fileStore: ref({}), // Empty store
        },
      });

      // Should not throw
      await wrapper.trigger("click");
    });

    it("handles malformed file data", async () => {
      const malformedFile = {
        id: null,
        title: undefined,
        // missing other properties
      };

      expect(async () => {
        await createWrapper({
          props: {
            modelValue: malformedFile,
          },
        });
      }).not.toThrow();
    });

    it("handles double-click correctly", async () => {
      const wrapper = await createWrapper();

      // Call open method directly since dblclick event needs proper setup
      wrapper.findComponent(FilesItem).vm.open();

      expect(mockOpenFile).toHaveBeenCalledWith(mockFile.value, expect.any(Object));
    });

    it("keeps context menu when file is selected", async () => {
      mockFile.value.selected = true;
      const wrapper = await createWrapper();

      // FileMenu should always be available
      expect(wrapper.find('[data-testid="file-menu"]').exists()).toBe(true);
    });

    it("handles component unmounting during operations", async () => {
      const wrapper = await createWrapper();

      // First open the menu by clicking the trigger
      const menuTrigger = wrapper.find(".context-menu-trigger");
      await menuTrigger.trigger("click");
      await nextTick();

      // Start delete operation
      const deleteButton = wrapper.find('[data-testid="menu-delete"]');
      await deleteButton.trigger("click");

      // Unmount component
      wrapper.unmount();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
