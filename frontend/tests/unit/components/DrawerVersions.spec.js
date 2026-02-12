/**
 * @file Unit tests for DrawerVersions component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import DrawerVersions from "@/views/workspace/DrawerVersions.vue";
import Button from "@/components/base/Button.vue";
import EditableText from "@/components/forms/EditableText.vue";
import VersionPreviewModal from "@/views/workspace/VersionPreviewModal.vue";

// Mock API
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

// Mock user
const mockUser = {
  value: {
    id: 1,
    name: "Test User",
    email: "test@example.com",
  },
};

describe("DrawerVersions", () => {
  let wrapper;

  const mockVersions = [
    {
      id: 1,
      version_number: 1,
      version_name: "First Draft",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
      created_by: 1,
    },
    {
      id: 2,
      version_number: 2,
      version_name: "Second Draft",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago (today)
      created_by: 1,
    },
    {
      id: 3,
      version_number: 3,
      version_name: null,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // Yesterday
      created_by: 1,
    },
  ];

  const mockFile = {
    id: 123,
    owner_id: 1,
    title: "Test File",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: mockVersions });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  function createWrapper(options = {}) {
    const fileToUse = options.file || mockFile;
    return mount(DrawerVersions, {
      global: {
        provide: {
          api: mockApi,
          user: mockUser,
          file: { value: fileToUse },
        },
        stubs: {
          Pane: {
            template: '<div><slot name="header"></slot><slot></slot></div>',
          },
          Section: {
            template: '<div><slot name="content"></slot></div>',
          },
          IconFileText: true,
          IconEye: true,
          Button: Button,
          EditableText: EditableText,
          VersionPreviewModal: {
            props: ["version", "fileId", "isOwner"],
            emits: ["close", "restored"],
            template:
              '<div class="version-preview-modal" data-testid="version-preview-modal"></div>',
          },
          ContextMenu: {
            name: "ContextMenu",
            template: '<div class="context-menu"><slot></slot></div>',
          },
          ContextMenuItem: true,
        },
      },
    });
  }

  describe("mounting and data fetching", () => {
    it("fetches versions on mount", async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      expect(mockApi.get).toHaveBeenCalledWith("/files/123/versions");
    });

    it("displays loading state while fetching", async () => {
      mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".loading").exists()).toBe(true);
      expect(wrapper.find(".loading").text()).toContain("Loading versions");
    });

    it("displays error state on fetch failure", async () => {
      mockApi.get.mockRejectedValue(new Error("Network error"));
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick(); // Wait for error to be set

      expect(wrapper.find(".error").exists()).toBe(true);
      expect(wrapper.find(".error").text()).toContain("Failed to load versions");
    });

    it("displays empty state when no versions exist", async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".empty-state").exists()).toBe(true);
      expect(wrapper.find(".empty-state").text()).toContain("No versions yet");
    });
  });

  describe("version list rendering", () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
    });

    it("renders version list when versions exist", () => {
      expect(wrapper.find(".version-list").exists()).toBe(true);
      expect(wrapper.findAll(".version-item")).toHaveLength(3);
    });

    it("displays version number and name", () => {
      const firstVersion = wrapper.findAll(".version-item")[0];
      expect(firstVersion.find(".version-number").text()).toBe("v1");

      const editableText = firstVersion.findComponent(EditableText);
      expect(editableText.exists()).toBe(true);
      expect(editableText.props("modelValue")).toBe("First Draft");
    });

    it("displays version number with EditableText for versions without names", () => {
      const thirdVersion = wrapper.findAll(".version-item")[2];
      expect(thirdVersion.find(".version-number").text()).toBe("v3");

      const editableText = thirdVersion.findComponent(EditableText);
      expect(editableText.exists()).toBe(true);
      expect(editableText.props("modelValue")).toBe(null);
    });

    it("displays formatted dates", () => {
      const items = wrapper.findAll(".version-item");

      // Today (2 hours ago)
      expect(items[1].find(".version-date").text()).toContain("Today at");

      // Yesterday
      expect(items[2].find(".version-date").text()).toContain("Yesterday at");

      // 3 days ago
      expect(items[0].find(".version-date").text()).toContain("3 days ago");
    });

    it("displays context menu for each version", () => {
      const items = wrapper.findAll(".version-item");
      items.forEach((item) => {
        const contextMenu = item.findComponent({ name: "ContextMenu" });
        expect(contextMenu.exists()).toBe(true);
      });
    });
  });

  describe("save version button", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      mockApi.get.mockResolvedValue({ data: mockVersions });
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
    });

    it("renders save version button", () => {
      const saveButton = wrapper.findComponent(Button);
      expect(saveButton.exists()).toBe(true);
      expect(saveButton.props("text")).toBe("Save Version");
      expect(saveButton.props("icon")).toBe("Plus");
      expect(saveButton.props("kind")).toBe("primary");
    });

    it("creates new version when clicked", async () => {
      const newVersion = {
        id: 4,
        version_number: 4,
        version_name: null,
        created_at: new Date().toISOString(),
        created_by: 1,
      };

      mockApi.post.mockResolvedValue({ data: newVersion });

      const saveButton = wrapper.findComponent(Button);
      await saveButton.trigger("click");
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(mockApi.post).toHaveBeenCalledWith("/files/123/versions/named", {
        version_name: null,
      });
      expect(wrapper.vm.versions).toHaveLength(4);
      expect(wrapper.vm.versions[0]).toEqual(newVersion);
    });

    it("renders EditableText components for versions", async () => {
      const versionItems = wrapper.findAll(".version-item");

      // Each version item should have an EditableText
      versionItems.forEach((item) => {
        expect(item.findComponent(EditableText).exists()).toBe(true);
      });
    });
  });

  describe("preview modal", () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
    });

    it("does not show preview modal initially", () => {
      expect(wrapper.findComponent(VersionPreviewModal).exists()).toBe(false);
    });

    it("opens preview modal when clicking version item", async () => {
      const versionItem = wrapper.find(".version-item");
      await versionItem.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.showPreviewModal).toBe(true);
      expect(wrapper.vm.selectedVersion).toEqual(mockVersions[0]);
    });

    it("passes correct props to preview modal", async () => {
      await wrapper.find(".version-item").trigger("click");
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent(VersionPreviewModal);
      expect(modal.exists()).toBe(true);
      expect(modal.props("version")).toEqual(mockVersions[0]);
      expect(modal.props("isOwner")).toBe(true);
    });

    it("passes correct file-id to preview modal when file is a ref", async () => {
      // This test ensures that when file is injected as a ref,
      // the modal receives file.value.id, not file.id (which would be undefined)
      await wrapper.find(".version-item").trigger("click");
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent(VersionPreviewModal);
      expect(modal.exists()).toBe(true);

      // CRITICAL: file-id should be 123 (from file.value.id), not undefined (from file.id)
      expect(modal.props("fileId")).toBe(123);
      expect(modal.props("fileId")).not.toBeUndefined();
    });

    it("closes preview modal on close event", async () => {
      await wrapper.find(".version-item").trigger("click");
      expect(wrapper.vm.showPreviewModal).toBe(true);

      const modal = wrapper.findComponent(VersionPreviewModal);
      await modal.vm.$emit("close");
      await wrapper.vm.$nextTick(); // Wait for async closePreviewModal to complete

      expect(wrapper.vm.showPreviewModal).toBe(false);
      expect(wrapper.vm.selectedVersion).toBe(null);
    });

    it("allows reopening modal after closing it", async () => {
      // First open
      const versionItem = wrapper.find(".version-item");
      await versionItem.trigger("click");
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.showPreviewModal).toBe(true);
      expect(wrapper.vm.selectedVersion).toEqual(mockVersions[0]);

      // Close modal
      const modal = wrapper.findComponent(VersionPreviewModal);
      await modal.vm.$emit("close");
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick(); // Extra tick for cleanup
      expect(wrapper.vm.showPreviewModal).toBe(false);
      expect(wrapper.vm.selectedVersion).toBe(null);

      // Second open - THIS IS THE BUG: clicking does nothing
      await versionItem.trigger("click");
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick(); // Extra tick for state updates
      expect(wrapper.vm.showPreviewModal).toBe(true);
      expect(wrapper.vm.selectedVersion).toEqual(mockVersions[0]);
    });

    it("refreshes versions after restore", async () => {
      await wrapper.find(".version-item").trigger("click");
      mockApi.get.mockClear(); // Clear previous calls

      const modal = wrapper.findComponent(VersionPreviewModal);
      await modal.vm.$emit("restored");

      expect(wrapper.vm.showPreviewModal).toBe(false);
      expect(mockApi.get).toHaveBeenCalledWith("/files/123/versions");
    });
  });

  describe("owner permissions", () => {
    it("sets isOwner to true when user owns file", async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.isOwner).toBe(true);
    });

    it("sets isOwner to false when user does not own file", async () => {
      wrapper = createWrapper({ file: { ...mockFile, owner_id: 999 } });
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.isOwner).toBe(false);
    });
  });

  describe("date formatting", () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
    });

    it('formats date as "Today at HH:MM" for today', () => {
      const today = new Date().toISOString();
      const formatted = wrapper.vm.formatDate(today);
      expect(formatted).toMatch(/Today at \d{1,2}:\d{2} (AM|PM)/);
    });

    it('formats date as "Yesterday at HH:MM" for yesterday', () => {
      const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
      const formatted = wrapper.vm.formatDate(yesterday);
      expect(formatted).toMatch(/Yesterday at \d{1,2}:\d{2} (AM|PM)/);
    });

    it('formats date as "X days ago" for recent dates', () => {
      const threeDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
      const formatted = wrapper.vm.formatDate(threeDaysAgo);
      expect(formatted).toBe("3 days ago");
    });

    it('formats date as "Mon DD, YYYY" for older dates', () => {
      const twoWeeksAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();
      const formatted = wrapper.vm.formatDate(twoWeeksAgo);
      expect(formatted).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
    });
  });
});
