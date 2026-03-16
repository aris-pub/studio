import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AuthLayout from "@/components/layout/AuthLayout.vue";
import Logo from "@/components/base/Logo.vue";

const mockApi = {
  post: () => {},
  get: () => {},
  defaults: { baseURL: "" },
};

function mountLayout(slots = {}) {
  return mount(AuthLayout, {
    global: {
      components: { Logo },
      provide: { api: mockApi },
    },
    props: {
      heading: "Test Heading",
      subheading: "Test subheading",
    },
    slots,
  });
}

describe("AuthLayout", () => {
  it("renders brand panel with Logo", () => {
    const wrapper = mountLayout();
    expect(wrapper.find(".brand-panel").exists()).toBe(true);
    expect(wrapper.find(".logo").exists()).toBe(true);
  });

  it("renders heading and subheading", () => {
    const wrapper = mountLayout();
    expect(wrapper.find("h1").text()).toBe("Test Heading");
    expect(wrapper.find(".form-subheading").text()).toBe("Test subheading");
  });

  it("renders default slot content inside form card", () => {
    const wrapper = mountLayout({
      default: '<p class="slot-content">Hello</p>',
    });
    expect(wrapper.find(".form-card .slot-content").exists()).toBe(true);
  });

  it("renders footer slot", () => {
    const wrapper = mountLayout({
      footer: '<p class="footer-content">Footer</p>',
    });
    expect(wrapper.find(".footer-content").exists()).toBe(true);
  });

  it("emits submit event from form", async () => {
    const wrapper = mountLayout();
    await wrapper.find("form").trigger("submit");
    expect(wrapper.emitted("submit")).toHaveLength(1);
  });

  it("renders error alert when error prop is set", () => {
    const wrapper = mount(AuthLayout, {
      global: {
        components: { Logo },
        provide: { api: mockApi },
      },
      props: {
        heading: "Test",
        subheading: "Sub",
        error: "Something went wrong",
      },
    });
    const errorEl = wrapper.find('[data-testid="auth-error"]');
    expect(errorEl.exists()).toBe(true);
    expect(errorEl.text()).toBe("Something went wrong");
    expect(errorEl.attributes("role")).toBe("alert");
    expect(errorEl.attributes("aria-live")).toBe("assertive");
  });

  it("does not render error alert when error prop is empty", () => {
    const wrapper = mountLayout();
    expect(wrapper.find(".error-alert").exists()).toBe(false);
  });

  it("wraps form panel in a main landmark", () => {
    const wrapper = mountLayout();
    const main = wrapper.find("main");
    expect(main.exists()).toBe(true);
    expect(main.classes()).toContain("form-panel");
  });

  it("sets novalidate on the form so JS validation handles errors", () => {
    const wrapper = mountLayout();
    expect(wrapper.find("form").attributes("novalidate")).toBeDefined();
  });
});
