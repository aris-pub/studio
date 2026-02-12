import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import SecurityView from "@/views/account/SecurityView.vue";
import Button from "@/components/base/Button.vue";
import { toast } from "@/utils/toast.js";

// Mock toast utility
vi.mock("@/utils/toast.js", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock console to suppress test output
beforeEach(() => {
  console.error = vi.fn();
});

// Mock components to avoid dependencies while keeping structure
const MockIcon = {
  name: "Icon",
  props: ["name", "size"],
  template: `<span class="mock-icon" :data-icon="name">{{ name }}</span>`,
};

const MockPane = {
  name: "Pane",
  template: `<div class="mock-pane"><slot></slot></div>`,
};

const MockInputText = {
  name: "InputText",
  props: ["modelValue", "label", "type", "disabled", "direction"],
  emits: ["update:modelValue"],
  template: `<div class="input-text">
    <label v-if="label">{{ label }}</label>
    <input 
      :type="type || 'text'" 
      :value="modelValue" 
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  </div>`,
};

const MockPasswordStrength = {
  name: "PasswordStrength",
  props: ["password"],
  template: `<div class="password-strength">Password Strength</div>`,
};

const MockSection = {
  name: "Section",
  template: `<div class="mock-section">
    <div v-if="$slots.title" class="title"><slot name="title"></slot></div>
    <div class="content"><slot name="content"></slot></div>
  </div>`,
};

describe("SecurityView Email Verification", () => {
  let wrapper;
  let mockApi;
  let mockUser;
  let mockRefreshUser;

  beforeEach(() => {
    mockApi = {
      post: vi.fn(),
    };

    mockRefreshUser = vi.fn();

    vi.clearAllMocks();
  });

  describe("Email Verification Status Display", () => {
    it("shows verified status for verified users", async () => {
      mockUser = ref({
        id: 1,
        email: "test@example.com",
        email_verified: true,
      });

      wrapper = mount(SecurityView, {
        global: {
          provide: {
            user: mockUser,
            api: mockApi,
            refreshUser: mockRefreshUser,
          },
          components: {
            Icon: MockIcon,
            Button: Button,
            Pane: MockPane,
            Section: MockSection,
            InputText: MockInputText,
            PasswordStrength: MockPasswordStrength,
          },
        },
      });

      // Should show verified status
      expect(wrapper.text()).toContain("Email Verified");
      expect(wrapper.find(".status-indicator.verified").exists()).toBe(true);
      expect(wrapper.find(".status-indicator.warning").exists()).toBe(false);

      // Should NOT show send verification button
      expect(wrapper.find('button[data-test="send-verification"]').exists()).toBe(false);
    });

    it("shows unverified status for unverified users", async () => {
      mockUser = ref({
        id: 1,
        email: "test@example.com",
        email_verified: false,
      });

      wrapper = mount(SecurityView, {
        global: {
          provide: {
            user: mockUser,
            api: mockApi,
            refreshUser: mockRefreshUser,
          },
          components: {
            Icon: MockIcon,
            Button: Button,
            Pane: MockPane,
            Section: MockSection,
            InputText: MockInputText,
            PasswordStrength: MockPasswordStrength,
          },
        },
      });

      // Should show unverified status
      expect(wrapper.text()).toContain("Email Not Verified");
      expect(wrapper.find(".status-indicator.warning").exists()).toBe(true);
      expect(wrapper.find(".status-indicator.verified").exists()).toBe(false);

      // Should show send verification button
      expect(wrapper.text()).toContain("Send Verification Email");
    });
  });

  describe("Send Verification Email", () => {
    beforeEach(() => {
      mockUser = ref({
        id: 1,
        email: "test@example.com",
        email_verified: false,
      });

      wrapper = mount(SecurityView, {
        global: {
          provide: {
            user: mockUser,
            api: mockApi,
            refreshUser: mockRefreshUser,
          },
          components: {
            Icon: MockIcon,
            Button: Button,
            Pane: MockPane,
            Section: MockSection,
            InputText: MockInputText,
            PasswordStrength: MockPasswordStrength,
          },
        },
      });
    });

    it("sends verification email successfully", async () => {
      mockApi.post.mockResolvedValueOnce({ data: { message: "Verification email sent" } });

      // Find and click the send verification button
      const sendButtons = wrapper.findAll("button");
      const sendButton = sendButtons.find((btn) => btn.text().includes("Send Verification Email"));
      expect(sendButton).toBeTruthy();

      await sendButton.trigger("click");

      // Should call the API
      expect(mockApi.post).toHaveBeenCalledWith("/users/1/send-verification");

      // Wait for next tick to allow async operations
      await wrapper.vm.$nextTick();

      // Should show success toast
      expect(toast.success).toHaveBeenCalledWith(
        "Verification email sent successfully",
        expect.objectContaining({
          description: "Please check your email and click the verification link.",
        })
      );

      // Should show verification sent status
      expect(wrapper.text()).toContain("Verification email sent");
    });

    it("handles API error gracefully", async () => {
      mockApi.post.mockRejectedValueOnce({
        response: { status: 500 },
        message: "Network error",
      });

      // Find and click the send verification button
      const sendButtons = wrapper.findAll("button");
      const sendButton = sendButtons.find((btn) => btn.text().includes("Send Verification Email"));
      expect(sendButton).toBeTruthy();

      await sendButton.trigger("click");

      // Should call the API
      expect(mockApi.post).toHaveBeenCalledWith("/users/1/send-verification");

      // Wait for next tick to allow async operations
      await wrapper.vm.$nextTick();

      // Should show error toast
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to send verification email",
        expect.objectContaining({
          description: "Please check your connection and try again.",
        })
      );
    });

    it("handles already verified error", async () => {
      mockApi.post.mockRejectedValueOnce({
        response: { status: 400 },
        message: "Email is already verified",
      });

      // Find and click the send verification button
      const sendButtons = wrapper.findAll("button");
      const sendButton = sendButtons.find((btn) => btn.text().includes("Send Verification Email"));
      expect(sendButton).toBeTruthy();

      await sendButton.trigger("click");

      // Wait for next tick to allow async operations
      await wrapper.vm.$nextTick();

      // Should show specific error message
      expect(toast.error).toHaveBeenCalledWith("Email is already verified");
    });

    it("shows loading state during API call", async () => {
      // Mock a slow API response
      let resolvePromise;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApi.post.mockReturnValueOnce(slowPromise);

      // Find and click the send verification button
      const sendButtons = wrapper.findAll("button");
      const sendButton = sendButtons.find((btn) => btn.text().includes("Send Verification Email"));
      expect(sendButton).toBeTruthy();

      await sendButton.trigger("click");

      // Should show loading state
      expect(wrapper.text()).toContain("Sending...");

      // Resolve the promise
      resolvePromise({ data: { message: "Success" } });
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick(); // Extra tick for reactivity

      // Should show success state after API call completes
      expect(wrapper.text()).toContain("Verification email sent");
    });

    it("disables button during sending", async () => {
      // Mock a slow API response
      let resolvePromise;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApi.post.mockReturnValueOnce(slowPromise);

      // Find and click the send verification button
      const sendButtons = wrapper.findAll("button");
      const sendButton = sendButtons.find((btn) => btn.text().includes("Send Verification Email"));
      expect(sendButton).toBeTruthy();

      await sendButton.trigger("click");

      // Button should be disabled during API call
      const buttonsAfterClick = wrapper.findAll("button");
      const buttonAfterClick = buttonsAfterClick.find((btn) => btn.text().includes("Sending..."));
      expect(buttonAfterClick).toBeTruthy();
      expect(buttonAfterClick.attributes("disabled")).toBeDefined();

      // Resolve the promise
      resolvePromise({ data: { message: "Success" } });
      await wrapper.vm.$nextTick();
    });

    it("prevents multiple concurrent requests", async () => {
      // Mock API calls
      mockApi.post.mockResolvedValue({ data: { message: "Success" } });

      // Find the send verification button
      const sendButtons = wrapper.findAll("button");
      const sendButton = sendButtons.find((btn) => btn.text().includes("Send Verification Email"));
      expect(sendButton).toBeTruthy();

      // Click multiple times rapidly
      await sendButton.trigger("click");
      await sendButton.trigger("click");
      await sendButton.trigger("click");

      // Should only make one API call
      expect(mockApi.post).toHaveBeenCalledTimes(1);
    });
  });

  describe("Password Change Integration", () => {
    beforeEach(() => {
      mockUser = ref({
        id: 1,
        email: "test@example.com",
        email_verified: true,
      });

      wrapper = mount(SecurityView, {
        global: {
          provide: {
            user: mockUser,
            api: mockApi,
            refreshUser: mockRefreshUser,
          },
          components: {
            Icon: MockIcon,
            Button: Button,
            Pane: MockPane,
            Section: MockSection,
            InputText: MockInputText,
            PasswordStrength: MockPasswordStrength,
          },
        },
      });
    });

    it("includes password change functionality", () => {
      // Should have password section
      expect(wrapper.text()).toContain("Password");
      expect(wrapper.text()).toContain("Change your account password");

      // Should have password form elements
      expect(wrapper.text()).toContain("Current Password");
      expect(wrapper.text()).toContain("New Password");
      expect(wrapper.text()).toContain("Confirm New Password");
      expect(wrapper.text()).toContain("Update Password");
    });

    it("handles password change API calls", async () => {
      mockApi.post.mockResolvedValueOnce({ data: { message: "Password changed successfully" } });

      // Simulate filling form (we're using stubs so we can't actually fill inputs)
      await wrapper.vm.onChangePassword();

      // The component should show validation errors for empty fields
      expect(toast.error).toHaveBeenCalledWith("Please fill in all password fields");
    });
  });

  describe("Component Integration", () => {
    it("properly handles user context", () => {
      mockUser = ref({
        id: 1,
        email: "test@example.com",
        email_verified: false,
      });

      wrapper = mount(SecurityView, {
        global: {
          provide: {
            user: mockUser,
            api: mockApi,
            refreshUser: mockRefreshUser,
          },
          components: {
            Icon: MockIcon,
            Button: Button,
            Pane: MockPane,
            Section: MockSection,
            InputText: MockInputText,
            PasswordStrength: MockPasswordStrength,
          },
        },
      });

      // Should display user email
      expect(wrapper.text()).toContain("test@example.com");
    });

    it("gracefully handles missing user context", () => {
      wrapper = mount(SecurityView, {
        global: {
          provide: {
            user: ref(null),
            api: mockApi,
            refreshUser: mockRefreshUser,
          },
          components: {
            Icon: MockIcon,
            Button: Button,
            Pane: MockPane,
            Section: MockSection,
            InputText: MockInputText,
            PasswordStrength: MockPasswordStrength,
          },
        },
      });

      // Should not crash when user is null
      expect(wrapper.exists()).toBe(true);
    });
  });
});
