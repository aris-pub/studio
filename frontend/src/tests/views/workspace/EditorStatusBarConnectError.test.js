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
        collabConnectError: ref(false),
        collabRetry: ref(null),
        ...provides,
      },
    },
  });
}

describe("EditorStatusBar — collab connect error state", () => {
  it("shows a distinct 'Can't connect' chip when the session failed to start", () => {
    const wrapper = createWrapper({
      collabIsConnected: ref(false),
      collabConnectError: ref(true),
    });
    expect(wrapper.find(".status-error").exists()).toBe(true);
    expect(wrapper.find(".status-label").text()).toBe("Can't connect");
    wrapper.unmount();
  });

  it("renders a Retry button only in the connect-error state", () => {
    const offline = createWrapper({
      collabIsConnected: ref(false),
      collabConnectError: ref(false),
    });
    // Plain offline (transient) must NOT offer retry.
    expect(offline.find(".retry-btn").exists()).toBe(false);
    expect(offline.find(".status-label").text()).toBe("Offline");
    offline.unmount();

    const failed = createWrapper({
      collabIsConnected: ref(false),
      collabConnectError: ref(true),
    });
    expect(failed.find(".retry-btn").exists()).toBe(true);
    failed.unmount();
  });

  it("invokes the injected retry handler when Retry is clicked", async () => {
    const retry = vi.fn();
    const wrapper = createWrapper({
      collabIsConnected: ref(false),
      collabConnectError: ref(true),
      collabRetry: ref(retry),
    });
    await wrapper.find(".retry-btn").trigger("click");
    expect(retry).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("connect-error takes priority over the transient offline state", () => {
    const wrapper = createWrapper({
      collabIsConnected: ref(false),
      collabIsSynced: ref(false),
      collabConnectError: ref(true),
    });
    expect(wrapper.find(".status-label").text()).toBe("Can't connect");
    expect(wrapper.find(".retry-btn").exists()).toBe(true);
    wrapper.unmount();
  });
});
