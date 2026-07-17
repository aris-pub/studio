import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import EditorStatusBar from "@/views/workspace/EditorStatusBar.vue";

vi.mock("@/composables/useDocumentBreadcrumbs.js", () => ({
  useDocumentBreadcrumbs: () => ({
    breadcrumbs: ref([]),
    symbols: ref([]),
    refreshSymbols: vi.fn(),
  }),
}));

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

function createWrapper(provides = {}) {
  return mount(EditorStatusBar, {
    global: {
      provide: {
        file: ref({ title: "Test Doc" }),
        cmView: ref(null),
        cursorPos: ref(0),
        lspClient: ref(null),
        documentUri: ref(""),
        collabIsConnected: ref(true),
        collabIsSynced: ref(true),
        ...provides,
      },
    },
  });
}

describe("EditorStatusBar", () => {
  it("renders the status bar", () => {
    const wrapper = createWrapper();
    expect(wrapper.find(".statusbar").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows 'Saved' when connected, synced and persisted", () => {
    const wrapper = createWrapper({
      collabIsConnected: ref(true),
      collabIsSynced: ref(true),
      saveState: ref("saved"),
    });
    expect(wrapper.find(".status-saved").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Saved");
    wrapper.unmount();
  });

  it("shows 'Saving…' while the user's edits are being persisted", () => {
    const wrapper = createWrapper({ saveState: ref("saving") });
    expect(wrapper.find(".status-warning").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Saving…");
    wrapper.unmount();
  });

  it("shows a distinct warning when work is not being saved", () => {
    const wrapper = createWrapper({ saveState: ref("not-saving") });
    const right = wrapper.find(".right");
    expect(right.classes()).toContain("status-error");
    expect(right.classes()).toContain("status-critical");
    expect(wrapper.find(".status-label").text()).toBe("Not saving. Check your connection");
    wrapper.unmount();
  });

  it("the not-saving warning outranks the plain connection indicator", () => {
    // Relay looks fine but the backend never acked persistence: the data-loss
    // warning must win over any calm connection state.
    const wrapper = createWrapper({
      collabIsConnected: ref(true),
      collabIsSynced: ref(true),
      saveState: ref("not-saving"),
    });
    expect(wrapper.find(".status-label").text()).toBe("Not saving. Check your connection");
    wrapper.unmount();
  });

  it("shows 'Offline' when not connected", () => {
    const wrapper = createWrapper({
      collabIsConnected: ref(false),
      collabIsSynced: ref(false),
    });
    expect(wrapper.find(".status-error").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Offline");
    wrapper.unmount();
  });

  it("shows 'Syncing…' when connected but not synced", () => {
    const wrapper = createWrapper({
      collabIsConnected: ref(true),
      collabIsSynced: ref(false),
    });
    expect(wrapper.find(".status-warning").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Syncing…");
    wrapper.unmount();
  });

  it("connection status takes priority over sync status", () => {
    const wrapper = createWrapper({
      collabIsConnected: ref(false),
      collabIsSynced: ref(false),
    });
    expect(wrapper.find(".status-label").text()).toBe("Offline");
    wrapper.unmount();
  });

  it("renders MapPin icon in breadcrumb area", () => {
    const wrapper = createWrapper();
    expect(wrapper.find(".middle svg").exists()).toBe(true);
    wrapper.unmount();
  });

  it("always shows root crumb from file title", () => {
    const wrapper = createWrapper();
    const crumbs = wrapper.findAll(".crumb");
    expect(crumbs.length).toBe(1);
    expect(crumbs[0].text()).toBe("Test Doc");
    wrapper.unmount();
  });
});
