import { describe, it, expect } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import NotFoundView from "@/views/notfound/View.vue";
import Button from "@/components/base/Button.vue";
import Logo from "@/components/base/Logo.vue";

const mockApi = {
  post: () => {},
  get: () => {},
  defaults: { baseURL: "" },
};

function mountView() {
  return mount(NotFoundView, {
    global: {
      components: { Button, Logo },
      provide: { api: mockApi },
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

describe("NotFoundView", () => {
  it("renders the 404 heading and message", () => {
    const wrapper = mountView();
    expect(wrapper.find("h1.text-h1").text()).toBe("404");
    expect(wrapper.find("h2.text-h2").text()).toBe("Page not found");
  });

  it("renders a button linking back to home", () => {
    const wrapper = mountView();
    const button = wrapper.findComponent(Button);
    expect(button.exists()).toBe(true);
    const link = button.findComponent(RouterLinkStub);
    expect(link.props("to")).toBe("/");
    expect(link.text()).toBe("Go back home");
  });

  it("renders the Logo component", () => {
    const wrapper = mountView();
    expect(wrapper.findComponent(Logo).exists()).toBe(true);
  });

  it("renders the logo inside a link to home", () => {
    const wrapper = mountView();
    const brand = wrapper.find(".brand");
    expect(brand.exists()).toBe(true);
    const link = brand.findComponent(RouterLinkStub);
    expect(link.exists()).toBe(true);
    expect(link.props("to")).toBe("/");
  });
});
