import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

import SelectBox from "@/components/forms/SelectBox.vue";

describe("SelectBox.vue", () => {
  const TeleportStub = { props: ["to"], template: "<div><slot/></div>" };
  const ContextMenuStub = {
    props: ["variant", "placement"],
    template: `
      <div class="cm-wrapper">
        <slot name="trigger" :toggle="() => {}"></slot>
        <div class="cm-menu"><slot/></div>
      </div>
    `,
  };
  const ButtonToggleStub = {
    props: ["icon"],
    template: '<button class="cm-btn" v-bind="$attrs">Toggle</button>',
  };
  const itemStub = {
    props: { caption: { type: String } },
    template: '<button class="item"><span class="cmi-caption">{{ caption }}</span></button>',
  };
  it("renders current label and trigger button in row direction with options and attributes", async () => {
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
      global: {
        stubs: {
          Teleport: TeleportStub,
          ContextMenu: ContextMenuStub,
          ButtonToggle: ButtonToggleStub,
          ContextMenuItem: itemStub,
        },
      },
    });
    const container = wrapper.get(".select-box");
    expect(container.classes()).toContain("row");
    const currentLabel = wrapper.get(".current-label");
    expect(currentLabel.text()).toBe("Option B");
    await nextTick();
    const trigger = wrapper.get(".cm-btn");
    expect(trigger.attributes("disabled")).toBeDefined();

    await trigger.trigger("click");
    await nextTick();
    const items = wrapper.findAll(".cm-menu .item .cmi-caption");
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
      global: {
        stubs: {
          Teleport: TeleportStub,
          ContextMenu: ContextMenuStub,
          ButtonToggle: ButtonToggleStub,
          ContextMenuItem: itemStub,
        },
      },
    });
    const container = wrapper.get(".select-box");
    expect(container.classes()).toContain("column");
    const currentLabel = wrapper.get(".current-label");
    expect(currentLabel.text()).toBe("X");
    await nextTick();

    const trigger = wrapper.get(".cm-btn");
    await trigger.trigger("click");
    await nextTick();
    const items = wrapper.findAll(".cm-menu .item .cmi-caption");
    expect(items).toHaveLength(1);
    expect(items[0].text()).toBe("X");
  });

  it("emits update:modelValue when menu item clicked", async () => {
    const wrapper = mount(SelectBox, {
      props: {
        modelValue: "init",
        options: [
          { value: "init", label: "Initial" },
          { value: "new", label: "New" },
        ],
      },
      global: {
        stubs: {
          Teleport: TeleportStub,
          ContextMenu: ContextMenuStub,
          ButtonToggle: ButtonToggleStub,
          ContextMenuItem: itemStub,
        },
      },
    });
    const trigger = wrapper.get(".cm-btn");
    await trigger.trigger("click");
    await nextTick();
    const items = wrapper.findAll(".cm-menu .item");
    await items[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual(["new"]);
  });

  it("supports primitive string options", async () => {
    const wrapper = mount(SelectBox, {
      props: { modelValue: "foo", options: ["foo", "bar"] },
      global: {
        stubs: {
          Teleport: TeleportStub,
          ContextMenu: ContextMenuStub,
          ButtonToggle: ButtonToggleStub,
          ContextMenuItem: itemStub,
        },
      },
    });
    await nextTick();
    const currentLabel = wrapper.get(".current-label");
    expect(currentLabel.text()).toBe("foo");

    const trigger = wrapper.get(".cm-btn");
    await trigger.trigger("click");
    await nextTick();
    const items = wrapper.findAll(".cm-menu .item .cmi-caption");
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
      global: {
        stubs: {
          Teleport: TeleportStub,
          ContextMenu: ContextMenuStub,
          ButtonToggle: ButtonToggleStub,
          ContextMenuItem: itemStub,
        },
      },
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
      global: {
        stubs: {
          Teleport: TeleportStub,
          ContextMenu: ContextMenuStub,
          ButtonToggle: ButtonToggleStub,
          ContextMenuItem: itemStub,
        },
      },
    });
    const label = wrapper.find("label.select-label");
    expect(label.exists()).toBe(false);
  });
});
