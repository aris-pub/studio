import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

import SelectBox from "@/components/forms/SelectBox.vue";

vi.mock("@floating-ui/vue", () => ({
  useFloating: () => ({ floatingStyles: { value: {} } }),
  autoUpdate: vi.fn(),
  offset: vi.fn(),
  flip: vi.fn(),
  shift: vi.fn(),
}));

function mountSelect(props = {}, attrs = {}) {
  return mount(SelectBox, {
    props: { modelValue: "a", options: ["a", "b"], ...props },
    attrs,
    attachTo: document.body,
  });
}

describe("SelectBox.vue", () => {
  it("renders current label and trigger in row direction with attributes", async () => {
    const wrapper = mountSelect({
      modelValue: "b",
      direction: "row",
      options: [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
      ],
    });

    expect(wrapper.get(".select-box").classes()).toContain("row");
    expect(wrapper.get(".current-label").text()).toBe("Option B");

    await wrapper.get(".select-control").trigger("click");
    const items = wrapper.findAll(".select-option");
    expect(items).toHaveLength(2);
    expect(items[0].text()).toBe("Option A");
    expect(items[1].text()).toBe("Option B");
  });

  it("passes through attrs to the control button", () => {
    const wrapper = mountSelect({}, { disabled: true });
    expect(wrapper.get(".select-control").attributes("disabled")).toBeDefined();
  });

  it("renders current label in column direction", async () => {
    const wrapper = mountSelect({
      modelValue: "x",
      direction: "column",
      options: [{ value: "x", label: "X" }],
    });

    expect(wrapper.get(".select-box").classes()).toContain("column");
    expect(wrapper.get(".current-label").text()).toBe("X");

    await wrapper.get(".select-control").trigger("click");
    expect(wrapper.findAll(".select-option")).toHaveLength(1);
    expect(wrapper.findAll(".select-option")[0].text()).toBe("X");
  });

  it("emits update:modelValue when option clicked", async () => {
    const wrapper = mountSelect({
      modelValue: "init",
      options: [
        { value: "init", label: "Initial" },
        { value: "new", label: "New" },
      ],
    });

    await wrapper.get(".select-control").trigger("click");
    await wrapper.findAll(".select-option")[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual(["new"]);
  });

  it("supports primitive string options", async () => {
    const wrapper = mountSelect({ modelValue: "foo", options: ["foo", "bar"] });
    expect(wrapper.get(".current-label").text()).toBe("foo");

    await wrapper.get(".select-control").trigger("click");
    const items = wrapper.findAll(".select-option");
    expect(items).toHaveLength(2);
    expect(items[0].text()).toBe("foo");
    expect(items[1].text()).toBe("bar");
  });

  it("renders a label element when label prop is provided", () => {
    const wrapper = mountSelect({ label: "Choose one" });
    const label = wrapper.find("label.select-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe("Choose one");
  });

  it("does not render a label element when label prop is empty", () => {
    const wrapper = mountSelect();
    expect(wrapper.find("label.select-label").exists()).toBe(false);
  });

  it("opens dropdown on control click and closes on second click", async () => {
    const wrapper = mountSelect();
    expect(wrapper.find(".select-listbox").exists()).toBe(false);

    await wrapper.get(".select-control").trigger("click");
    expect(wrapper.find(".select-listbox").exists()).toBe(true);

    await wrapper.get(".select-control").trigger("click");
    await nextTick();
    expect(wrapper.find(".select-listbox").exists()).toBe(false);
  });

  it("closes dropdown after selecting an option", async () => {
    const wrapper = mountSelect();
    await wrapper.get(".select-control").trigger("click");
    expect(wrapper.find(".select-listbox").exists()).toBe(true);

    await wrapper.findAll(".select-option")[1].trigger("click");
    await nextTick();
    expect(wrapper.find(".select-listbox").exists()).toBe(false);
  });

  it("marks the active option with active class", async () => {
    const wrapper = mountSelect({
      modelValue: "b",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });

    await wrapper.get(".select-control").trigger("click");
    const items = wrapper.findAll(".select-option");
    expect(items[0].classes()).not.toContain("active");
    expect(items[1].classes()).toContain("active");
  });

  it("rotates chevron when open", async () => {
    const wrapper = mountSelect();
    expect(wrapper.get(".select-chevron").classes()).not.toContain("rotated");

    await wrapper.get(".select-control").trigger("click");
    expect(wrapper.get(".select-chevron").classes()).toContain("rotated");
  });

  it("displays empty label when modelValue doesn't match any option", () => {
    const wrapper = mountSelect({ modelValue: "nonexistent" });
    expect(wrapper.get(".current-label").text()).toBe("");
  });
});
