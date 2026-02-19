import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import FileMenu from "@/components/navigation/FileMenu.vue";

describe("FileMenu.vue - Component Fix Verification", () => {
  let mockProvides;

  beforeEach(() => {
    mockProvides = {
      mobileMode: false,
      isSubMenu: false,
      parentMenu: null,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should mount successfully with ContextMenu mode", () => {
    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
        icon: "Dots",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: `
              <div class="context-menu-mock" data-testid="context-menu">
                <slot />
              </div>
            `,
          },
          ContextMenuItem: {
            template: '<div class="context-menu-item-mock"><slot /></div>',
          },
          Separator: {
            template: '<div class="separator-mock"></div>',
          },
        },
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find(".fm-wrapper").exists()).toBe(true);
    expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true);
  });

  it("should emit events correctly when menu items are clicked", async () => {
    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
        icon: "Dots",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: `
              <div class="context-menu-mock" data-testid="context-menu">
                <slot />
              </div>
            `,
          },
          ContextMenuItem: {
            template:
              '<div class="context-menu-item-mock" @click="$emit(\'click\', $event)"><slot /></div>',
          },
          Separator: {
            template: '<div class="separator-mock"></div>',
          },
        },
      },
    });

    // Test rename event
    const renameItem = wrapper.findAll(".context-menu-item-mock")[3]; // Fourth item should be rename
    await renameItem.trigger("click");

    expect(wrapper.emitted()).toHaveProperty("rename");
  });

  it("should have the correct CSS wrapper class", () => {
    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
        icon: "Dots",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: '<div class="context-menu-mock"><slot /></div>',
          },
          ContextMenuItem: {
            template: '<div class="context-menu-item-mock"><slot /></div>',
          },
          Separator: {
            template: '<div class="separator-mock"></div>',
          },
        },
      },
    });

    const wrapper_div = wrapper.find(".fm-wrapper");
    expect(wrapper_div.exists()).toBe(true);
    expect(wrapper_div.classes()).toContain("ContextMenu");
  });

  it("should expose toggle method correctly", () => {
    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
        icon: "Dots",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: '<div class="context-menu-mock"><slot /></div>',
            expose: ["toggle"],
            methods: {
              toggle: vi.fn(),
            },
          },
          ContextMenuItem: {
            template: '<div class="context-menu-item-mock"><slot /></div>',
          },
          Separator: {
            template: '<div class="separator-mock"></div>',
          },
        },
      },
    });

    expect(wrapper.vm.toggle).toBeTypeOf("function");
  });
});
