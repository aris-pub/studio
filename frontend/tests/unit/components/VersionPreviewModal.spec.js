/**
 * @file Unit tests for VersionPreviewModal component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import VersionPreviewModal from "@/views/workspace/VersionPreviewModal.vue";
import Button from "@/components/base/Button.vue";

// Mock API
const mockApi = {
  get: vi.fn(),
};

// Mock useVersionRestore
const mockRestoreVersion = vi.fn();
vi.mock("@/composables/useVersionRestore", () => ({
  useVersionRestore: vi.fn(() => ({
    restoreVersion: mockRestoreVersion,
  })),
}));

describe("VersionPreviewModal", () => {
  let wrapper;

  const mockVersion = {
    id: 1,
    version_number: 5,
    version_name: "Before submission",
    created_at: "2025-10-15T15:42:00Z",
    created_by: 1,
  };

  const mockVersionContent = "# Original Content\n\nThis is the first version.";

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({
      data: {
        rsm_content: mockVersionContent,
        current_content: "# Modified Content\n\nThis is modified.",
        version_name: mockVersion.version_name,
        created_at: mockVersion.created_at,
        created_by: mockVersion.created_by,
      },
    });
    mockRestoreVersion.mockResolvedValue(true);

    // Mock window.addEventListener for ESC key
    global.addEventListener = vi.fn();
    global.removeEventListener = vi.fn();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  function createWrapper(props = {}) {
    return mount(VersionPreviewModal, {
      props: {
        version: mockVersion,
        fileId: 123,
        isOwner: true,
        ...props,
      },
      global: {
        provide: {
          api: mockApi,
        },
        components: {
          Button,
        },
        stubs: {
          IconX: true,
        },
      },
    });
  }

  describe("mounting and content fetching", () => {
    it("fetches version content on mount", async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      expect(mockApi.get).toHaveBeenCalledWith("/files/123/versions/1/preview");
    });

    it("displays loading state while fetching content", async () => {
      mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".loading-state").exists()).toBe(true);
      expect(wrapper.find(".loading-state").text()).toContain("Loading version");
    });

    it("displays error state on fetch failure", async () => {
      mockApi.get.mockRejectedValue(new Error("Network error"));
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".error-state").exists()).toBe(true);
      expect(wrapper.find(".error-state").text()).toContain("Failed to load version content");
    });

    it("can retry after fetch failure", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("Network error"));
      mockApi.get.mockResolvedValue({ data: { rsm_content: mockVersionContent } });

      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".error-state").exists()).toBe(true);

      // Click retry button
      await wrapper.find(".error-state button").trigger("click");
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".version-content").exists()).toBe(true);
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("version content display", () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
    });

    it("displays version content when loaded", () => {
      expect(wrapper.find(".version-content").exists()).toBe(true);
      expect(wrapper.find(".rsm-source").text()).toBe(mockVersionContent);
    });

    it("displays version title with number and name", () => {
      expect(wrapper.find(".version-title").text()).toContain("Version 5");
      expect(wrapper.find(".version-title").text()).toContain("Before submission");
    });

    it("displays version metadata (date)", () => {
      expect(wrapper.find(".version-meta").exists()).toBe(true);
      expect(wrapper.find(".version-date").text()).toBeTruthy();
    });
  });

  describe("close functionality", () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
    });

    it("emits close event when clicking close button", async () => {
      await wrapper.find(".btn-close").trigger("click");

      expect(wrapper.emitted("close")).toBeTruthy();
      expect(wrapper.emitted("close")).toHaveLength(1);
    });

    it("emits close event when clicking backdrop", async () => {
      const backdrop = wrapper.find(".modal-backdrop");
      await backdrop.trigger("click");

      expect(wrapper.emitted("close")).toBeTruthy();
    });

    it("does not close when clicking modal container", async () => {
      await wrapper.find(".modal-container").trigger("click");

      expect(wrapper.emitted("close")).toBeFalsy();
    });

    it("emits close event when clicking Close button in footer", async () => {
      const closeButton = wrapper.findAllComponents({ name: "Button" })[0];
      await closeButton.trigger("click");

      expect(wrapper.emitted("close")).toBeTruthy();
    });

    it("registers ESC key listener on mount", () => {
      expect(global.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("removes ESC key listener on unmount", () => {
      wrapper.unmount();

      expect(global.removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    });
  });

  describe("restore functionality for owner", () => {
    beforeEach(async () => {
      wrapper = createWrapper({ isOwner: true });
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
    });

    it("displays restore button for owner", () => {
      expect(wrapper.find('[data-testid="restore-version-button"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="restore-version-button"]').text()).toContain("Restore v5");
    });

    it("shows confirmation dialog when clicking restore", async () => {
      await wrapper.find('[data-testid="restore-version-button"]').trigger("click");

      expect(wrapper.find(".confirmation").exists()).toBe(true);
      expect(wrapper.find(".confirmation-message").text()).toContain("Restore this version");
      expect(wrapper.find(".confirmation-message").text()).toContain("replace the current content");
    });

    it("can cancel restore from confirmation dialog", async () => {
      await wrapper.find('[data-testid="restore-version-button"]').trigger("click");
      expect(wrapper.find(".confirmation").exists()).toBe(true);

      await wrapper.find('[data-testid="cancel-restore-button"]').trigger("click");

      expect(wrapper.find(".confirmation").exists()).toBe(false);
      expect(mockRestoreVersion).not.toHaveBeenCalled();
    });

    it("calls restoreVersion on confirm", async () => {
      await wrapper.find('[data-testid="restore-version-button"]').trigger("click");

      await wrapper.find('[data-testid="confirm-restore-button"]').trigger("click");

      expect(mockRestoreVersion).toHaveBeenCalledWith(1);
    });

    it("emits restored event on successful restore", async () => {
      await wrapper.find('[data-testid="restore-version-button"]').trigger("click");
      await wrapper.find('[data-testid="confirm-restore-button"]').trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("restored")).toBeTruthy();
      expect(wrapper.emitted("restored")).toHaveLength(1);
    });

    it("shows loading state during restore", async () => {
      mockRestoreVersion.mockImplementation(() => new Promise(() => {})); // Never resolves

      await wrapper.find('[data-testid="restore-version-button"]').trigger("click");
      await wrapper.find('[data-testid="confirm-restore-button"]').trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="confirm-restore-button"]').text()).toContain(
        "Restoring..."
      );
      expect(
        wrapper.find('[data-testid="confirm-restore-button"]').attributes("disabled")
      ).toBeDefined();
    });

    it("shows alert on restore failure", async () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      mockRestoreVersion.mockRejectedValue(new Error("Restore failed"));

      await wrapper.find('[data-testid="restore-version-button"]').trigger("click");
      await wrapper.find('[data-testid="confirm-restore-button"]').trigger("click");
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(alertSpy).toHaveBeenCalledWith("Failed to restore version. Please try again.");
      expect(wrapper.find(".confirmation").exists()).toBe(true); // Still showing confirmation

      alertSpy.mockRestore();
    });

    it("disables close during restore", async () => {
      mockRestoreVersion.mockImplementation(() => new Promise(() => {})); // Never resolves

      await wrapper.find('[data-testid="restore-version-button"]').trigger("click");
      await wrapper.find('[data-testid="confirm-restore-button"]').trigger("click");
      await wrapper.vm.$nextTick();

      // Try to close
      await wrapper.find(".btn-close").trigger("click");

      // Should not emit close event
      expect(wrapper.emitted("close")).toBeFalsy();
    });
  });

  describe("restore functionality for non-owner", () => {
    beforeEach(async () => {
      wrapper = createWrapper({ isOwner: false });
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
    });

    it("does not display restore button for non-owner", () => {
      expect(wrapper.find('[data-testid="restore-version-button"]').exists()).toBe(false);
    });

    it("displays owner-only note for non-owner", () => {
      expect(wrapper.find(".owner-only-note").exists()).toBe(true);
      expect(wrapper.find(".owner-only-note").text()).toContain("Only the file owner can restore");
    });
  });

  describe("header information", () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
    });

    it("displays version number in header", () => {
      expect(wrapper.find(".version-title").text()).toContain("Version 5");
    });

    it("displays version name when present", () => {
      expect(wrapper.find(".version-name").text()).toContain("Before submission");
    });

    it("does not display version name when null", async () => {
      await wrapper.unmount();
      wrapper = createWrapper({
        version: { ...mockVersion, version_name: null },
      });
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".version-name").exists()).toBe(false);
    });

    it("formats creation date", () => {
      const dateText = wrapper.find(".version-date").text();
      expect(dateText).toContain("Oct");
      expect(dateText).toContain("15");
      expect(dateText).toContain("2025");
    });
  });
});
