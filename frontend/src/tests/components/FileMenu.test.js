import { describe, it, expect, vi } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import FileMenu from "@/components/navigation/FileMenu.vue";

describe("FileMenu.vue", () => {
  const ContextMenuStub = defineComponent({
    name: "ContextMenu",
    props: { icon: { type: String }, buttonSize: { type: String } },
    setup(_, { expose, slots }) {
      const toggle = vi.fn();
      expose({ toggle });
      return () => slots.default && slots.default();
    },
  });
  const ContextMenuItemStub = defineComponent({
    name: "ContextMenuItem",
    props: { icon: { type: String }, caption: { type: String } },
    emits: ["click"],
    template: '<button @click="$emit(\'click\', $event)" class="item">{{ caption }}</button>',
  });
  const SeparatorStub = defineComponent({ name: "Separator", template: "<hr />" });

  it("renders correct menu items with proper props and classes", () => {
    const wrapper = mount(FileMenu, {
      global: {
        stubs: {
          ContextMenu: ContextMenuStub,
          ContextMenuItem: ContextMenuItemStub,
          Separator: SeparatorStub,
        },
      },
    });

    const items = wrapper.findAllComponents(ContextMenuItemStub);
    expect(items).toHaveLength(6);
    expect(items[0].props()).toMatchObject({ icon: "Share3", caption: "Share" });
    expect(items[1].props()).toMatchObject({ icon: "FileTypeHtml", caption: "Download HTML" });
    expect(items[2].props()).toMatchObject({ icon: "FileTypePdf", caption: "Download PDF" });
    expect(items[3].props()).toMatchObject({ icon: "Edit", caption: "Rename" });
    expect(items[4].props()).toMatchObject({ icon: "Copy", caption: "Duplicate" });
    expect(items[5].props()).toMatchObject({ icon: "TrashX", caption: "Delete" });
    expect(items[5].classes()).toContain("danger");
  });

  it("emits rename, duplicate, delete and toggles context menu", async () => {
    const toggle = vi.fn();
    const ContextMenuToggleStub = defineComponent({
      name: "ContextMenu",
      props: { icon: { type: String }, buttonSize: { type: String } },
      setup(_, { expose, slots }) {
        expose({ toggle });
        return () => slots.default && slots.default();
      },
    });
    const wrapper = mount(FileMenu, {
      global: {
        stubs: {
          ContextMenu: ContextMenuToggleStub,
          ContextMenuItem: ContextMenuItemStub,
          Separator: SeparatorStub,
        },
      },
    });

    const items = wrapper.findAllComponents(ContextMenuItemStub);
    // rename
    await items[3].trigger("click");
    expect(toggle).toHaveBeenCalled();
    expect(wrapper.emitted("rename")).toBeTruthy();

    // duplicate
    await items[4].trigger("click");
    expect(toggle).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("duplicate")).toBeTruthy();

    // delete
    await items[5].trigger("click");
    expect(toggle).toHaveBeenCalledTimes(3);
    expect(wrapper.emitted("delete")).toBeTruthy();
  });
});
