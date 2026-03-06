import { describe, it, expect, vi } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import EditorStatusBar from "@/views/workspace/EditorStatusBar.vue";

// Mock the breadcrumbs composable
vi.mock("@/composables/useDocumentBreadcrumbs.js", () => ({
  useDocumentBreadcrumbs: () => ({
    breadcrumbs: ref([]),
    symbols: ref([]),
    refreshSymbols: vi.fn(),
  }),
}));

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

function createWrapper(props = {}, provides = {}) {
  return mount(EditorStatusBar, {
    props: {
      saveStatus: "idle",
      ...props,
    },
    global: {
      provide: {
        file: ref({ title: "Test Doc" }),
        cmView: ref(null),
        cursorPos: ref(0),
        lspClient: ref(null),
        documentUri: ref(""),
        collabIsConnected: ref(false),
        collabIsSynced: ref(false),
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

  it("shows nothing in the right section when idle and connected", () => {
    const wrapper = createWrapper(
      { saveStatus: "idle" },
      { collabIsConnected: ref(true), collabIsSynced: ref(true) }
    );
    expect(wrapper.find(".right").exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows 'Saved' briefly when save status transitions to saved", async () => {
    const wrapper = createWrapper(
      { saveStatus: "saving" },
      { collabIsConnected: ref(true), collabIsSynced: ref(true) }
    );
    await wrapper.setProps({ saveStatus: "saved" });
    await nextTick();
    expect(wrapper.find(".status-saved").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Saved");
    wrapper.unmount();
  });

  it("shows 'Unsaved' when save status is pending", () => {
    const wrapper = createWrapper(
      { saveStatus: "pending" },
      { collabIsConnected: ref(true), collabIsSynced: ref(true) }
    );
    expect(wrapper.find(".status-warning").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Unsaved");
    wrapper.unmount();
  });

  it("shows 'Saving…' when save status is saving", () => {
    const wrapper = createWrapper(
      { saveStatus: "saving" },
      { collabIsConnected: ref(true), collabIsSynced: ref(true) }
    );
    expect(wrapper.find(".status-saving").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Saving…");
    wrapper.unmount();
  });

  it("shows 'Save failed' when save status is error", () => {
    const wrapper = createWrapper(
      { saveStatus: "error" },
      { collabIsConnected: ref(true), collabIsSynced: ref(true) }
    );
    expect(wrapper.find(".status-error").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Save failed");
    wrapper.unmount();
  });

  it("shows 'Offline' when not connected", () => {
    const wrapper = createWrapper(
      {},
      { collabIsConnected: ref(false), collabIsSynced: ref(false) }
    );
    expect(wrapper.find(".status-error").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Offline");
    wrapper.unmount();
  });

  it("shows 'Syncing…' when connected but not synced", () => {
    const wrapper = createWrapper({}, { collabIsConnected: ref(true), collabIsSynced: ref(false) });
    expect(wrapper.find(".status-warning").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Syncing…");
    wrapper.unmount();
  });

  it("connection status takes priority over save status", () => {
    const wrapper = createWrapper(
      { saveStatus: "saving" },
      { collabIsConnected: ref(false), collabIsSynced: ref(false) }
    );
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
