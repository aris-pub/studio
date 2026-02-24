import { describe, it, expect, vi, afterEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import EditorToolbar from "@/views/workspace/EditorToolbar.vue";

// Mock the scroll shadows composable
vi.mock("@/composables/useScrollShadows.js", () => ({
  useScrollShadows: () => ({
    scrollElementRef: ref(null),
    showLeftShadow: ref(false),
    showRightShadow: ref(false),
    updateShadows: vi.fn(),
    setupScrollShadows: vi.fn(),
    cleanupScrollShadows: vi.fn(),
  }),
}));

let wrapper;

afterEach(() => {
  if (wrapper) {
    wrapper.unmount();
    wrapper = null;
  }
});

function createWrapper(provides = {}) {
  wrapper = mount(EditorToolbar, {
    global: {
      provide: {
        cmView: ref(null),
        ...provides,
      },
      stubs: {
        ContextMenu: {
          template:
            '<div class="cm-wrapper"><slot name="trigger" :toggle="() => {}" :is-open="false" /><slot /></div>',
        },
        ContextMenuItem: {
          template: '<button class="cmi" @click="$emit(\'click\')"><slot /></button>',
          props: ["caption", "icon", "shortcut"],
        },
        ButtonToggle: {
          template: '<button class="bt" @click="$emit(\'click\')"><slot />{{ text }}</button>',
          props: ["text", "icon", "iconClass", "modelValue"],
        },
        HSeparator: { template: '<div class="h-sep"></div>' },
        Separator: { template: "<hr />" },
        Button: {
          template: '<button :class="kind" @click="$emit(\'click\')"></button>',
          props: ["kind", "size", "icon", "text"],
        },
        Tooltip: { template: "<span></span>", props: ["anchor", "content"] },
      },
    },
  });
  return wrapper;
}

describe("EditorToolbar", () => {
  it("renders H, B, I buttons", () => {
    createWrapper();
    const buttons = wrapper.findAll("button.tertiary");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("renders Insert, Sections, and Math menus", () => {
    createWrapper();
    const toggles = wrapper.findAll(".bt");
    const labels = toggles.map((t) => t.text());
    expect(labels).toContain("Insert");
    expect(labels).toContain("Sections");
    expect(labels).toContain("Math");
  });

  it("clicking Bold button with cmView=null is a no-op", async () => {
    createWrapper({ cmView: ref(null) });
    const buttons = wrapper.findAll("button.tertiary");
    await buttons[1].trigger("click");
  });

  it("clicking Bold button with cmView dispatches bold command", async () => {
    const dispatchSpy = vi.fn();
    const focusSpy = vi.fn();
    const mockView = {
      state: {
        selection: { main: { from: 0, to: 0 } },
        sliceDoc: () => "",
        doc: { toString: () => "test" },
      },
      dispatch: dispatchSpy,
      focus: focusSpy,
    };

    createWrapper({ cmView: ref(mockView) });
    const buttons = wrapper.findAll("button.tertiary");
    await buttons[1].trigger("click");
    expect(dispatchSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();
  });

  it("renders menu items inside Insert dropdown", () => {
    createWrapper();
    const menuItems = wrapper.findAll(".cmi");
    expect(menuItems.length).toBeGreaterThan(5);
  });

  it("does not render keyboard icon button", () => {
    createWrapper();
    const html = wrapper.html();
    expect(html).not.toContain("Keyboard");
  });
});
