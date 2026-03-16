import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount, RouterLinkStub } from "@vue/test-utils";
import LoginView from "@/views/login/View.vue";
import AuthLayout from "@/components/layout/AuthLayout.vue";
import Button from "@/components/base/Button.vue";
import InputText from "@/components/forms/InputText.vue";
import PasswordInput from "@/components/forms/PasswordInput.vue";
import Logo from "@/components/base/Logo.vue";

// Stub useRouter to capture navigation calls
const pushMock = vi.fn();
vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useRouter: () => ({ push: pushMock }),
  };
});

describe("LoginView", () => {
  let wrapper;

  beforeEach(() => {
    pushMock.mockClear();

    const mockApi = {
      post: vi.fn(),
      get: vi.fn(),
      defaults: { baseURL: "http://localhost:8000" },
    };

    wrapper = mount(LoginView, {
      global: {
        components: { AuthLayout, Button, InputText, PasswordInput, Logo },
        stubs: { RouterLink: RouterLinkStub },
        provide: {
          api: mockApi,
          user: ref(null),
          fileStore: ref(null),
          isDev: false,
        },
      },
    });
  });

  it("uses browser native validation for empty fields", async () => {
    // Verify that email input has required attribute for browser validation
    const emailInput = wrapper.find('[data-testid="email-input"]');
    const passwordInput = wrapper.find('[data-testid="password-input"]');

    expect(emailInput.attributes("required")).toBeDefined();
    expect(passwordInput.attributes("required")).toBeDefined();
    expect(emailInput.attributes("type")).toBe("email");
  });

  it("renders register link as a RouterLink to /register", () => {
    const link = wrapper.findComponent(RouterLinkStub);
    expect(link.exists()).toBe(true);
    expect(link.props("to")).toBe("/register");
  });

  it("register link displays correct text", () => {
    const link = wrapper.findComponent(RouterLinkStub);
    expect(link.text()).toBe("Create an account");
  });

  it("login button is type=submit so form handles submission", () => {
    const loginBtn = wrapper.find('[data-testid="login-button"]');
    expect(loginBtn.attributes("type")).toBe("submit");
  });

  it("register link does not trigger login form submission", () => {
    const link = wrapper.find('[data-testid="register-link"]');
    expect(link.element.tagName).not.toBe("BUTTON");
  });

  it("displays the Logo component", () => {
    expect(wrapper.find(".logo").exists()).toBe(true);
  });

  it("shows a Sign in heading", () => {
    const heading = wrapper.find("h1");
    expect(heading.exists()).toBe(true);
    expect(heading.text()).toBe("Sign in");
  });

  it("shows RSM Studio in subheading, not Aris Studio", () => {
    const sub = wrapper.find(".form-subheading");
    expect(sub.text()).toContain("RSM Studio");
    expect(sub.text()).not.toContain("Aris Studio");
  });

  it("has a brand panel", () => {
    expect(wrapper.find(".brand-panel").exists()).toBe(true);
  });

  it("wraps the form in a card container", () => {
    expect(wrapper.find(".form-card").exists()).toBe(true);
  });

  it("uses InputText component for form fields", () => {
    const inputTexts = wrapper.findAllComponents(InputText);
    expect(inputTexts.length).toBe(2);
    expect(inputTexts[0].props("label")).toBe("Email");
    expect(inputTexts[0].props("type")).toBe("email");
    expect(inputTexts[1].props("label")).toBe("Password");
    expect(inputTexts[1].props("type")).toBe("password");
  });

  it("wraps fields in a form element", () => {
    expect(wrapper.find("form").exists()).toBe(true);
  });

  it("marks error container with role=alert and aria-live", async () => {
    const mockApi = {
      post: vi.fn().mockRejectedValue({ response: { data: { detail: "Bad" } } }),
      get: vi.fn(),
      defaults: { baseURL: "" },
    };
    const w = mount(LoginView, {
      global: {
        components: { AuthLayout, Button, InputText, PasswordInput, Logo },
        stubs: { RouterLink: RouterLinkStub },
        provide: { api: mockApi, user: ref(null), fileStore: ref(null), isDev: false },
      },
    });
    await w.find('[data-testid="email-input"]').setValue("a@b.com");
    await w.find('[data-testid="password-input"]').setValue("pass");
    await w.vm.onLogin();
    await nextTick();
    const errorEl = w.find('[data-testid="auth-error"]');
    expect(errorEl.attributes("role")).toBe("alert");
    expect(errorEl.attributes("aria-live")).toBe("assertive");
  });

  it("styles error as an alert container", async () => {
    const mockApi = {
      post: vi.fn().mockRejectedValue({ response: { data: { detail: "Bad" } } }),
      get: vi.fn(),
      defaults: { baseURL: "" },
    };
    const w = mount(LoginView, {
      global: {
        components: { AuthLayout, Button, InputText, PasswordInput, Logo },
        stubs: { RouterLink: RouterLinkStub },
        provide: { api: mockApi, user: ref(null), fileStore: ref(null), isDev: false },
      },
    });
    await w.find('[data-testid="email-input"]').setValue("a@b.com");
    await w.find('[data-testid="password-input"]').setValue("pass");
    await w.vm.onLogin();
    await nextTick();
    const errorEl = w.find('[data-testid="auth-error"]');
    expect(errorEl.classes()).toContain("error-alert");
  });

  it("register link is not a Button component", () => {
    const buttons = wrapper.findAllComponents(Button);
    const registerButton = buttons.find(
      (b) => b.attributes("data-testid") === "register-link"
    );
    expect(registerButton).toBeUndefined();
  });

  it("toggles password visibility", async () => {
    const pwdInput = wrapper.find('[data-testid="password-input"]');
    expect(pwdInput.attributes("type")).toBe("password");
    await wrapper.find('[data-testid="toggle-password"]').trigger("click");
    expect(wrapper.find('[data-testid="password-input"]').attributes("type")).toBe("text");
    await wrapper.find('[data-testid="toggle-password"]').trigger("click");
    expect(wrapper.find('[data-testid="password-input"]').attributes("type")).toBe("password");
  });

  it("sets autocomplete attributes on form fields (WCAG 1.3.5)", () => {
    expect(wrapper.find('[data-testid="email-input"]').attributes("autocomplete")).toBe("email");
    expect(wrapper.find('[data-testid="password-input"]').attributes("autocomplete")).toBe(
      "current-password"
    );
  });

  it("does not render a 'Forgot password?' element", () => {
    expect(wrapper.text()).not.toContain("Forgot password?");
    expect(wrapper.find(".field-footer").exists()).toBe(false);
  });

  it("has an aria-live region that announces loading state", async () => {
    const statusRegion = wrapper.find('[data-testid="login-status"]');
    expect(statusRegion.exists()).toBe(true);
    expect(statusRegion.attributes("aria-live")).toBe("polite");
    expect(statusRegion.attributes("role")).toBe("status");
    expect(statusRegion.text()).toBe("");
  });

  it("announces 'Logging in…' to screen readers when loading", async () => {
    const mockApi = {
      post: vi.fn(() => new Promise(() => {})),
      get: vi.fn(),
      defaults: { baseURL: "" },
    };
    const w = mount(LoginView, {
      global: {
        components: { AuthLayout, Button, InputText, PasswordInput, Logo },
        stubs: { RouterLink: RouterLinkStub },
        provide: { api: mockApi, user: ref(null), fileStore: ref(null), isDev: false },
      },
    });
    await w.find('[data-testid="email-input"]').setValue("a@b.com");
    await w.find('[data-testid="password-input"]').setValue("pass");
    w.vm.onLogin();
    await nextTick();
    const statusRegion = w.find('[data-testid="login-status"]');
    expect(statusRegion.text()).toBe("Logging in…");
  });

  it("clears the loading announcement after login completes", async () => {
    const mockApi = {
      post: vi.fn().mockRejectedValue({ response: { data: { detail: "Bad" } } }),
      get: vi.fn(),
      defaults: { baseURL: "" },
    };
    const w = mount(LoginView, {
      global: {
        components: { AuthLayout, Button, InputText, PasswordInput, Logo },
        stubs: { RouterLink: RouterLinkStub },
        provide: { api: mockApi, user: ref(null), fileStore: ref(null), isDev: false },
      },
    });
    await w.find('[data-testid="email-input"]').setValue("a@b.com");
    await w.find('[data-testid="password-input"]').setValue("pass");
    await w.vm.onLogin();
    await nextTick();
    const statusRegion = w.find('[data-testid="login-status"]');
    expect(statusRegion.text()).toBe("");
  });

  it("visually hides the status region", () => {
    const statusRegion = wrapper.find('[data-testid="login-status"]');
    expect(statusRegion.classes()).toContain("sr-only");
  });

  it("pre-populates credentials when isDev is true", async () => {
    vi.stubEnv("VITE_DEV_LOGIN_EMAIL", "dev@example.com");
    vi.stubEnv("VITE_DEV_LOGIN_PASSWORD", "devpassword");

    const devWrapper = mount(LoginView, {
      global: {
        components: { AuthLayout, Button, InputText, PasswordInput, Logo },
        stubs: { RouterLink: RouterLinkStub },
        provide: {
          api: { post: vi.fn(), get: vi.fn(), defaults: { baseURL: "" } },
          user: ref(null),
          fileStore: ref(null),
          isDev: true,
        },
      },
    });

    await nextTick();

    expect(devWrapper.find('[data-testid="email-input"]').element.value).toBe("dev@example.com");
    expect(devWrapper.find('[data-testid="password-input"]').element.value).toBe("devpassword");

    vi.unstubAllEnvs();
  });
});
