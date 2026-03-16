import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

import SelectBox from "@/components/forms/SelectBox.vue";

describe("SelectBox.vue", () => {
  const TeleportStub = { props: ["to"], template: "<div><slot/></div>" };
  const ContextMenuStub = {
    props: ["variant", "placement", "menuClass"],
    template: `
      <div class="cm-wrapper">
        <slot name="trigger" :toggle="toggle" :is-open="false"></slot>
        <div class="cm-menu"><slot/></div>
      </div>
    `,
    setup(_, { expose }) {
      const toggle = () => {};
      expose({ toggle });
      return { toggle };
    },
  };

  const stubs = {
    Teleport: TeleportStub,
    ContextMenu: ContextMenuStub,
  };

  it("renders current label and trigger in row direction with options and attributes", async () => {
    const wrapper = mount(SelectBox, {
      props: {
        modelValue: "b",
        direction: "row",
        options: [
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ],
      },
      attrs: { disabled: true },
      global: { stubs },
    });

    const container = wrapper.get(".select-box");
    expect(container.classes()).toContain("row");

    const currentLabel = wrapper.get(".current-label");
    expect(currentLabel.text()).toBe("Option B");

    const trigger = wrapper.get(".select-control");
    expect(trigger.attributes("disabled")).toBeDefined();

    const items = wrapper.findAll(".select-option");
    expect(items).toHaveLength(2);
    expect(items[0].text()).toBe("Option A");
    expect(items[1].text()).toBe("Option B");
  });

  it("renders current label in column direction and shows one option", async () => {
    const wrapper = mount(SelectBox, {
      props: {
        modelValue: "x",
        direction: "column",
        options: [{ value: "x", label: "X" }],
      },
      global: { stubs },
    });

    const container = wrapper.get(".select-box");
    expect(container.classes()).toContain("column");

    const currentLabel = wrapper.get(".current-label");
    expect(currentLabel.text()).toBe("X");

    const items = wrapper.findAll(".select-option");
    expect(items).toHaveLength(1);
    expect(items[0].text()).toBe("X");
  });

  it("emits update:modelValue when option clicked", async () => {
    const wrapper = mount(SelectBox, {
      props: {
        modelValue: "init",
        options: [
          { value: "init", label: "Initial" },
          { value: "new", label: "New" },
        ],
      },
      global: { stubs },
    });

    const items = wrapper.findAll(".select-option");
    await items[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual(["new"]);
  });

  it("supports primitive string options", async () => {
    const wrapper = mount(SelectBox, {
      props: { modelValue: "foo", options: ["foo", "bar"] },
      global: { stubs },
    });

    const currentLabel = wrapper.get(".current-label");
    expect(currentLabel.text()).toBe("foo");

    const items = wrapper.findAll(".select-option");
    expect(items).toHaveLength(2);
    expect(items[0].text()).toBe("foo");
    expect(items[1].text()).toBe("bar");
  });

  it("renders a label element when label prop is provided", () => {
    const wrapper = mount(SelectBox, {
      props: {
        modelValue: "a",
        options: ["a", "b"],
        label: "Choose one",
      },
      global: { stubs },
    });

    const label = wrapper.find("label.select-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe("Choose one");
  });

  it("does not render a label element when label prop is empty", () => {
    const wrapper = mount(SelectBox, {
      props: {
        modelValue: "a",
        options: ["a", "b"],
      },
      global: { stubs },
    });

    const label = wrapper.find("label.select-label");
    expect(label.exists()).toBe(false);
  });

  it("clicking the entire control area triggers the menu", async () => {
    let toggleCalled = false;
    const ContextMenuWithToggle = {
      props: ["variant", "placement", "menuClass"],
      template: `
        <div class="cm-wrapper">
          <slot name="trigger" :toggle="toggle" :is-open="false"></slot>
          <div class="cm-menu"><slot/></div>
        </div>
      `,
      setup() {
        const toggle = () => { toggleCalled = true; };
        return { toggle };
      },
    };

    const wrapper = mount(SelectBox, {
      props: {
        modelValue: "a",
        options: ["a", "b"],
      },
      global: {
        stubs: {
          Teleport: TeleportStub,
          ContextMenu: ContextMenuWithToggle,
        },
      },
    });

    await wrapper.get(".select-control").trigger("click");
    expect(toggleCalled).toBe(true);
  });

  it("marks the active option with active class", () => {
    const wrapper = mount(SelectBox, {
      props: {
        modelValue: "b",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
      global: { stubs },
    });

    const items = wrapper.findAll(".select-option");
    expect(items[0].classes()).not.toContain("active");
    expect(items[1].classes()).toContain("active");
  });
});
