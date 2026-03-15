import { describe, it, expect } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import NotFoundView from "@/views/notfound/View.vue";
import Button from "@/components/base/Button.vue";

function mountView() {
  return mount(NotFoundView, {
    global: {
      components: { Button },
      stubs: { RouterLink: RouterLinkStub },
    },
    attachTo: document.body,
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

  it("uses a <main> landmark as root element", () => {
    const wrapper = mountView();
    expect(wrapper.element.tagName).toBe("MAIN");
  });

  it("sets document title to indicate error page", () => {
    mountView();
    expect(document.title).toContain("Page not found");
  });

  it("moves focus to the heading on mount", async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();
    const h1 = wrapper.find("h1").element;
    expect(document.activeElement).toBe(h1);
  });

  it("marks the heading with role=alert for screen reader announcement", () => {
    const wrapper = mountView();
    const heading = wrapper.find("h1");
    expect(heading.attributes("role")).toBe("alert");
  });
});
