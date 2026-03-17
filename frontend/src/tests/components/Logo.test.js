import { mount } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import Logo from "@/components/base/Logo.vue";

const mockApi = {
  defaults: {
    baseURL: import.meta.env.VITE_API_BASE_URL,
  },
};

describe("Logo.vue", () => {
  const createWrapper = (props = {}) => {
    return mount(Logo, {
      props,
      global: {
        provide: {
          api: mockApi,
        },
      },
    });
  };

  it("renders small logo by default", () => {
    const wrapper = createWrapper();
    const logoDiv = wrapper.find(".logo");
    const img = wrapper.find("img");

    expect(logoDiv.exists()).toBe(true);
    expect(logoDiv.classes()).toContain("logo");
    expect(logoDiv.classes()).toContain("logo--small");

    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe(
      `${mockApi.defaults.baseURL}/brand/logos/studio/studio-logo-64.svg`
    );
    expect(img.attributes("alt")).toBe("RSM Studio logo");
    expect(img.classes()).toContain("logo__mark");
  });

  it("renders full logo when type is full", () => {
    const wrapper = createWrapper({ type: "full" });
    const logoDiv = wrapper.find(".logo");
    const img = wrapper.find("img");
    const text = wrapper.find(".logo__text");

    expect(logoDiv.classes()).toContain("logo--full");
    expect(img.attributes("src")).toBe(
      `${mockApi.defaults.baseURL}/brand/logos/studio/studio-logo-64.svg`
    );
    expect(text.exists()).toBe(true);
    expect(text.text()).toBe("S");
  });

  it("renders gray logo when type is gray", () => {
    const wrapper = createWrapper({ type: "gray" });
    const logoDiv = wrapper.find(".logo");
    const img = wrapper.find("img");

    expect(logoDiv.classes()).toContain("logo--gray");
    expect(img.attributes("src")).toBe(
      `${mockApi.defaults.baseURL}/brand/logos/studio/studio-logo-64.svg`
    );
  });

  it("accepts custom alt text", () => {
    const wrapper = createWrapper({ alt: "Custom alt text" });
    const img = wrapper.find("img");

    expect(img.attributes("alt")).toBe("Custom alt text");
  });

  it("accepts custom CSS classes", () => {
    const wrapper = createWrapper({ class: "custom-class" });
    const logoDiv = wrapper.find(".logo");

    expect(logoDiv.classes()).toContain("custom-class");
  });
});
