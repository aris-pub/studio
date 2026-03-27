import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import ColorPicker from "@/components/forms/ColorPicker.vue";

describe("ColorPicker.vue", () => {
  const colors = { red: "#f00", green: "#0f0", blue: "#00f" };

  it("renders a swatch for each color with correct classes, styles, and labels", () => {
    const wrapper = mount(ColorPicker, { props: { colors } });
    const swatches = wrapper.findAll(".swatch");
    expect(swatches).toHaveLength(Object.keys(colors).length);
    swatches.forEach((swatch, idx) => {
      const name = Object.keys(colors)[idx];
      expect(swatch.classes()).toContain(name);
      const circle = swatch.find(".circle");
      expect(circle.exists()).toBe(true);
      expect(circle.attributes("style")).toMatch(/background-color:/);
      expect(circle.element.style.backgroundColor).toBeTruthy();
      const label = swatch.find("span.label");
      expect(label.text()).toBe(name);
    });
  });

  it("emits change and toggles active class on click", async () => {
    const wrapper = mount(ColorPicker, { props: { colors } });
    const swatches = wrapper.findAll(".swatch");

    await swatches[1].trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("change")?.[0]).toEqual(["green"]);
    expect(swatches[1].classes()).toContain("active");
    expect(swatches[0].classes()).not.toContain("active");

    await swatches[2].trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("change")?.[1]).toEqual(["blue"]);
    expect(swatches[1].classes()).not.toContain("active");
    expect(swatches[2].classes()).toContain("active");
  });

  it("emits change and toggles active class on keyboard Enter/Space", async () => {
    const wrapper = mount(ColorPicker, { props: { colors } });
    const swatches = wrapper.findAll(".swatch");

    await swatches[0].trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("change")?.[0]).toEqual(["red"]);
    expect(wrapper.findAll(".swatch")[0].classes()).toContain("active");

    await swatches[2].trigger("keydown", { key: " " });
    expect(wrapper.emitted("change")?.[1]).toEqual(["blue"]);
    expect(wrapper.findAll(".swatch")[2].classes()).toContain("active");
  });

  it("updates active swatch when parent changes defaultActive prop", async () => {
    const wrapper = mount(ColorPicker, {
      props: { colors, defaultActive: "red" },
    });

    expect(wrapper.findAll(".swatch")[0].classes()).toContain("active");

    await wrapper.setProps({ defaultActive: "blue" });
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll(".swatch")[0].classes()).not.toContain("active");
    expect(wrapper.findAll(".swatch")[2].classes()).toContain("active");
  });

  it("clears all active states when defaultActive is reset to empty", async () => {
    const wrapper = mount(ColorPicker, {
      props: { colors, defaultActive: "green" },
    });

    expect(wrapper.findAll(".swatch")[1].classes()).toContain("active");

    await wrapper.setProps({ defaultActive: "" });
    await wrapper.vm.$nextTick();

    wrapper.findAll(".swatch").forEach((swatch) => {
      expect(swatch.classes()).not.toContain("active");
    });
  });

  describe("ARIA radiogroup semantics", () => {
    it("has role=radiogroup on the container with aria-label", () => {
      const wrapper = mount(ColorPicker, { props: { colors } });
      const container = wrapper.find('[role="radiogroup"]');
      expect(container.exists()).toBe(true);
      expect(container.attributes("aria-label")).toBe("Color");
    });

    it("accepts custom aria-label via groupLabel prop", () => {
      const wrapper = mount(ColorPicker, {
        props: { colors, groupLabel: "Highlight color" },
      });
      const container = wrapper.find('[role="radiogroup"]');
      expect(container.attributes("aria-label")).toBe("Highlight color");
    });

    it("sets role=radio and aria-checked on each swatch", () => {
      const wrapper = mount(ColorPicker, {
        props: { colors, defaultActive: "green" },
      });
      const radios = wrapper.findAll('[role="radio"]');
      expect(radios).toHaveLength(3);

      expect(radios[0].attributes("aria-checked")).toBe("false");
      expect(radios[1].attributes("aria-checked")).toBe("true");
      expect(radios[2].attributes("aria-checked")).toBe("false");
    });

    it("sets aria-label on each radio with the color name", () => {
      const wrapper = mount(ColorPicker, { props: { colors } });
      const radios = wrapper.findAll('[role="radio"]');
      expect(radios[0].attributes("aria-label")).toBe("red");
      expect(radios[1].attributes("aria-label")).toBe("green");
      expect(radios[2].attributes("aria-label")).toBe("blue");
    });

    it("uses roving tabindex — only active swatch is tabbable", () => {
      const wrapper = mount(ColorPicker, {
        props: { colors, defaultActive: "green" },
      });
      const radios = wrapper.findAll('[role="radio"]');
      expect(radios[0].attributes("tabindex")).toBe("-1");
      expect(radios[1].attributes("tabindex")).toBe("0");
      expect(radios[2].attributes("tabindex")).toBe("-1");
    });

    it("makes first swatch tabbable when no defaultActive is set", () => {
      const wrapper = mount(ColorPicker, { props: { colors } });
      const radios = wrapper.findAll('[role="radio"]');
      expect(radios[0].attributes("tabindex")).toBe("0");
      expect(radios[1].attributes("tabindex")).toBe("-1");
      expect(radios[2].attributes("tabindex")).toBe("-1");
    });

    it("updates aria-checked on click", async () => {
      const wrapper = mount(ColorPicker, { props: { colors } });
      const swatches = wrapper.findAll(".swatch");

      await swatches[2].trigger("click");
      await wrapper.vm.$nextTick();

      const radios = wrapper.findAll('[role="radio"]');
      expect(radios[0].attributes("aria-checked")).toBe("false");
      expect(radios[2].attributes("aria-checked")).toBe("true");
    });

    it("navigates with arrow keys (ArrowRight/ArrowDown moves forward, wraps)", async () => {
      const wrapper = mount(ColorPicker, {
        props: { colors, defaultActive: "red" },
        attachTo: document.body,
      });

      const container = wrapper.find('[role="radiogroup"]');
      await container.trigger("keydown", { key: "ArrowRight" });
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("change")?.[0]).toEqual(["green"]);
      const radios = wrapper.findAll('[role="radio"]');
      expect(radios[1].attributes("aria-checked")).toBe("true");
      expect(radios[1].attributes("tabindex")).toBe("0");
      expect(radios[1].element).toBe(document.activeElement);

      wrapper.unmount();
    });

    it("navigates with ArrowLeft/ArrowUp (wraps around)", async () => {
      const wrapper = mount(ColorPicker, {
        props: { colors, defaultActive: "red" },
        attachTo: document.body,
      });

      const container = wrapper.find('[role="radiogroup"]');
      await container.trigger("keydown", { key: "ArrowLeft" });
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("change")?.[0]).toEqual(["blue"]);
      const radios = wrapper.findAll('[role="radio"]');
      expect(radios[2].attributes("aria-checked")).toBe("true");
      expect(radios[2].element).toBe(document.activeElement);

      wrapper.unmount();
    });

    it("moves focus through multiple arrow presses sequentially", async () => {
      const wrapper = mount(ColorPicker, {
        props: { colors, defaultActive: "red" },
        attachTo: document.body,
      });

      const container = wrapper.find('[role="radiogroup"]');

      await container.trigger("keydown", { key: "ArrowRight" });
      await wrapper.vm.$nextTick();
      expect(wrapper.findAll('[role="radio"]')[1].element).toBe(document.activeElement);

      await container.trigger("keydown", { key: "ArrowRight" });
      await wrapper.vm.$nextTick();
      expect(wrapper.findAll('[role="radio"]')[2].element).toBe(document.activeElement);

      // Wraps to first
      await container.trigger("keydown", { key: "ArrowRight" });
      await wrapper.vm.$nextTick();
      expect(wrapper.findAll('[role="radio"]')[0].element).toBe(document.activeElement);

      wrapper.unmount();
    });
  });
});
