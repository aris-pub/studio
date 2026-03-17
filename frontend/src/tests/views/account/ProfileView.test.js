import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import AccountView from "@/views/account/View.vue";
import ProfileSection from "@/views/account/ProfileSection.vue";
import SecuritySection from "@/views/account/SecuritySection.vue";
import DataManagementSection from "@/views/account/DataManagementSection.vue";
import DangerZone from "@/views/account/DangerZone.vue";

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

describe("AccountView (integration)", () => {
  let wrapper;
  let user;
  let api;
  const stubs = {
    BaseLayout: { template: "<div><slot/></div>", props: ["fab"] },
    Pane: { template: "<div><slot/></div>" },
    Section: {
      template:
        '<div><component :is="headingTag || \'div\'"><slot name="title"/></component><slot name="content"/><slot name="footer"/></div>',
      props: ["variant", "theme", "headingTag"],
    },
    InputText: { template: '<input v-bind="$attrs" />' },
    PasswordInput: {
      template:
        '<div class="password-field"><input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><button type="button" data-testid="toggle-password">Show</button></div>',
      props: ["modelValue", "label"],
      emits: ["update:modelValue"],
    },
    Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot/></button>' },
    Icon: { template: '<span class="icon-mock"></span>' },
    PasswordStrength: { template: "<div></div>", props: ["password"] },
  };

  beforeEach(async () => {
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

  it("renders all four sub-components", () => {
    expect(wrapper.findComponent(ProfileSection).exists()).toBe(true);
    expect(wrapper.findComponent(SecuritySection).exists()).toBe(true);
    expect(wrapper.findComponent(DataManagementSection).exists()).toBe(true);
    expect(wrapper.findComponent(DangerZone).exists()).toBe(true);
  });

  it("renders the username and email via ProfileSection", () => {
    expect(wrapper.find(".user-name").text()).toBe("Alice");
    expect(wrapper.text()).toContain("alice@example.com");
    expect(wrapper.text()).toContain("Member since");
  });

  describe("Browser Navigation Protection", () => {
    beforeEach(() => {
      window.addEventListener = vi.fn();
      window.removeEventListener = vi.fn();
    });

    it("adds beforeunload listener when profile has unsaved changes", async () => {
      const profile = wrapper.findComponent(ProfileSection);
      profile.vm.newName = "Changed Name";
      await nextTick();
      await nextTick();

      expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });

    it("adds beforeunload listener when security has unsaved changes", async () => {
      const security = wrapper.findComponent(SecuritySection);
      security.vm.currentPassword = "old-pass";
      await nextTick();
      await nextTick();

      expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });

    it("removes beforeunload listener on component unmount", () => {
      wrapper.unmount();
      expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });
  });
});
