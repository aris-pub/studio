import { describe, it, expect } from "vitest";
import { mount, shallowMount } from "@vue/test-utils";
import { defineComponent } from "vue";

import FileSettings from "@/components/manuscript/FileSettings.vue";

// Stub complex child components (keep simple layout components real)
const ThemeSwitchStub = defineComponent({
  name: "ThemeSwitch",
  template: '<div class="theme-switch"/>',
});
const ColorPickerStub = defineComponent({
  name: "ColorPicker",
  props: ["colors"],
  emits: ["change"],
  template: "<div/>",
});
const SegmentedControlStub = defineComponent({
  name: "SegmentedControl",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<div/>",
});

describe("FileSettings.vue", () => {
  const mountFileSettings = (settings, header = true) => {
    return mount(FileSettings, {
      props: { modelValue: settings, header },
      global: {
        provide: {
          mobileMode: false,
        },
        stubs: {
          // Keep layout components simple but functional
          Pane: {
            name: "Pane",
            template:
              '<div class="pane"><div v-if="$slots.header" class="pane-header"><slot name="header" /></div><div class="content"><slot /></div></div>',
            inject: { mobileMode: { default: false } },
          },
          Section: {
            name: "Section",
            template:
              '<div class="section"><div v-if="$slots.title" class="title"><slot name="title" /></div><div class="content"><slot name="content" /></div></div>',
            props: ["variant", "theme"],
          },
          Button: {
            name: "Button",
            template:
              '<button @click="$emit(\'click\')" :class="kind"><slot>{{ text }}</slot></button>',
            props: ["kind", "text"],
            emits: ["click"],
          },
          // Keep complex components stubbed
          ThemeSwitch: ThemeSwitchStub,
          ColorPicker: ColorPickerStub,
          SegmentedControl: SegmentedControlStub,
        },
      },
    });
  };

  it("toggles header slot based on header prop", () => {
    const settings = {};
    const wrapperHide = shallowMount(FileSettings, {
      props: { modelValue: settings, header: false },
      global: {
        provide: { mobileMode: false },
      },
    });
    expect(wrapperHide.find(".settings-header").exists()).toBe(false);

    const wrapperShow = shallowMount(FileSettings, {
      props: { modelValue: settings, header: true },
      global: {
        provide: { mobileMode: false },
      },
    });
    expect(wrapperShow.find(".settings-header").exists()).toBe(true);
    expect(wrapperShow.find(".settings-header").text()).toContain("File Settings");
  });

  it("updates background when ColorPicker emits change", async () => {
    const settings = {
      background: "",
      fontSize: "",
      lineHeight: "",
      fontFamily: "",
      marginWidth: "",
    };
    const wrapper = mountFileSettings(settings);
    await wrapper.findComponent(ColorPickerStub).vm.$emit("change", "gray");
    expect(settings.background).toBe("var(--gray-75)");
  });

  it("updates fontSize, lineHeight, fontFamily, and marginWidth on SegmentedControl update", async () => {
    const settings = {
      background: "",
      fontSize: "",
      lineHeight: "",
      fontFamily: "",
      marginWidth: "",
    };
    const wrapper = mountFileSettings(settings);
    const controls = wrapper.findAllComponents(SegmentedControlStub);
    // order: size, density, style, width
    await controls[0].vm.$emit("update:modelValue", 2);
    expect(settings.fontSize).toBe("18px");
    await controls[1].vm.$emit("update:modelValue", 1);
    expect(settings.lineHeight).toBe("1.5");
    await controls[2].vm.$emit("update:modelValue", 1);
    expect(settings.fontFamily).toBe("'Source Serif 4', serif");
    await controls[3].vm.$emit("update:modelValue", 2);
    expect(settings.marginWidth).toBe("64px");
  });

  it("resets settings to initial values on reset button click", async () => {
    const initial = {
      background: "var(--surface-page)",
      fontSize: "14px",
      lineHeight: "1.2",
      fontFamily: "'Source Sans 3', sans-serif",
      marginWidth: "0px",
    };
    const settings = { ...initial };
    const wrapper = mountFileSettings(settings);
    wrapper.vm.startReceivingUserInput();
    // mutate settings
    settings.fontSize = "18px";
    await wrapper.find('[data-testid="reset-button"]').trigger("click");
    expect(settings).toEqual(initial);
  });

  it("emits save event with current settings when save button is clicked", async () => {
    const settings = {
      background: "b",
      fontSize: "fs",
      lineHeight: "lh",
      fontFamily: "ff",
      marginWidth: "mw",
    };
    const wrapper = mountFileSettings(settings);
    wrapper.vm.startReceivingUserInput();
    const saveBtn = wrapper.find('[data-testid="save-button"]');
    await saveBtn.trigger("click");
    expect(wrapper.emitted("save")).toBeTruthy();
    expect(wrapper.emitted("save")[0][0]).toEqual(settings);
  });
});
