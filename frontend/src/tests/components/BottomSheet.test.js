import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BottomSheet from "@/components/base/BottomSheet.vue";

describe("BottomSheet.vue", () => {
  const mountSheet = (props = {}, slots = {}) =>
    mount(BottomSheet, {
      props: { modelValue: true, title: "Test Sheet", ...props },
      slots: { default: "<p>Sheet content</p>", ...slots },
      attachTo: document.body,
    });

  it("renders slot content when open", () => {
    const wrapper = mountSheet();
    expect(wrapper.html()).toContain("Sheet content");
    wrapper.unmount();
  });

  it("does not render when modelValue is false", () => {
    const wrapper = mountSheet({ modelValue: false });
    expect(wrapper.find(".bottom-sheet-backdrop").exists()).toBe(false);
    wrapper.unmount();
  });

  it("renders the title", () => {
    const wrapper = mountSheet({ title: "Settings" });
    expect(wrapper.text()).toContain("Settings");
    wrapper.unmount();
  });

  it("renders a drag handle", () => {
    const wrapper = mountSheet();
    expect(wrapper.find(".drag-handle").exists()).toBe(true);
    wrapper.unmount();
  });

  it("emits update:modelValue false on backdrop click", async () => {
    const wrapper = mountSheet();
    await wrapper.find(".bottom-sheet-backdrop").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual([false]);
    wrapper.unmount();
  });

  it("does not close when clicking inside the sheet panel", async () => {
    const wrapper = mountSheet();
    await wrapper.find(".bottom-sheet-panel").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeFalsy();
    wrapper.unmount();
  });

  it("emits close event on backdrop click", async () => {
    const wrapper = mountSheet();
    await wrapper.find(".bottom-sheet-backdrop").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
    wrapper.unmount();
  });

  it("applies half height class by default", () => {
    const wrapper = mountSheet();
    expect(wrapper.find(".bottom-sheet-panel.half").exists()).toBe(true);
    wrapper.unmount();
  });

  it("applies full height class when height=full", () => {
    const wrapper = mountSheet({ height: "full" });
    expect(wrapper.find(".bottom-sheet-panel.full").exists()).toBe(true);
    wrapper.unmount();
  });

  it("emits close on Escape key", async () => {
    const wrapper = mountSheet();
    await wrapper.find(".bottom-sheet-backdrop").trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual([false]);
    wrapper.unmount();
  });
});
