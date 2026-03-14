import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PasswordInput from "@/components/forms/PasswordInput.vue";
import InputText from "@/components/forms/InputText.vue";

describe("PasswordInput", () => {
  function mountInput(props = {}) {
    return mount(PasswordInput, {
      global: { components: { InputText } },
      props: { modelValue: "", label: "Password", ...props },
    });
  }

  it("renders an InputText with type password by default", () => {
    const wrapper = mountInput();
    const input = wrapper.findComponent(InputText);
    expect(input.exists()).toBe(true);
    expect(input.props("type")).toBe("password");
  });

  it("toggles input type between password and text", async () => {
    const wrapper = mountInput();
    await wrapper.find('[data-testid="toggle-password"]').trigger("click");
    expect(wrapper.findComponent(InputText).props("type")).toBe("text");
    await wrapper.find('[data-testid="toggle-password"]').trigger("click");
    expect(wrapper.findComponent(InputText).props("type")).toBe("password");
  });

  it("shows 'Show' text when password is hidden", () => {
    const wrapper = mountInput();
    expect(wrapper.find('[data-testid="toggle-password"]').text()).toBe("Show");
  });

  it("shows 'Hide' text when password is visible", async () => {
    const wrapper = mountInput();
    await wrapper.find('[data-testid="toggle-password"]').trigger("click");
    expect(wrapper.find('[data-testid="toggle-password"]').text()).toBe("Hide");
  });

  it("passes label prop through to InputText", () => {
    const wrapper = mountInput({ label: "Secret Key" });
    expect(wrapper.findComponent(InputText).props("label")).toBe("Secret Key");
  });

  it("passes through additional attrs to InputText", () => {
    const wrapper = mount(PasswordInput, {
      global: { components: { InputText } },
      props: { modelValue: "", label: "Password" },
      attrs: { "data-testid": "password-input", required: "" },
    });
    const input = wrapper.find("input");
    expect(input.attributes("data-testid")).toBe("password-input");
  });

  it("emits update:modelValue when input changes", async () => {
    const wrapper = mountInput();
    await wrapper.find("input").setValue("secret123");
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual(["secret123"]);
  });

  it("renders toggle as type=button to prevent form submission", () => {
    const wrapper = mountInput();
    expect(wrapper.find('[data-testid="toggle-password"]').attributes("type")).toBe("button");
  });
});
