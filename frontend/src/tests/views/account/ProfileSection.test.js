import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import ProfileSection from "@/views/account/ProfileSection.vue";

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

describe("ProfileSection", () => {
  let wrapper;
  let user;
  let api;
  let toast;
  const stubs = {
    Section: {
      template: '<div><slot name="title"/><slot name="content"/></div>',
      props: ["variant"],
    },
    InputText: { template: '<input v-bind="$attrs" />' },
    Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot/></button>' },
    Icon: { template: '<span class="icon-mock"></span>' },
  };

  beforeEach(async () => {
    const { toast: toastModule } = await import("@/utils/toast.js");
    toast = toastModule;
    vi.clearAllMocks();

    user = ref({
      id: 1,
      name: "Alice",
      initials: "AL",
      email: "alice@example.com",
      affiliation: "MIT",
      created_at: "2020-01-01T00:00:00Z",
    });
    api = {
      get: vi.fn().mockResolvedValue({ data: new Blob([""], { type: "image/png" }) }),
      put: vi.fn().mockResolvedValue({ data: user.value }),
      post: vi.fn().mockResolvedValue({ data: "success" }),
    };
    wrapper = mount(ProfileSection, {
      global: {
        stubs,
        provide: { user, api },
      },
    });
    await nextTick();
  });

  it("renders the username, email, and member since date", () => {
    expect(wrapper.find(".user-name").text()).toBe("Alice");
    expect(wrapper.text()).toContain("alice@example.com");
    expect(wrapper.text()).toContain("Member since");
  });

  it("exposes hasUnsavedChanges via defineExpose", () => {
    expect(wrapper.vm.hasUnsavedChanges).toBe(false);
    wrapper.vm.newName = "Bob";
    expect(wrapper.vm.hasUnsavedChanges).toBe(true);
  });

  it("calls api.put with updated profile on save", async () => {
    const newData = { ...user.value, name: "Bob", initials: "BO", email: "bob@example.com" };
    api.put.mockResolvedValue({ data: newData });
    wrapper.vm.newName = "Bob";
    wrapper.vm.newInitials = "BO";
    wrapper.vm.newEmail = "bob@example.com";
    await wrapper.vm.onSaveProfile();
    expect(api.put).toHaveBeenCalledWith(
      "/users/1",
      expect.objectContaining({ name: "Bob", initials: "BO", email: "bob@example.com" })
    );
    expect(user.value).toMatchObject(newData);
  });

  it("handles profile update failure gracefully", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    api.put.mockRejectedValue(new Error("API Error"));
    wrapper.vm.newName = "Failed";
    await wrapper.vm.onSaveProfile();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to update user", expect.any(Error));
    expect(user.value.name).toBe("Alice");
    consoleErrorSpy.mockRestore();
  });

  it("tracks profile dirty state correctly", () => {
    expect(wrapper.vm.hasUnsavedChanges).toBe(false);
    wrapper.vm.newName = "New Name";
    expect(wrapper.vm.hasUnsavedChanges).toBe(true);
    wrapper.vm.newName = null;
    expect(wrapper.vm.hasUnsavedChanges).toBe(false);
  });

  it("shows unsaved changes warning in UI", async () => {
    expect(wrapper.find(".status-message.warning").exists()).toBe(false);
    wrapper.vm.newName = "Changed Name";
    await nextTick();
    expect(wrapper.find(".status-message.warning").exists()).toBe(true);
    expect(wrapper.find(".status-message.warning").text()).toContain("You have unsaved changes");
  });

  it("unsaved changes warning has aria-live for screen readers", async () => {
    wrapper.vm.newName = "Changed Name";
    await nextTick();
    const warning = wrapper.find(".status-message.warning");
    expect(warning.attributes("role")).toBe("status");
    expect(warning.attributes("aria-live")).toBe("polite");
  });

  describe("Discard", () => {
    it("shows inline confirmation bar when Reset is clicked with unsaved changes", async () => {
      wrapper.vm.newName = "Changed Name";
      await nextTick();
      expect(wrapper.find(".discard-confirm").exists()).toBe(false);

      wrapper.vm.onDiscardProfile();
      await nextTick();
      expect(wrapper.find(".discard-confirm").exists()).toBe(true);
      expect(wrapper.find(".discard-confirm").text()).toContain("Discard unsaved changes?");
    });

    it("discards changes when Discard button is clicked", async () => {
      wrapper.vm.newName = "Changed Name";
      wrapper.vm.newEmail = "changed@example.com";
      await nextTick();

      wrapper.vm.onDiscardProfile();
      await nextTick();

      wrapper.vm.confirmDiscard();
      await nextTick();
      expect(wrapper.vm.newName).toBeNull();
      expect(wrapper.vm.newEmail).toBeNull();
      expect(wrapper.vm.showDiscardConfirm).toBe(false);
      expect(toast.info).toHaveBeenCalledWith("Changes discarded");
    });

    it("hides confirmation bar when Keep Editing is clicked", async () => {
      wrapper.vm.newName = "Changed";
      await nextTick();

      wrapper.vm.onDiscardProfile();
      await nextTick();
      expect(wrapper.vm.showDiscardConfirm).toBe(true);

      wrapper.vm.cancelDiscard();
      await nextTick();
      expect(wrapper.vm.showDiscardConfirm).toBe(false);
      expect(wrapper.vm.newName).toBe("Changed");
    });

    it("does nothing when no unsaved changes exist", async () => {
      wrapper.vm.onDiscardProfile();
      await nextTick();
      expect(wrapper.vm.showDiscardConfirm).toBe(false);
    });
  });

  describe("Avatar Upload", () => {
    it("has aria-label on the upload button for accessibility", () => {
      const uploadButton = wrapper.find(".avatar-upload");
      expect(uploadButton.exists()).toBe(true);
      expect(uploadButton.attributes("aria-label")).toBe("Upload profile picture");
    });

    it("rejects non-image files", async () => {
      const mockFile = new File(["test"], "test.pdf", { type: "application/pdf" });
      await wrapper.vm.onFileSelected({ target: { files: [mockFile] } });
      expect(toast.error).toHaveBeenCalledWith("Please select an image file");
      expect(wrapper.vm.selectedFile).toBeNull();
    });

    it("rejects files over 5MB", async () => {
      const mockFile = new File(["x"], "large.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 6 * 1024 * 1024 });
      await wrapper.vm.onFileSelected({ target: { files: [mockFile] } });
      expect(toast.error).toHaveBeenCalledWith("File size must be less than 5MB");
    });

    it("successfully uploads valid image file", async () => {
      const mockFile = new File(["image data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 1024 });
      await wrapper.vm.onFileSelected({ target: { files: [mockFile] } });
      expect(wrapper.vm.selectedFile).toBe(mockFile);
      expect(api.post).toHaveBeenCalledWith("/users/1/avatar", expect.any(FormData), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      expect(toast.success).toHaveBeenCalledWith("Avatar updated successfully");
    });

    it("fetches server avatar on mount", () => {
      expect(api.get).toHaveBeenCalledWith("/users/1/avatar", { responseType: "blob" });
      expect(wrapper.vm.serverAvatarUrl).toBe("blob-url");
    });

    it("cleans up object URLs on unmount", async () => {
      const mockFile = new File(["image data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 1024 });
      api.post = vi.fn().mockResolvedValue({ data: "success" });
      await wrapper.vm.onFileSelected({ target: { files: [mockFile] } });
      wrapper.unmount();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob-url");
    });
  });
});
