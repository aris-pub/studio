import { describe, it, expect, vi } from "vitest";
import { mount, shallowMount } from "@vue/test-utils";
import { defineComponent } from "vue";

import SearchBar from "@/components/utility/SearchBar.vue";

// Stub child components
const IconSearchStub = defineComponent({ name: "IconSearch", template: "<div />" });
const ButtonStub = defineComponent({
  name: "Button",
  props: ["kind", "icon", "disabled"],
  emits: ["click"],
  template: "<div @click=\"$emit('click', $event)\" />",
});

describe("SearchBar.vue", () => {
  it("uses default placeholder text", () => {
    const wrapper = shallowMount(SearchBar, {
      global: { stubs: { IconSearch: IconSearchStub } },
    });
    const input = wrapper.find("input");
    expect(input.attributes("placeholder")).toBe("Search...");
  });

  it("allows customizing placeholder text via prop", () => {
    const placeholder = "Find me";
    const wrapper = shallowMount(SearchBar, {
      props: { placeholder: placeholder },
      global: { stubs: { IconSearch: IconSearchStub } },
    });
    expect(wrapper.find("input").attributes("placeholder")).toBe(placeholder);
  });

  it("focuses input when clicking the wrapper", async () => {
    const wrapper = mount(SearchBar, {
      global: { stubs: { IconSearch: IconSearchStub } },
    });
    const input = wrapper.find("input");
    input.element.focus = vi.fn();
    await wrapper.find(".s-wrapper").trigger("click");
    expect(input.element.focus).toHaveBeenCalled();
  });

  it("emits submit event with query when pressing enter first time", async () => {
    const wrapper = mount(SearchBar, {
      global: { stubs: { IconSearch: IconSearchStub } },
    });
    const input = wrapper.find("input");
    await input.setValue("hello");
    await input.trigger("keyup.enter");
    expect(wrapper.emitted().submit).toBeTruthy();
    expect(wrapper.emitted().submit[0]).toEqual(["hello"]);
  });

  it("emits next and prev events on subsequent enter key presses", async () => {
    const wrapper = mount(SearchBar, {
      global: { stubs: { IconSearch: IconSearchStub } },
    });
    const input = wrapper.find("input");
    await input.setValue("world");
    // first enter => submit
    await input.trigger("keyup.enter");
    // second enter without shift => next
    await input.trigger("keyup.enter", { shiftKey: false });
    // third enter with shift => prev
    await input.trigger("keyup.enter", { shiftKey: true });
    expect(wrapper.emitted().next).toBeTruthy();
    expect(wrapper.emitted().prev).toBeTruthy();
    expect(wrapper.emitted().next[0]).toEqual(["world"]);
    expect(wrapper.emitted().prev[0]).toEqual(["world"]);
  });

  it("emits cancel and clears input when pressing escape after search", async () => {
    const wrapper = mount(SearchBar, {
      global: { stubs: { IconSearch: IconSearchStub } },
    });
    const input = wrapper.find("input");
    await input.setValue("test");
    await input.trigger("keyup.enter");
    await input.trigger("keyup.escape");
    expect(wrapper.emitted().cancel).toBeTruthy();
    expect(input.element.value).toBe("");
  });

  it("emits cancel when pressing escape and not searching", async () => {
    const wrapper = mount(SearchBar, {
      global: { stubs: { IconSearch: IconSearchStub } },
    });
    const input = wrapper.find("input");
    await input.trigger("keyup.escape");
    expect(wrapper.emitted().cancel).toBeTruthy();
  });

  it("renders navigation buttons when withButtons is true and emits events on click", async () => {
    const wrapper = mount(SearchBar, {
      props: { withButtons: true, buttonsDisabled: false },
      global: { stubs: { IconSearch: IconSearchStub, Button: ButtonStub } },
    });
    const buttons = wrapper.findAllComponents(ButtonStub);
    expect(buttons).toHaveLength(2);
    await buttons[0].trigger("click");
    await buttons[1].trigger("click");
    expect(wrapper.emitted().next).toBeTruthy();
    expect(wrapper.emitted().prev).toBeTruthy();
  });

  it("disables navigation buttons based on buttonsDisabled prop", () => {
    const wrapper = mount(SearchBar, {
      props: { withButtons: true, buttonsDisabled: true },
      global: { stubs: { IconSearch: IconSearchStub, Button: ButtonStub } },
    });
    const buttons = wrapper.findAllComponents(ButtonStub);
    expect(buttons[0].props("disabled")).toBe(true);
    expect(buttons[1].props("disabled")).toBe(true);
  });

  it("renders custom buttons slot when provided", () => {
    const wrapper = shallowMount(SearchBar, {
      global: { stubs: { IconSearch: IconSearchStub } },
      slots: { buttons: '<div class="custom">Custom</div>' },
    });
    const slot = wrapper.find(".buttons .custom");
    expect(slot.exists()).toBe(true);
    expect(slot.text()).toBe("Custom");
  });

  it("exposes focusInput method to parent", () => {
    const wrapper = mount(SearchBar, {
      global: { stubs: { IconSearch: IconSearchStub } },
    });
    const input = wrapper.find("input");
    input.element.focus = vi.fn();
    wrapper.vm.focusInput();
    expect(input.element.focus).toHaveBeenCalled();
  });
});
