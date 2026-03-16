import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import SecuritySection from "@/views/account/SecuritySection.vue";

vi.mock("@/utils/toast.js", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe("SecuritySection", () => {
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
    PasswordInput: { template: '<input v-bind="$attrs" />' },
    Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot/></button>' },
    Icon: { template: '<span class="icon-mock"></span>' },
    PasswordStrength: { template: "<div></div>", props: ["password"] },
  };

  beforeEach(async () => {
    const { toast: toastModule } = await import("@/utils/toast.js");
    toast = toastModule;
    vi.clearAllMocks();

    user = ref({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      email_verified: false,
    });
    api = {
      post: vi.fn().mockResolvedValue({ data: "success" }),
    };
    wrapper = mount(SecuritySection, {
      global: {
        stubs,
        provide: { user, api },
      },
    });
  });

  it("exposes hasUnsavedChanges via defineExpose", () => {
    expect(wrapper.vm.hasUnsavedChanges).toBe(false);
    wrapper.vm.currentPassword = "old";
    expect(wrapper.vm.hasUnsavedChanges).toBe(true);
  });

  describe("Email Verification", () => {
    it("sends verification email successfully", async () => {
      await wrapper.vm.onSendVerificationEmail();
      expect(api.post).toHaveBeenCalledWith("/users/1/send-verification");
      expect(toast.success).toHaveBeenCalledWith(
        "Verification email sent successfully",
        expect.any(Object)
      );
    });

    it("handles already-verified error (400)", async () => {
      api.post.mockRejectedValue({ response: { status: 400 } });
      vi.spyOn(console, "error").mockImplementation(() => {});
      await wrapper.vm.onSendVerificationEmail();
      expect(toast.error).toHaveBeenCalledWith("Email is already verified");
      console.error.mockRestore();
    });

    it("handles generic verification error", async () => {
      api.post.mockRejectedValue(new Error("Network error"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      await wrapper.vm.onSendVerificationEmail();
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to send verification email",
        expect.any(Object)
      );
      console.error.mockRestore();
    });
  });

  describe("Password Change", () => {
    it("requires all password fields", async () => {
      wrapper.vm.currentPassword = "old";
      wrapper.vm.newPassword = "";
      wrapper.vm.confirmPassword = "";
      await wrapper.vm.onChangePassword();
      expect(toast.error).toHaveBeenCalledWith("Please fill in all password fields");
    });

    it("validates passwords match", async () => {
      wrapper.vm.currentPassword = "old";
      wrapper.vm.newPassword = "newpass123";
      wrapper.vm.confirmPassword = "different";
      await wrapper.vm.onChangePassword();
      expect(toast.error).toHaveBeenCalledWith("New passwords do not match");
    });

    it("validates minimum password length", async () => {
      wrapper.vm.currentPassword = "old";
      wrapper.vm.newPassword = "short";
      wrapper.vm.confirmPassword = "short";
      await wrapper.vm.onChangePassword();
      expect(toast.error).toHaveBeenCalledWith("New password must be at least 8 characters long");
    });

    it("changes password successfully", async () => {
      wrapper.vm.currentPassword = "oldpass123";
      wrapper.vm.newPassword = "newpass123";
      wrapper.vm.confirmPassword = "newpass123";
      await wrapper.vm.onChangePassword();
      expect(api.post).toHaveBeenCalledWith("/users/1/change-password", {
        current_password: "oldpass123",
        new_password: "newpass123",
      });
      expect(toast.success).toHaveBeenCalledWith("Password changed successfully");
      expect(wrapper.vm.currentPassword).toBe("");
      expect(wrapper.vm.newPassword).toBe("");
      expect(wrapper.vm.confirmPassword).toBe("");
    });

    it("handles incorrect current password (401)", async () => {
      api.post.mockRejectedValue({ response: { status: 401 } });
      vi.spyOn(console, "error").mockImplementation(() => {});
      wrapper.vm.currentPassword = "wrong";
      wrapper.vm.newPassword = "newpass123";
      wrapper.vm.confirmPassword = "newpass123";
      await wrapper.vm.onChangePassword();
      expect(toast.error).toHaveBeenCalledWith("Current password is incorrect");
      console.error.mockRestore();
    });

    it("discards password changes", () => {
      wrapper.vm.currentPassword = "old";
      wrapper.vm.newPassword = "new";
      wrapper.vm.confirmPassword = "new";
      wrapper.vm.onDiscardPassword();
      expect(wrapper.vm.currentPassword).toBe("");
      expect(wrapper.vm.newPassword).toBe("");
      expect(wrapper.vm.confirmPassword).toBe("");
      expect(toast.info).toHaveBeenCalledWith("Changes discarded");
    });

    it("discard does nothing when no changes", () => {
      wrapper.vm.onDiscardPassword();
      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  it("shows unsaved password warning with a11y attributes", async () => {
    wrapper.vm.currentPassword = "old-pass";
    await nextTick();
    const warning = wrapper.find(".status-message.warning");
    expect(warning.exists()).toBe(true);
    expect(warning.attributes("role")).toBe("status");
    expect(warning.attributes("aria-live")).toBe("polite");
  });
});
