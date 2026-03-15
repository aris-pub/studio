import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import NotFoundView from "@/views/notfound/View.vue";
import Button from "@/components/base/Button.vue";

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function mountView() {
  return mount(NotFoundView, {
    global: {
      components: { Button },
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

  it("renders a primary button with 'Go back home' text", () => {
    const wrapper = mountView();
    const button = wrapper.findComponent(Button);
    expect(button.exists()).toBe(true);
    expect(button.props("kind")).toBe("primary");
    expect(button.props("text")).toBe("Go back home");
  });

  it("navigates to home on button click", async () => {
    mockPush.mockClear();
    const wrapper = mountView();
    await wrapper.findComponent(Button).trigger("click");
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("does not nest interactive elements (a inside button)", () => {
    const wrapper = mountView();
    const button = wrapper.find("button");
    expect(button.find("a").exists()).toBe(false);
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
