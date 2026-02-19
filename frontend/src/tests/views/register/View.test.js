import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import RegisterView from "@/views/register/View.vue";
import InputText from "@/components/forms/InputText.vue";
import Button from "@/components/base/Button.vue";

const pushMock = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push: pushMock }) }));

const toastInfoMock = vi.hoisted(() => vi.fn());
vi.mock("@/utils/toast", () => ({ toast: { info: toastInfoMock } }));

describe("RegisterView", () => {
  let wrapper;
  const user = ref(null);
  const api = { post: vi.fn() };

  beforeEach(() => {
    pushMock.mockClear();
    toastInfoMock.mockClear();
    api.post.mockReset();
    user.value = null;
    localStorage.clear();
    wrapper = mount(RegisterView, {
      global: {
        components: { InputText, Button },
        provide: { api, user },
      },
    });
  });

  it("shows an error when fields are empty", async () => {
    await wrapper.findComponent(Button).trigger("click");
    await nextTick();
    expect(wrapper.find(".error-message").text()).toBe("Please fill in all fields.");
  });

  it("shows an error when passwords do not match", async () => {
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Alice");
    await inputs[1].setValue("alice@test.com");
    await inputs[2].setValue("pass1");
    await inputs[3].setValue("pass2");
    await wrapper.findComponent(Button).trigger("click");
    await nextTick();
    expect(wrapper.find(".error-message").text()).toBe("Passwords do not match.");
  });

  it("registers and redirects on successful register", async () => {
    const registeredUser = { id: 1, name: "Bob", initials: "BO", email: "bob@test.com" };
    api.post.mockResolvedValue({ data: { accessToken: "tok", user: registeredUser } });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");
    await inputs[3].setValue("secret");
    await wrapper.vm.onRegister();
    expect(api.post).toHaveBeenCalledWith("/register", {
      name: "Bob",
      email: "bob@test.com",
      password: "secret",
    });
    expect(localStorage.getItem("accessToken")).toBe("tok");
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(registeredUser);
    expect(user.value).toEqual(registeredUser);
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("shows verification nudge toast after successful registration", async () => {
    const registeredUser = { id: 1, name: "Bob", initials: "BO", email: "bob@test.com" };
    api.post.mockResolvedValue({ data: { accessToken: "tok", user: registeredUser } });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");
    await inputs[3].setValue("secret");
    await wrapper.vm.onRegister();
    expect(toastInfoMock).toHaveBeenCalledOnce();
    const [message, options] = toastInfoMock.mock.calls[0];
    expect(message).toBe("Check your inbox");
    expect(options.description).toContain("bob@test.com");
    expect(options.duration).toBe(0);
    expect(options.dismissible).toBe(true);
  });

  it("does not show toast when registration fails", async () => {
    api.post.mockRejectedValue({ response: { data: { message: "Email already registered." } } });
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("Bob");
    await inputs[1].setValue("bob@test.com");
    await inputs[2].setValue("secret");
    await inputs[3].setValue("secret");
    await wrapper.vm.onRegister();
    expect(toastInfoMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
