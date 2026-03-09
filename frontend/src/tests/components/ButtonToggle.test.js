import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import ButtonToggle from "@/components/base/ButtonToggle.vue";

describe("ButtonToggle.vue", () => {
  it("renders slot content and toggles active class and emits events on click", async () => {
    const wrapper = mount(ButtonToggle, {
      props: { text: "Toggle", size: "sm" },
      global: { stubs: ["Icon"] },
      slots: { default: "<span>inner</span>" },
    });
    const btn = wrapper.get("button");
    expect(btn.classes()).toContain("btn-toggle");
    expect(btn.classes()).toContain("btn-sm");
    expect(btn.html()).toContain("inner");

    // initial state: not active
    expect(btn.classes()).not.toContain("active");
    // click to activate
    await btn.trigger("click");
    await nextTick();
    expect(btn.classes()).toContain("active");
    expect(wrapper.emitted("on")).toBeTruthy();

    // click to deactivate
    await btn.trigger("click");
    await nextTick();
    expect(btn.classes()).not.toContain("active");
    expect(wrapper.emitted("off")).toBeTruthy();
  });

  it("renders text and icon props when provided", () => {
    const wrapper = mount(ButtonToggle, {
      props: { text: "Press", icon: "dots", size: "lg" },
      global: { stubs: ["Icon"] },
    });
    const span = wrapper.get("span.btn-text");
    expect(span.text()).toBe("Press");
    expect(wrapper.findComponent({ name: "Icon" }).exists()).toBe(true);
    expect(wrapper.get("button").classes()).toContain("btn-lg");
  });
});
