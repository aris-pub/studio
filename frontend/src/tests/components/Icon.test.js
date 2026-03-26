import { describe, it, expect, beforeEach, vi } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";

describe("Icon.vue", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders a Tabler icon component based on the name prop", async () => {
    const FooIcon = defineComponent({
      name: "IconFoo",
      template: '<div data-test="icon-foo"><slot/></div>',
    });
    const AlertTriangleIcon = defineComponent({
      name: "IconAlertTriangle",
      template: '<div data-test="icon-alert-triangle"><slot/></div>',
    });

    vi.doMock("@/components/base/iconRegistry.js", () => ({
      icons: { IconFoo: FooIcon, IconAlertTriangle: AlertTriangleIcon },
      IconAlertTriangle: AlertTriangleIcon,
    }));

    const { default: Icon } = await import("@/components/base/Icon.vue");
    const wrapper = mount(Icon, {
      props: { name: "Foo", iconClass: "custom-class" },
    });
    const icon = wrapper.find('[data-test="icon-foo"]');
    expect(icon.exists()).toBe(true);
    expect(icon.classes()).toContain("tabler-icon");
    expect(icon.classes()).toContain("custom-class");
  });

  it('renders the IconTherefore component when name is "Therefore"', async () => {
    const ThereforeIcon = defineComponent({
      name: "IconTherefore",
      template: '<div data-test="icon-therefore"><slot/></div>',
    });
    const AlertTriangleIcon = defineComponent({
      name: "IconAlertTriangle",
      template: '<div data-test="icon-alert-triangle"><slot/></div>',
    });

    vi.doMock("@/components/base/iconRegistry.js", () => ({
      icons: { IconAlertTriangle: AlertTriangleIcon },
      IconAlertTriangle: AlertTriangleIcon,
    }));
    vi.doMock("@/components/base/IconTherefore.vue", () => ({ default: ThereforeIcon }));

    const { default: Icon } = await import("@/components/base/Icon.vue");
    const wrapper = mount(Icon, {
      props: { name: "Therefore" },
    });
    const icon = wrapper.find('[data-test="icon-therefore"]');
    expect(icon.exists()).toBe(true);
    expect(icon.classes()).toContain("tabler-icon");
  });
});
