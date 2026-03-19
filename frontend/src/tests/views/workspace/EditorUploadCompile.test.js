import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import Editor from "@/views/workspace/Editor.vue";

vi.mock("@/composables/useKeyboardShortcuts.js", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

let wrapper;

// Mock FileReader so readAsDataURL / readAsText resolve via microtask in jsdom
class MockFileReader {
  readAsDataURL() {
    this.result = "data:image/png;base64,AAAA";
    Promise.resolve().then(() => this.onload({ target: this }));
  }
  readAsText() {
    this.result = "text content";
    Promise.resolve().then(() => this.onload({ target: this }));
  }
}

beforeEach(() => {
  vi.stubGlobal("FileReader", MockFileReader);
});

afterEach(() => {
  if (wrapper) {
    wrapper.unmount();
    wrapper = null;
  }
  delete window.__ytext;
  vi.unstubAllGlobals();
});

const EditorTopbarStub = {
  name: "EditorTopbar",
  template: "<div></div>",
  emits: ["compile", "upload"],
  props: { modelValue: { default: 0 } },
};

function createWrapper({ apiMock } = {}) {
  const api = apiMock || {
    post: vi.fn().mockResolvedValue({ data: "<p>rendered</p>" }),
    get: vi.fn().mockResolvedValue({ data: [] }),
  };

  wrapper = mount(Editor, {
    props: {
      modelValue: { id: 42, html: "", source: "" },
      "onUpdate:modelValue": () => {},
    },
    global: {
      provide: {
        api,
        mobileMode: ref(false),
      },
      stubs: {
        EditorTopbar: EditorTopbarStub,
        EditorToolbar: { template: "<div></div>" },
        EditorStatusBar: { template: "<div></div>" },
        EditorCodeMirror: { template: "<div></div>" },
        EditorFiles: { template: "<div></div>" },
        IconLock: { template: "<span></span>" },
      },
    },
  });

  return { api };
}

describe("Editor: auto-recompile on asset upload", () => {
  it("calls compile after a successful asset upload", async () => {
    const api = {
      post: vi.fn().mockResolvedValue({ data: { id: 1, filename: "img.png" } }),
      get: vi.fn().mockResolvedValue({ data: [] }),
    };
    createWrapper({ apiMock: api });

    window.__ytext = { toString: () => "test source" };

    const topbar = wrapper.findComponent(EditorTopbarStub);
    const file = new File(["hello"], "img.png", { type: "image/png" });
    topbar.vm.$emit("upload", file);

    // Let FileReader microtask + all promises resolve
    await flushPromises();
    await flushPromises();

    const postCalls = api.post.mock.calls;
    expect(postCalls.length).toBe(2);
    expect(postCalls[0][0]).toBe("/assets");
    expect(postCalls[1][0]).toBe("render/private");
    expect(postCalls[1][1]).toEqual({ source: "test source", file_id: 42 });
  });

  it("does not compile when upload fails", async () => {
    const api = {
      post: vi.fn().mockRejectedValue(new Error("upload failed")),
      get: vi.fn().mockResolvedValue({ data: [] }),
    };
    createWrapper({ apiMock: api });

    window.__ytext = { toString: () => "test source" };

    const topbar = wrapper.findComponent(EditorTopbarStub);
    topbar.vm.$emit("upload", new File(["x"], "bad.png", { type: "image/png" }));

    await flushPromises();
    await flushPromises();

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toBe("/assets");
  });
});
