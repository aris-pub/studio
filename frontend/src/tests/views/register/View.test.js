import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount, RouterLinkStub } from "@vue/test-utils";
import RegisterView from "@/views/register/View.vue";
import AuthLayout from "@/components/layout/AuthLayout.vue";
import InputText from "@/components/forms/InputText.vue";
import PasswordInput from "@/components/forms/PasswordInput.vue";
import Button from "@/components/base/Button.vue";
import Logo from "@/components/base/Logo.vue";

const pushMock = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push: pushMock }) }));

const toastInfoMock = vi.hoisted(() => vi.fn());
vi.mock("@/utils/toast", () => ({ toast: { info: toastInfoMock } }));

describe("RegisterView", () => {
  let wrapper;
  const user = ref(null);
  const api = { post: vi.fn(), defaults: { baseURL: "" } };

  beforeEach(() => {
    pushMock.mockClear();
    toastInfoMock.mockClear();
    api.post.mockReset();
    user.value = null;
    localStorage.clear();
    wrapper = mount(RegisterView, {
      global: {
        components: { AuthLayout, InputText, PasswordInput, Button, Logo },
        stubs: { RouterLink: RouterLinkStub },
        provide: { api, user },
      },
    });
  });

  it("shows an error when fields are empty", async () => {
    await wrapper.findComponent(Button).trigger("click");
    await nextTick();
    expect(wrapper.find('[data-testid="auth-error"]').text()).toBe("Please fill in all fields.");
  });

  it("registers and redirects on successful register", async () => {
    const registeredUser = { id: 1, name: "Bob", initials: "BO", email: "bob@test.com" };
    api.post.mockResolvedValue({
      data: { access_token: "tok", refresh_token: "ref-tok", user: registeredUser },
    });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");
    await wrapper.vm.onRegister();
    expect(api.post).toHaveBeenCalledWith("/register", {
      name: "Bob",
      email: "bob@test.com",
      password: "secret",
      initials: "B",
    });
    expect(localStorage.getItem("accessToken")).toBe("tok");
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(registeredUser);
    expect(user.value).toEqual(registeredUser);
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("shows verification nudge toast after successful registration", async () => {
    const registeredUser = { id: 1, name: "Bob", initials: "BO", email: "bob@test.com" };
    api.post.mockResolvedValue({
      data: { access_token: "tok", refresh_token: "ref-tok", user: registeredUser },
    });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");
    await wrapper.vm.onRegister();
    expect(toastInfoMock).toHaveBeenCalledOnce();
    const [message, options] = toastInfoMock.mock.calls[0];
    expect(message).toBe("Check your inbox");
    expect(options.description).toContain("bob@test.com");
    expect(options.duration).toBe(0);
    expect(options.dismissible).toBe(true);
  });

  it("stores accessToken from snake_case backend response key", async () => {
    const registeredUser = { id: 1, name: "Bob", initials: "BO", email: "bob@test.com" };
    api.post.mockResolvedValue({
      data: { access_token: "real-tok", refresh_token: "real-refresh", user: registeredUser },
    });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");
    await wrapper.vm.onRegister();
    expect(localStorage.getItem("accessToken")).toBe("real-tok");
    expect(localStorage.getItem("accessToken")).not.toBe("undefined");
    expect(localStorage.getItem("refreshToken")).toBe("real-refresh");
  });

  it("does not show toast when registration fails", async () => {
    api.post.mockRejectedValue({ response: { data: { detail: "Email already registered." } } });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");
    await wrapper.vm.onRegister();
    expect(toastInfoMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables button and shows loading text during registration", async () => {
    let resolvePost;
    api.post.mockImplementation(
      () =>
        new Promise((r) => {
          resolvePost = r;
        })
    );
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");

    const registerPromise = wrapper.vm.onRegister();
    await nextTick();

    const btn = wrapper.findComponent(Button);
    expect(btn.props("disabled")).toBe(true);
    expect(btn.props("text")).toBe("Creating account...");

    resolvePost({
      data: { access_token: "tok", refresh_token: "ref", user: { id: 1 } },
    });
    await registerPromise;
    await nextTick();

    expect(btn.props("disabled")).toBe(false);
    expect(btn.props("text")).toBe("Create account");
  });

  it("displays the Logo component", () => {
    expect(wrapper.find(".logo").exists()).toBe(true);
  });

  it("shows a Create your account heading", () => {
    const heading = wrapper.find("h1");
    expect(heading.exists()).toBe(true);
    expect(heading.text()).toBe("Create your account");
  });

  it("has a brand panel", () => {
    expect(wrapper.find(".brand-panel").exists()).toBe(true);
  });

  it("wraps the form in a card container", () => {
    expect(wrapper.find(".form-card").exists()).toBe(true);
  });

  it("wraps fields in a form element", () => {
    expect(wrapper.find("form").exists()).toBe(true);
  });

  it("marks error container with role=alert and aria-live", async () => {
    await wrapper.findComponent(Button).trigger("click");
    await nextTick();
    const errorEl = wrapper.find('[data-testid="auth-error"]');
    expect(errorEl.attributes("role")).toBe("alert");
    expect(errorEl.attributes("aria-live")).toBe("assertive");
  });

  it("styles error as an alert container", async () => {
    await wrapper.findComponent(Button).trigger("click");
    await nextTick();
    const errorEl = wrapper.find('[data-testid="auth-error"]');
    expect(errorEl.classes()).toContain("error-alert");
  });

  it("renders login link and navigates on click", async () => {
    const link = wrapper.find('[data-testid="login-link"]');
    expect(link.exists()).toBe(true);
    await link.trigger("click");
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("toggles password visibility", async () => {
    const pwdInput = wrapper.find('[data-testid="password-input"]');
    expect(pwdInput.attributes("type")).toBe("password");
    await wrapper.find('[data-testid="toggle-password"]').trigger("click");
    expect(wrapper.find('[data-testid="password-input"]').attributes("type")).toBe("text");
  });

  it("does not have a confirm password field", () => {
    expect(wrapper.find('[data-testid="confirm-password-input"]').exists()).toBe(false);
  });

  it("marks all fields as required for native browser validation", () => {
    const nameInput = wrapper.find('[data-testid="name-input"]');
    const emailInput = wrapper.find('[data-testid="email-input"]');
    const passwordInput = wrapper.find('[data-testid="password-input"]');

    expect(nameInput.attributes("required")).toBeDefined();
    expect(emailInput.attributes("required")).toBeDefined();
    expect(passwordInput.attributes("required")).toBeDefined();
  });

  it("uses email type on the email field", () => {
    const emailInput = wrapper.find('[data-testid="email-input"]');
    expect(emailInput.attributes("type")).toBe("email");
  });

  it("labels the name field as Display name", () => {
    const nameInput = wrapper.findComponent(InputText);
    expect(nameInput.props("label")).toBe("Display name");
  });

  it("sets type=email on the email input for validation and accessibility", () => {
    const inputTexts = wrapper.findAllComponents(InputText);
    const emailInput = inputTexts.find((c) => c.props("label") === "Email");
    expect(emailInput.props("type")).toBe("email");
  });

  it("auto-derives initials from name and sends with registration", async () => {
    const registeredUser = { id: 1, name: "Jane Doe", initials: "JD", email: "jane@test.com" };
    api.post.mockResolvedValue({
      data: { access_token: "tok", refresh_token: "ref-tok", user: registeredUser },
    });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Jane Doe");
    await inputs[1].setValue("jane@test.com");
    await inputs[2].setValue("secretpw");
    await wrapper.vm.onRegister();
    expect(api.post).toHaveBeenCalledWith("/register", {
      name: "Jane Doe",
      email: "jane@test.com",
      password: "secretpw",
      initials: "JD",
    });
  });

  it("shows Terms of Service and Privacy Policy acknowledgment", () => {
    const legal = wrapper.find(".form-legal");
    expect(legal.exists()).toBe(true);
    expect(legal.text()).toContain("Terms of Service");
    expect(legal.text()).toContain("Privacy Policy");
  });

  it("displays backend error from .detail key (FastAPI convention)", async () => {
    api.post.mockRejectedValue({
      response: { data: { detail: "Email already registered." } },
    });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");
    await wrapper.vm.onRegister();
    expect(wrapper.find('[data-testid="auth-error"]').text()).toBe("Email already registered.");
  });

  it("extracts human-readable message from Pydantic validation error array", async () => {
    api.post.mockRejectedValue({
      response: {
        data: {
          detail: [
            {
              type: "string_too_short",
              loc: ["body", "password"],
              msg: "String should have at least 8 characters",
              input: "asdf",
              ctx: { min_length: 8 },
            },
          ],
        },
      },
    });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("asdf");
    await wrapper.vm.onRegister();
    expect(wrapper.find('[data-testid="auth-error"]').text()).toBe(
      "String should have at least 8 characters"
    );
  });

  it("joins multiple Pydantic validation error messages", async () => {
    api.post.mockRejectedValue({
      response: {
        data: {
          detail: [
            {
              type: "string_too_short",
              loc: ["body", "password"],
              msg: "String should have at least 8 characters",
            },
            {
              type: "value_error",
              loc: ["body", "email"],
              msg: "Value is not a valid email address",
            },
          ],
        },
      },
    });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bad");
    await inputs[2].setValue("asdf");
    await wrapper.vm.onRegister();
    const errorText = wrapper.find('[data-testid="auth-error"]').text();
    expect(errorText).toContain("String should have at least 8 characters");
    expect(errorText).toContain("Value is not a valid email address");
  });
});
