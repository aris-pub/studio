import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import AccountView from "@/views/account/View.vue";

// Mock the toast module
vi.mock("@/utils/toast.js", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const createObjectURLMock = vi.fn(() => "blob-url");
const revokeObjectURLMock = vi.fn();
vi.stubGlobal("URL", {
  createObjectURL: createObjectURLMock,
  revokeObjectURL: revokeObjectURLMock,
});

describe("AccountView", () => {
  let wrapper;
  let user;
  let api;
  let toast;
  const stubs = {
    BaseLayout: { template: "<div><slot/></div>", props: ["fab"] },
    HomeLayout: { template: "<div><slot/></div>" },
    Pane: { template: "<div><slot/></div>" },
    Section: {
      template: '<div><slot name="title"/><slot name="content"/><slot name="footer"/></div>',
      props: ["variant", "theme"],
    },
    IconUserCircle: true,
    InputText: { template: '<input v-bind="$attrs" />' },
    Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot/></button>' },
    Icon: { template: '<span class="icon-mock"></span>' },
  };

  beforeEach(async () => {
    // Reset toast mocks
    const { toast: toastModule } = await import("@/utils/toast.js");
    toast = toastModule;
    vi.clearAllMocks();

    user = ref({
      id: 1,
      name: "Alice",
      initials: "AL",
      email: "alice@example.com",
      created_at: "2020-01-01T00:00:00Z",
      color: "blue",
    });
    api = {
      get: vi.fn().mockResolvedValue({ data: new Blob([""], { type: "image/png" }) }),
      put: vi.fn().mockResolvedValue({ data: user.value }),
      post: vi.fn().mockResolvedValue({ data: "success" }),
      delete: vi.fn().mockResolvedValue({ data: "success" }),
    };
    wrapper = mount(AccountView, {
      global: {
        stubs,
        provide: {
          xsMode: false,
          mobileMode: false,
          user,
          api,
          refreshUser: vi.fn(),
        },
      },
    });
    await nextTick();
  });

  it("renders the username, email, and member since date", () => {
    expect(wrapper.find(".user-name").text()).toBe("Alice");
    expect(wrapper.text()).toContain("alice@example.com");
    expect(wrapper.text()).toContain("Member since");
  });

  it("calls api.put with updated profile and updates user ref on save", async () => {
    const newData = {
      id: 1,
      name: "Bob",
      initials: "BO",
      email: "bob@example.com",
      created_at: "2020-01-01T00:00:00Z",
    };
    api.put.mockResolvedValue({ data: newData });
    wrapper.vm.newName = "Bob";
    wrapper.vm.newInitials = "BO";
    wrapper.vm.newEmail = "bob@example.com";
    await wrapper.vm.onSaveProfile();
    expect(api.put).toHaveBeenCalledWith(
      "/users/1",
      expect.objectContaining({
        name: "Bob",
        initials: "BO",
        email: "bob@example.com",
      })
    );
    expect(user.value).toMatchObject(newData);
  });

  describe("Avatar Upload", () => {
    it("rejects non-image files with error message", async () => {
      const mockFile = new File(["test"], "test.pdf", { type: "application/pdf" });
      const mockEvent = { target: { files: [mockFile] } };

      await wrapper.vm.onFileSelected(mockEvent);

      expect(toast.error).toHaveBeenCalledWith("Please select an image file");
      expect(wrapper.vm.selectedFile).toBeNull();
      expect(wrapper.vm.localPreviewUrl).toBeNull();
    });

    it("rejects files over 5MB with error message", async () => {
      // Create mock file over 5MB
      const mockFile = new File(["x".repeat(6 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 6 * 1024 * 1024 });
      const mockEvent = { target: { files: [mockFile] } };

      await wrapper.vm.onFileSelected(mockEvent);

      expect(toast.error).toHaveBeenCalledWith("File size must be less than 5MB");
      expect(wrapper.vm.selectedFile).toBeNull();
      expect(wrapper.vm.localPreviewUrl).toBeNull();
    });

    it("successfully uploads valid image file", async () => {
      api.post = vi.fn().mockResolvedValue({ data: "success" });

      const mockFile = new File(["image data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 1024 }); // 1KB
      const mockEvent = { target: { files: [mockFile] } };

      await wrapper.vm.onFileSelected(mockEvent);

      expect(wrapper.vm.selectedFile).toBe(mockFile);
      expect(createObjectURLMock).toHaveBeenCalledWith(mockFile);
      expect(wrapper.vm.localPreviewUrl).toBe("blob-url");
      expect(api.post).toHaveBeenCalledWith("/users/1/avatar", expect.any(FormData), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      expect(toast.success).toHaveBeenCalledWith("Avatar updated successfully");
    });

    it("handles upload failure with error message", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      api.post = vi.fn().mockRejectedValue(new Error("Upload failed"));

      const mockFile = new File(["image data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 1024 });
      const mockEvent = { target: { files: [mockFile] } };

      await wrapper.vm.onFileSelected(mockEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to upload avatar", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it("creates and manages preview URLs correctly", async () => {
      const mockFile = new File(["image data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 1024 });
      const mockEvent = { target: { files: [mockFile] } };

      // Mock successful upload to avoid API call
      api.post = vi.fn().mockResolvedValue({ data: "success" });

      await wrapper.vm.onFileSelected(mockEvent);

      expect(createObjectURLMock).toHaveBeenCalledWith(mockFile);
      expect(wrapper.vm.localPreviewUrl).toBe("blob-url");

      // Test cleanup on unmount
      wrapper.unmount();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob-url");
    });

    it("fetches server avatar on mount", async () => {
      // The component should have called fetchAvatar on mount
      expect(api.get).toHaveBeenCalledWith("/users/1/avatar", {
        responseType: "blob",
      });
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(wrapper.vm.serverAvatarUrl).toBe("blob-url");
    });
  });

  describe("Error Handling", () => {
    it("handles profile update API failure gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const originalUser = { ...user.value };

      api.put.mockRejectedValue(new Error("API Error"));

      wrapper.vm.newName = "Failed Update";
      await wrapper.vm.onSaveProfile();

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to update user", expect.any(Error));
      // User state should remain unchanged after failed update
      expect(user.value).toEqual(originalUser);

      consoleErrorSpy.mockRestore();
    });

    it("handles network timeout during profile save", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const timeoutError = new Error("Network timeout");
      timeoutError.code = "NETWORK_TIMEOUT";
      api.put.mockRejectedValue(timeoutError);

      wrapper.vm.newName = "Timeout Test";
      await wrapper.vm.onSaveProfile();

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to update user", timeoutError);

      consoleErrorSpy.mockRestore();
    });

    it("handles malformed API response for profile update", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // API returns malformed response (missing data property)
      api.put.mockResolvedValue({ status: 200 }); // No data property

      wrapper.vm.newName = "Malformed Response";

      // This should not crash, but the user object won't be updated
      await wrapper.vm.onSaveProfile();

      // No error should be thrown, but user state remains unchanged
      expect(user.value.name).toBe("Alice"); // Original name

      consoleErrorSpy.mockRestore();
    });

    it("allows retry after error state", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // First call fails
      api.put.mockRejectedValueOnce(new Error("First attempt failed"));

      wrapper.vm.newName = "Retry Test";
      await wrapper.vm.onSaveProfile();

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to update user", expect.any(Error));

      // Second call succeeds
      const successData = { ...user.value, name: "Retry Test" };
      api.put.mockResolvedValue({ data: successData });

      await wrapper.vm.onSaveProfile();

      expect(user.value.name).toBe("Retry Test");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Async Operations", () => {
    it("handles delayed profile save operations", async () => {
      let resolvePromise;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const updateData = { ...user.value, name: "Delayed Update" };
      api.put.mockReturnValue(delayedPromise);

      wrapper.vm.newName = "Delayed Update";

      // Start the save operation
      const savePromise = wrapper.vm.onSaveProfile();

      // At this point, the operation should be in progress
      expect(api.put).toHaveBeenCalledWith(
        "/users/1",
        expect.objectContaining({
          name: "Delayed Update",
          initials: "AL",
          email: "alice@example.com",
        })
      );

      // User should still have original name while operation is pending
      expect(user.value.name).toBe("Alice");

      // Resolve the delayed operation
      resolvePromise({ data: updateData });
      await savePromise;

      // Now user should be updated
      expect(user.value.name).toBe("Delayed Update");
    });

    it("handles concurrent avatar fetch on component mount", async () => {
      // We can test that the avatar fetch was initiated during component setup
      expect(api.get).toHaveBeenCalledWith("/users/1/avatar", {
        responseType: "blob",
      });

      // The component should handle the blob response and create object URL
      expect(createObjectURLMock).toHaveBeenCalledWith(expect.any(Blob));
      expect(wrapper.vm.serverAvatarUrl).toBe("blob-url");
    });
  });

  describe("Dirty State Tracking", () => {
    it("tracks profile changes correctly", async () => {
      expect(wrapper.vm.hasUnsavedProfileChanges).toBe(false);

      wrapper.vm.newName = "New Name";
      expect(wrapper.vm.hasUnsavedProfileChanges).toBe(true);

      wrapper.vm.newName = null;
      wrapper.vm.newEmail = "new@example.com";
      expect(wrapper.vm.hasUnsavedProfileChanges).toBe(true);

      wrapper.vm.newEmail = null;
      expect(wrapper.vm.hasUnsavedProfileChanges).toBe(false);
    });

    it("tracks overall unsaved changes", async () => {
      expect(wrapper.vm.hasUnsavedProfileChanges).toBe(false);

      wrapper.vm.newName = "Changed";
      expect(wrapper.vm.hasUnsavedProfileChanges).toBe(true);

      wrapper.vm.newName = null;
      expect(wrapper.vm.hasUnsavedProfileChanges).toBe(false);
    });

    it("shows unsaved changes warning in UI", async () => {
      expect(wrapper.find(".status-message.warning").exists()).toBe(false);

      wrapper.vm.newName = "Changed Name";
      await nextTick();

      expect(wrapper.find(".status-message.warning").exists()).toBe(true);
      expect(wrapper.find(".status-message.warning").text()).toContain("You have unsaved changes");
    });
  });

  describe("Form Reset/Discard", () => {
    it("discards profile changes when confirmed", async () => {
      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      wrapper.vm.newName = "Changed Name";
      wrapper.vm.newEmail = "changed@example.com";

      await wrapper.vm.onDiscardProfile();

      expect(wrapper.vm.newName).toBeNull();
      expect(wrapper.vm.newEmail).toBeNull();
      expect(toast.info).toHaveBeenCalledWith("Changes discarded");

      confirmSpy.mockRestore();
    });

    it("does not discard changes when cancelled", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      wrapper.vm.newName = "Changed Name";
      const originalName = wrapper.vm.newName;

      await wrapper.vm.onDiscardProfile();

      expect(wrapper.vm.newName).toBe(originalName);
      expect(toast.info).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it("does nothing when no unsaved changes exist", async () => {
      const confirmSpy = vi.spyOn(window, "confirm");

      await wrapper.vm.onDiscardProfile();

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe("Browser Navigation Protection", () => {
    beforeEach(() => {
      // Mock window events
      window.addEventListener = vi.fn();
      window.removeEventListener = vi.fn();
    });

    it("adds beforeunload listener when there are unsaved changes", async () => {
      wrapper.vm.newName = "Changed Name";
      await nextTick();

      expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });

    it("removes beforeunload listener when changes are saved", async () => {
      wrapper.vm.newName = "Changed Name";
      await nextTick();

      // Clear the name (simulate save)
      wrapper.vm.newName = null;
      await nextTick();

      expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });

    it("removes beforeunload listener on component unmount", () => {
      wrapper.unmount();
      expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });
  });
});
