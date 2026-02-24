import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
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

  it("shows check icon when save status is idle", () => {
    const wrapper = createWrapper({ saveStatus: "idle" });
    expect(wrapper.find(".icon-idle").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows check icon when save status is saved", () => {
    const wrapper = createWrapper({ saveStatus: "saved" });
    expect(wrapper.find(".icon-saved").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows clock icon when save status is pending", () => {
    const wrapper = createWrapper({ saveStatus: "pending" });
    expect(wrapper.find(".icon-pending").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows floppy icon when save status is saving", () => {
    const wrapper = createWrapper({ saveStatus: "saving" });
    expect(wrapper.find(".icon-saving").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows X icon when save status is error", () => {
    const wrapper = createWrapper({ saveStatus: "error" });
    expect(wrapper.find(".icon-error").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows disconnected collab dot when not connected", () => {
    const wrapper = createWrapper(
      {},
      {
        collabIsConnected: ref(false),
        collabIsSynced: ref(false),
      }
    );
    expect(wrapper.find(".collab-dot.disconnected").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows syncing collab dot when connected but not synced", () => {
    const wrapper = createWrapper(
      {},
      {
        collabIsConnected: ref(true),
        collabIsSynced: ref(false),
      }
    );
    expect(wrapper.find(".collab-dot.syncing").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows connected collab dot when fully synced", () => {
    const wrapper = createWrapper(
      {},
      {
        collabIsConnected: ref(true),
        collabIsSynced: ref(true),
      }
    );
    expect(wrapper.find(".collab-dot.connected").exists()).toBe(true);
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
