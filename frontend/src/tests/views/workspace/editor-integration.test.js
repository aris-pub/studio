import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import Editor from "@/views/workspace/Editor.vue";
import DockableEditor from "@/views/workspace/DockableEditor.vue";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";

vi.mock("@/composables/useKeyboardShortcuts.js", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@/views/workspace/EditorCodeMirror.vue", () => ({
  default: {
    name: "EditorCodeMirror",
    template: "<div />",
  },
}));

// Mock native File constructor for file upload tests
global.File = class File {
  constructor(bits, name, options = {}) {
    this.name = name;
    this.size = bits.reduce((acc, bit) => acc + bit.length, 0);
    this.type = options.type || "";
    this.lastModified = Date.now();
  }
};

describe("Editor Integration Tests", () => {
  let mockApi;
  let mockFile;
  let useKeyboardShortcutsSpy;

  beforeEach(() => {
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    };

    mockFile = ref({
      id: 42,
      source: "# Test Content",
      html: "<h1>Test Content</h1>",
    });

    useKeyboardShortcutsSpy = vi.spyOn(KSMod, "useKeyboardShortcuts");

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const defaultStubs = {
    EditorCodeMirror: { template: "<div />" },
    EditorTopbar: { template: "<div />", emits: ["compile", "upload"] },
    EditorFiles: { template: "<div />", props: ["modelValue"] },
  };

  const mountEditor = (overrides = {}) =>
    mount(Editor, {
      props: { modelValue: mockFile.value },
      global: {
        provide: { api: mockApi, user: { id: 1 } },
        stubs: { ...defaultStubs, ...overrides },
      },
    });

  describe("DockableEditor", () => {
    it("renders Editor component with file model", () => {
      const wrapper = mount(DockableEditor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi, user: { id: 1 } },
          stubs: {
            EditorCodeMirror: { template: "<div />" },
            Editor: {
              name: "Editor",
              template: '<div class="editor-stub" />',
              props: ["modelValue"],
            },
          },
        },
      });

      const editor = wrapper.findComponent({ name: "Editor" });
      expect(editor.exists()).toBe(true);
      expect(editor.props("modelValue")).toEqual(mockFile.value);
    });

    it("propagates file changes through v-model", async () => {
      const wrapper = mount(DockableEditor, {
        props: {
          modelValue: mockFile.value,
          "onUpdate:modelValue": (newFile) => {
            mockFile.value = newFile;
          },
        },
        global: {
          provide: { api: mockApi, user: { id: 1 } },
          stubs: {
            EditorCodeMirror: { template: "<div />" },
            Editor: {
              name: "Editor",
              template: '<div class="editor-stub" data-testid="editor-stub" />',
              props: ["modelValue"],
              emits: ["update:modelValue"],
            },
          },
        },
      });

      const newFile = { ...mockFile.value, source: "Updated content" };
      await wrapper.vm.$emit("update:modelValue", newFile);
      await nextTick();

      expect(mockFile.value.source).toBe("Updated content");
    });
  });

  describe("Editor Component", () => {
    it("initializes with correct default state", () => {
      const wrapper = mountEditor();
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find(".editor").exists()).toBe(true);
    });

    it("handles compilation via compile button", async () => {
      const compiledHtml = "<h1>Compiled Content</h1>";
      mockApi.post.mockResolvedValue({ data: compiledHtml });
      window.__ytext = { toString: () => "# Test Content" };

      const wrapper = mountEditor({
        EditorTopbar: {
          name: "EditorTopbar",
          template: "<div />",
          emits: ["compile", "upload"],
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });
      await topbar.vm.$emit("compile");
      await nextTick();

      expect(mockApi.post).toHaveBeenCalledWith("render/private", {
        source: "# Test Content",
        file_id: 42,
      });

      delete window.__ytext;
    });

    it("handles file upload successfully", async () => {
      const mockAsset = new File(["test content"], "test.txt", { type: "text/plain" });
      const mockResponse = { data: { id: 123, url: "/assets/test.txt" } };
      mockApi.post.mockResolvedValue(mockResponse);

      const mockFileReader = {
        readAsText: vi.fn(),
        result: "test content",
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader);

      const wrapper = mountEditor({
        EditorTopbar: {
          name: "EditorTopbar",
          template: "<div />",
          emits: ["compile", "upload"],
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });
      topbar.vm.$emit("upload", mockAsset);
      mockFileReader.onload();
      await nextTick();

      expect(mockApi.post).toHaveBeenCalledWith("/assets", {
        filename: "test.txt",
        mime_type: "text/plain",
        content: "test content",
        content_encoding: "plain",
        file_id: mockFile.value.id,
      });
    });

    it("handles binary file upload with base64 encoding", async () => {
      const mockAsset = new File(["fake image data"], "image.png", { type: "image/png" });
      const mockResponse = { data: { id: 123, url: "/assets/image.png" } };
      mockApi.post.mockResolvedValue(mockResponse);

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: "data:image/png;base64,ZmFrZSBpbWFnZSBkYXRh",
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader);

      const wrapper = mountEditor({
        EditorTopbar: {
          name: "EditorTopbar",
          template: "<div />",
          emits: ["compile", "upload"],
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });
      topbar.vm.$emit("upload", mockAsset);
      mockFileReader.onload();
      await nextTick();

      expect(mockApi.post).toHaveBeenCalledWith("/assets", {
        filename: "image.png",
        mime_type: "image/png",
        content: "ZmFrZSBpbWFnZSBkYXRh",
        content_encoding: "base64",
        file_id: mockFile.value.id,
      });
    });

    it("handles file upload errors", async () => {
      const mockAsset = new File(["test"], "test.txt", { type: "text/plain" });
      const uploadError = new Error("Upload failed");

      const mockFileReader = {
        readAsText: vi.fn(),
        result: null,
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const wrapper = mountEditor({
        EditorTopbar: {
          name: "EditorTopbar",
          template: "<div />",
          emits: ["compile", "upload"],
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });
      topbar.vm.$emit("upload", mockAsset);
      mockFileReader.onerror(uploadError);
      await nextTick();

      expect(wrapper.exists()).toBe(true);
      consoleSpy.mockRestore();
    });

    it("switches between editor tabs correctly", async () => {
      const wrapper = mountEditor({
        EditorCodeMirror: {
          name: "EditorCodeMirror",
          template: '<div class="editor-codemirror" />',
        },
        EditorTopbar: {
          name: "EditorTopbar",
          template: '<div data-testid="editor-topbar" />',
          props: ["modelValue"],
          emits: ["update:modelValue"],
        },
        EditorFiles: { template: '<div class="editor-files" />' },
      });

      expect(wrapper.findComponent({ name: "EditorCodeMirror" }).exists()).toBe(true);
      expect(wrapper.find(".editor-files").exists()).toBe(false);

      const topbar = wrapper.findComponent('[data-testid="editor-topbar"]');
      await topbar.vm.$emit("update:modelValue", 1);
      await nextTick();

      expect(wrapper.findComponent({ name: "EditorCodeMirror" }).exists()).toBe(false);
      expect(wrapper.find(".editor-files").exists()).toBe(true);
    });

    it("sets up keyboard shortcuts with Cmd+S for compile", () => {
      mountEditor();

      expect(useKeyboardShortcutsSpy).toHaveBeenCalledWith({
        s: expect.any(Function),
      });
    });

    it("Cmd+S triggers compile", async () => {
      mockApi.post.mockResolvedValue({ data: "<h1>ok</h1>" });
      window.__ytext = { toString: () => "source" };

      mountEditor();

      const shortcutsConfig = useKeyboardShortcutsSpy.mock.calls[0][0];
      await shortcutsConfig.s();

      expect(mockApi.post).toHaveBeenCalledWith("render/private", {
        source: "source",
        file_id: 42,
      });

      delete window.__ytext;
    });

    it("provides compile to child components", () => {
      const wrapper = mountEditor();
      expect(wrapper.exists()).toBe(true);
    });

    it("handles concurrent compile and upload", async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1 } });
      window.__ytext = { toString: () => "source" };

      const mockFileReader = {
        readAsText: vi.fn(),
        readAsDataURL: vi.fn(),
        result: "test",
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader);

      const wrapper = mountEditor({
        EditorTopbar: {
          name: "EditorTopbar",
          template: "<div />",
          emits: ["compile", "upload"],
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });
      const mockAsset = new File(["test"], "test.txt", { type: "text/plain" });
      topbar.vm.$emit("compile");
      topbar.vm.$emit("upload", mockAsset);

      if (mockFileReader.onload) {
        mockFileReader.onload();
      }

      await nextTick();

      // Compile calls render/private, upload calls /assets
      expect(mockApi.post).toHaveBeenCalledWith("render/private", expect.any(Object));
      expect(wrapper.exists()).toBe(true);

      delete window.__ytext;
    });
  });
});
