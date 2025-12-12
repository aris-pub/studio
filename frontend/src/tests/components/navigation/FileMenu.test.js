import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import FileMenu from "@/components/navigation/FileMenu.vue";

describe("FileMenu.vue - Isolated Testing", () => {
  let mockProvides;

  beforeEach(() => {
    mockProvides = {
      mobileMode: ref(false),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render FileMenu component with dots trigger", () => {
    const wrapper = mount(FileMenu, {
      global: {
        provide: mockProvides,
      },
    });

    const fmWrapper = wrapper.find(".fm-wrapper");
    expect(fmWrapper.exists()).toBe(true);
  });

  it("should contain ContextMenu component", () => {
    const wrapper = mount(FileMenu, {
      global: {
        provide: mockProvides,
      },
    });

    const contextMenu = wrapper.findComponent({ name: "ContextMenu" });
    expect(contextMenu.exists()).toBe(true);
  });
});

describe("FileMenu.vue - TDD ContextMenu Dots Variant", () => {
  let mockProvides;

  beforeEach(() => {
    mockProvides = {
      mobileMode: ref(false),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should use ContextMenu with dots variant correctly", () => {
    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: '<div data-testid="context-menu" :variant="variant"><slot /></div>',
            props: ["variant"],
          },
          ContextMenuItem: {
            template: '<div data-testid="context-menu-item" :class="$attrs.class"><slot /></div>',
            props: ["icon", "caption"],
          },
          Separator: {
            template: '<hr data-testid="separator" />',
          },
        },
      },
    });

    const contextMenu = wrapper.find('[data-testid="context-menu"]');
    expect(contextMenu.exists()).toBe(true);
    expect(contextMenu.attributes("variant")).toBe("dots");
  });

  it("should render menu items directly inside ContextMenu", () => {
    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: '<div data-testid="context-menu" variant="dots"><slot /></div>',
          },
          ContextMenuItem: {
            template: '<div data-testid="context-menu-item"><slot /></div>',
            props: ["icon", "caption"],
          },
          Separator: {
            template: '<hr data-testid="separator" />',
          },
        },
      },
    });

    // Look for the specific menu item testids from the component
    const shareItem = wrapper.find('[data-testid="file-menu-share"]');
    const downloadItem = wrapper.find('[data-testid="file-menu-download"]');
    const renameItem = wrapper.find('[data-testid="file-menu-rename"]');
    const duplicateItem = wrapper.find('[data-testid="file-menu-duplicate"]');
    const deleteItem = wrapper.find('[data-testid="file-menu-delete"]');

    // Should have Share, Download, Rename, Duplicate, Delete items
    expect(shareItem.exists()).toBe(true);
    expect(downloadItem.exists()).toBe(true);
    expect(renameItem.exists()).toBe(true);
    expect(duplicateItem.exists()).toBe(true);
    expect(deleteItem.exists()).toBe(true);

    // Should have separators
    const contextMenu = wrapper.find('[data-testid="context-menu"]');
    const separators = contextMenu.findAll('[data-testid="separator"]');
    expect(separators.length).toBeGreaterThan(0);
  });

  it("should expose toggle method from ContextMenu ref", () => {
    const mockToggle = vi.fn();

    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: '<div data-testid="context-menu"><slot /></div>',
            setup() {
              return { toggle: mockToggle };
            },
            expose: ["toggle"],
          },
          ContextMenuItem: {
            template: '<div data-testid="context-menu-item"></div>',
          },
          Separator: {
            template: '<hr data-testid="separator" />',
          },
        },
      },
    });

    expect(typeof wrapper.vm.toggle).toBe("function");

    // Call the exposed toggle method
    wrapper.vm.toggle();
    expect(mockToggle).toHaveBeenCalled();
  });

  it("should emit events when menu items are clicked", async () => {
    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: '<div data-testid="context-menu"><slot /></div>',
          },
          ContextMenuItem: {
            template: '<div data-testid="context-menu-item" @click="$attrs.onClick"><slot /></div>',
            props: ["icon", "caption"],
          },
          Separator: {
            template: '<hr data-testid="separator" />',
          },
        },
      },
    });

    // Test using the specific menu item testids
    const renameItem = wrapper.find('[data-testid="file-menu-rename"]');
    const duplicateItem = wrapper.find('[data-testid="file-menu-duplicate"]');
    const deleteItem = wrapper.find('[data-testid="file-menu-delete"]');

    // Test rename button
    await renameItem.trigger("click");
    expect(wrapper.emitted("rename")).toBeTruthy();

    // Test duplicate button
    await duplicateItem.trigger("click");
    expect(wrapper.emitted("duplicate")).toBeTruthy();

    // Test delete button
    await deleteItem.trigger("click");
    expect(wrapper.emitted("delete")).toBeTruthy();
  });

  it("should emit download event when download menu item is clicked", async () => {
    const wrapper = mount(FileMenu, {
      props: {
        mode: "ContextMenu",
      },
      global: {
        provide: mockProvides,
        stubs: {
          ContextMenu: {
            template: '<div data-testid="context-menu"><slot /></div>',
          },
          ContextMenuItem: {
            template: '<div data-testid="context-menu-item" @click="$attrs.onClick"><slot /></div>',
            props: ["icon", "caption"],
          },
          Separator: {
            template: '<hr data-testid="separator" />',
          },
        },
      },
    });

    // Test download button
    const downloadItem = wrapper.find('[data-testid="file-menu-download"]');
    await downloadItem.trigger("click");
    expect(wrapper.emitted("download")).toBeTruthy();
  });
});
