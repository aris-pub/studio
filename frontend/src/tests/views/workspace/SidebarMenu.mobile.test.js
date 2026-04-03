import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import SidebarMenu from "@/views/workspace/SidebarMenu.vue";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";

const pushMock = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("SidebarMenu mobile item filtering", () => {
  let useKSSpy;

  beforeEach(() => {
    useKSSpy = vi.spyOn(KSMod, "useKeyboardShortcuts").mockImplementation(() => {});
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const allItems = [
    { name: "DockableEditor", icon: "Code", label: "source", key: "e", state: false, type: "toggle" },
    { name: "DockableSearch", icon: "Search", label: "search", key: "f", state: false, type: "toggle" },
    { name: "Separator", state: false },
    { name: "DrawerVersions", icon: "Versions", label: "versions", key: "v", state: false, type: "drawer" },
    { name: "DrawerSettings", icon: "AdjustmentsHorizontal", label: "settings", key: "t", state: false, type: "drawer" },
    { name: "DrawerShare", icon: "Users", label: "share", key: "s", state: false, type: "drawer" },
    { name: "DrawerFile", icon: "File", label: "file", key: "a", state: false, type: "drawer" },
    { name: "Separator", state: false },
  ];

  function mountMobile(items = allItems) {
    return mount(SidebarMenu, {
      props: { items },
      global: {
        provide: {
          mobileMode: ref(true),
          xsMode: ref(false),
          focusMode: ref(false),
          drawerOpen: ref(false),
        },
        stubs: {
          SidebarItem: {
            name: "SidebarItem",
            template: '<div class="sb-item" :data-label="label" />',
            props: ["icon", "label", "modelValue"],
          },
          ContextMenu: {
            name: "ContextMenu",
            template: '<div class="context-menu"><slot name="trigger" :toggle="() => {}" /><slot /></div>',
          },
          ContextMenuItem: {
            name: "ContextMenuItem",
            template: '<div class="context-menu-item" :data-caption="caption" :data-disabled="disabled || undefined" />',
            props: ["icon", "caption", "disabled"],
          },
          Button: { template: '<button />' },
          Separator: { template: '<hr />' },
          UserMenu: { template: '<div />' },
        },
      },
    });
  }

  function mountDesktop(items = allItems) {
    return mount(SidebarMenu, {
      props: { items },
      global: {
        provide: {
          mobileMode: ref(false),
          xsMode: ref(false),
          focusMode: ref(false),
          drawerOpen: ref(false),
        },
        stubs: {
          SidebarItem: {
            name: "SidebarItem",
            template: '<div class="sb-item" :data-label="label" />',
            props: ["icon", "label", "modelValue", "type"],
          },
          ContextMenu: {
            name: "ContextMenu",
            template: '<div class="context-menu"><slot name="trigger" :toggle="() => {}" /><slot /></div>',
          },
          ContextMenuItem: {
            name: "ContextMenuItem",
            template: '<div class="context-menu-item" :data-caption="caption" />',
            props: ["icon", "caption"],
          },
          Button: { template: '<button />' },
          Separator: { template: '<hr />' },
          UserMenu: { template: '<div />' },
        },
      },
    });
  }

  it("hides source editor toggle on mobile", () => {
    const wrapper = mountMobile();
    const toggleItems = wrapper.findAll('.sb-item[data-label]');
    const labels = toggleItems.map((w) => w.attributes("data-label"));
    expect(labels).not.toContain("source");
  });

  it("hides versions drawer from mobile overflow menu", () => {
    const wrapper = mountMobile();
    const menuItems = wrapper.findAll('.context-menu-item');
    const captions = menuItems.map((w) => w.attributes("data-caption"));
    expect(captions).not.toContain("versions");
  });

  it("hides share drawer from mobile overflow menu", () => {
    const wrapper = mountMobile();
    const menuItems = wrapper.findAll('.context-menu-item');
    const captions = menuItems.map((w) => w.attributes("data-caption"));
    expect(captions).not.toContain("share");
  });

  it("keeps search toggle on mobile", () => {
    const wrapper = mountMobile();
    const toggleItems = wrapper.findAll('.sb-item[data-label]');
    const labels = toggleItems.map((w) => w.attributes("data-label"));
    expect(labels).toContain("search");
  });

  it("keeps settings drawer on mobile", () => {
    const wrapper = mountMobile();
    const menuItems = wrapper.findAll('.context-menu-item');
    const captions = menuItems.map((w) => w.attributes("data-caption"));
    expect(captions).toContain("settings");
  });

  it("keeps file drawer on mobile", () => {
    const wrapper = mountMobile();
    const menuItems = wrapper.findAll('.context-menu-item');
    const captions = menuItems.map((w) => w.attributes("data-caption"));
    expect(captions).toContain("file");
  });

  it("shows all items on desktop", () => {
    const wrapper = mountDesktop();
    const sidebarItems = wrapper.findAll('.sb-item[data-label]');
    const labels = sidebarItems.map((w) => w.attributes("data-label"));
    expect(labels).toContain("source");
    expect(labels).toContain("search");
    expect(labels).toContain("versions");
    expect(labels).toContain("settings");
    expect(labels).toContain("share");
    expect(labels).toContain("file");
  });
});
