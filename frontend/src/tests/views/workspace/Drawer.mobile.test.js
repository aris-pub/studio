import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import Drawer from "@/views/workspace/Drawer.vue";

vi.mock("@/composables/useClosable.js", () => ({
  default: vi.fn(() => ({ activate: vi.fn(), deactivate: vi.fn() })),
}));

const PaneStub = { template: '<div class="pane"><slot name="header"/><slot/></div>' };
const SectionStub = { template: '<div class="section"><slot name="header"/><slot/></div>' };

const createWrapper = (component, mobileMode = false) =>
  mount(Drawer, {
    props: { component },
    global: {
      provide: {
        drawerOpen: ref(true),
        focusMode: ref(false),
        mobileMode: ref(mobileMode),
        api: {},
        file: ref({ id: 1, title: "Test" }),
        fileSettings: ref({}),
        fileStore: {},
        user: ref({ id: 1, name: "Test" }),
      },
      stubs: {
        Pane: PaneStub,
        Section: SectionStub,
        BottomSheet: {
          template: '<div class="bottom-sheet"><slot/></div>',
          props: ["modelValue", "title", "height"],
        },
        FileSettings: {
          template: '<div class="file-settings"/>',
          methods: { startReceivingUserInput() {} },
        },
        IconFileText: { template: "<span/>" },
      },
    },
  });

describe("Drawer.vue mobile mode", () => {
  it("renders desktop drawer when not in mobile mode", () => {
    const wrapper = createWrapper("DrawerSettings", false);
    expect(wrapper.find(".drawer").exists()).toBe(true);
    expect(wrapper.find(".bottom-sheet").exists()).toBe(false);
  });

  it("renders BottomSheet when in mobile mode", () => {
    const wrapper = createWrapper("DrawerSettings", true);
    expect(wrapper.find(".bottom-sheet").exists()).toBe(true);
    expect(wrapper.find(".drawer").exists()).toBe(false);
  });

  it("renders drawer content inside BottomSheet on mobile", () => {
    const wrapper = createWrapper("DrawerSettings", true);
    const sheet = wrapper.find(".bottom-sheet");
    expect(sheet.exists()).toBe(true);
  });

  it("renders DrawerFile in BottomSheet on mobile", () => {
    const wrapper = createWrapper("DrawerFile", true);
    expect(wrapper.find(".bottom-sheet").exists()).toBe(true);
  });
});
