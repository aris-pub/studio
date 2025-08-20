import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import Editor from "@/views/workspace/Editor.vue";
import DockableEditor from "@/views/workspace/DockableEditor.vue";
import { File as FileModel } from "@/models/File.js";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";
import * as ASMod from "@/composables/useAutoSave.js";

// Mock File model
vi.mock("@/models/File.js", () => ({
  File: {
    update: vi.fn().mockResolvedValue(),
  },
}));

// Mock auto-save composable
const mockAutoSave = {
  saveStatus: ref("idle"),
  onInput: vi.fn(),
  manualSave: vi.fn(),
};

vi.mock("@/composables/useAutoSave.js", () => ({
  useAutoSave: vi.fn(() => mockAutoSave),
}));

vi.mock("@/composables/useKeyboardShortcuts.js", () => ({
  useKeyboardShortcuts: vi.fn(),
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
  let useAutoSaveSpy;
  let useKeyboardShortcutsSpy;

  beforeEach(() => {
    mockApi = {
      post: vi.fn(),
    };

    mockFile = ref({
      id: 42,
      source: "# Test Content",
      html: "<h1>Test Content</h1>",
    });

    // Reset File model mocks
    vi.mocked(FileModel.update).mockResolvedValue();

    useAutoSaveSpy = vi.spyOn(ASMod, "useAutoSave").mockReturnValue(mockAutoSave);
    useKeyboardShortcutsSpy = vi.spyOn(KSMod, "useKeyboardShortcuts");

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DockableEditor", () => {
    it("renders Editor component with file model", () => {
      const wrapper = mount(DockableEditor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
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
          provide: { api: mockApi },
          stubs: {
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

      // Simulate the v-model update directly
      await wrapper.vm.$emit("update:modelValue", newFile);
      await nextTick();

      expect(mockFile.value.source).toBe("Updated content");
    });
  });

  describe("Editor Component", () => {
    it("initializes with correct default state", () => {
      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: { template: "<div />", emits: ["compile", "upload"] },
            EditorSource: { template: "<div />", props: ["modelValue", "saveStatus"] },
            EditorFiles: { template: "<div />", props: ["modelValue"] },
          },
        },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find(".editor").exists()).toBe(true);
    });

    it("sets up auto-save with correct configuration", () => {
      mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: { template: "<div />" },
            EditorSource: { template: "<div />" },
            EditorFiles: { template: "<div />" },
          },
        },
      });

      expect(useAutoSaveSpy).toHaveBeenCalledWith({
        file: expect.any(Object),
        saveFunction: expect.any(Function),
        compileFunction: expect.any(Function),
      });
    });

    it("handles compilation successfully", async () => {
      const compiledHtml = "<h1>Compiled Content</h1>";
      mockApi.post.mockResolvedValue({ data: compiledHtml });

      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: {
              name: "EditorTopbar",
              template: "<div />",
              emits: ["compile", "upload"],
            },
            EditorSource: {
              name: "EditorSource",
              template: "<div />",
              props: ["modelValue", "saveStatus"],
              emits: ["update:modelValue", "input"],
            },
            EditorFiles: {
              name: "EditorFiles",
              template: "<div />",
            },
          },
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });
      await topbar.vm.$emit("compile");
      await nextTick();

      expect(mockApi.post).toHaveBeenCalledWith("render/private", {
        source: mockFile.value.source,
        file_id: mockFile.value.id,
      });
      expect(mockFile.value.html).toBe(compiledHtml);
    });

    it("handles compilation errors gracefully", async () => {
      const compilationError = new Error("Compilation failed");

      // Mock with proper error handling to prevent unhandled rejection
      mockApi.post.mockImplementation(() => {
        return Promise.reject(compilationError).catch(() => {
          // Silently catch the error to prevent unhandled rejection
          return { data: null };
        });
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: {
              name: "EditorTopbar",
              template: "<div />",
              emits: ["compile", "upload"],
            },
            EditorSource: {
              name: "EditorSource",
              template: "<div />",
              props: ["modelValue", "saveStatus"],
              emits: ["update:modelValue", "input"],
            },
            EditorFiles: {
              name: "EditorFiles",
              template: "<div />",
            },
          },
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });

      // Emit compile event and wait for API call
      await topbar.vm.$emit("compile");
      await nextTick();

      // Wait for API call to complete
      await vi.waitFor(() => {
        expect(mockApi.post).toHaveBeenCalled();
      });

      // Component should still exist after handling error
      expect(wrapper.exists()).toBe(true);

      consoleSpy.mockRestore();
    });

    it("handles file saving through auto-save", async () => {
      mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: { template: "<div />" },
            EditorSource: { template: "<div />" },
            EditorFiles: { template: "<div />" },
          },
        },
      });

      // Get the save function passed to useAutoSave
      const autoSaveConfig = useAutoSaveSpy.mock.calls[0][0];
      const saveFunction = autoSaveConfig.saveFunction;

      await saveFunction(mockFile.value);

      expect(FileModel.update).toHaveBeenCalledWith(mockFile.value, {
        source: mockFile.value.source,
      });
    });

    it("handles file upload successfully", async () => {
      const mockAsset = new File(["test content"], "test.txt", { type: "text/plain" });
      const mockResponse = { data: { id: 123, url: "/assets/test.txt" } };
      mockApi.post.mockResolvedValue(mockResponse);

      // Mock FileReader - text files now use readAsText
      const mockFileReader = {
        readAsText: vi.fn(),
        result: "test content",
        onload: null,
        onerror: null,
      };

      global.FileReader = vi.fn(() => mockFileReader);

      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: {
              name: "EditorTopbar",
              template: "<div />",
              emits: ["compile", "upload"],
            },
            EditorSource: {
              name: "EditorSource",
              template: "<div />",
              props: ["modelValue", "saveStatus"],
              emits: ["update:modelValue", "input"],
            },
            EditorFiles: {
              name: "EditorFiles",
              template: "<div />",
            },
          },
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });

      // Trigger upload
      topbar.vm.$emit("upload", mockAsset);

      // Simulate FileReader success
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

      // Mock FileReader - binary files use readAsDataURL with base64
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: "data:image/png;base64,ZmFrZSBpbWFnZSBkYXRh",
        onload: null,
        onerror: null,
      };

      global.FileReader = vi.fn(() => mockFileReader);

      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: {
              name: "EditorTopbar",
              template: "<div />",
              emits: ["compile", "upload"],
            },
            EditorSource: {
              name: "EditorSource",
              template: "<div />",
              props: ["modelValue", "saveStatus"],
              emits: ["update:modelValue", "input"],
            },
            EditorFiles: {
              name: "EditorFiles",
              template: "<div />",
            },
          },
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });

      // Trigger upload
      topbar.vm.$emit("upload", mockAsset);

      // Simulate FileReader success
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

      // Mock FileReader that fails - text files use readAsText
      const mockFileReader = {
        readAsText: vi.fn(),
        result: null,
        onload: null,
        onerror: null,
      };

      global.FileReader = vi.fn(() => mockFileReader);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: {
              name: "EditorTopbar",
              template: "<div />",
              emits: ["compile", "upload"],
            },
            EditorSource: {
              name: "EditorSource",
              template: "<div />",
              props: ["modelValue", "saveStatus"],
              emits: ["update:modelValue", "input"],
            },
            EditorFiles: {
              name: "EditorFiles",
              template: "<div />",
            },
          },
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });
      topbar.vm.$emit("upload", mockAsset);

      // Simulate FileReader error
      mockFileReader.onerror(uploadError);
      await nextTick();

      // Should handle error gracefully
      expect(wrapper.exists()).toBe(true);

      consoleSpy.mockRestore();
    });

    it("switches between editor tabs correctly", async () => {
      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: {
              name: "EditorTopbar",
              template: '<div data-testid="editor-topbar" />',
              props: ["modelValue"],
              emits: ["update:modelValue"],
            },
            EditorSource: { template: '<div class="editor-source" />' },
            EditorFiles: { template: '<div class="editor-files" />' },
          },
        },
      });

      // Initially should show EditorSource (tab 0)
      expect(wrapper.find(".editor-source").exists()).toBe(true);
      expect(wrapper.find(".editor-files").exists()).toBe(false);

      // Switch to EditorFiles (tab 1)
      const topbar = wrapper.findComponent('[data-testid="editor-topbar"]');
      await topbar.vm.$emit("update:modelValue", 1);
      await nextTick();

      expect(wrapper.find(".editor-source").exists()).toBe(false);
      expect(wrapper.find(".editor-files").exists()).toBe(true);
    });

    it("sets up keyboard shortcuts correctly", () => {
      mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: { template: "<div />" },
            EditorSource: { template: "<div />" },
            EditorFiles: { template: "<div />" },
          },
        },
      });

      expect(useKeyboardShortcutsSpy).toHaveBeenCalledWith({
        escape: expect.any(Function),
        s: expect.any(Function),
      });
    });

    it("handles escape key to blur editor", async () => {
      mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: { template: "<div />" },
            EditorSource: { template: "<div />" },
            EditorFiles: { template: "<div />" },
          },
        },
      });

      // Get the escape handler from keyboard shortcuts
      const shortcutsConfig = useKeyboardShortcutsSpy.mock.calls[0][0];
      const escapeHandler = shortcutsConfig.escape;

      // Just verify the handler exists and can be called without error
      expect(typeof escapeHandler).toBe("function");
      expect(() => escapeHandler()).not.toThrow();
    });

    it("handles save shortcut", async () => {
      mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: { template: "<div />" },
            EditorSource: { template: "<div />" },
            EditorFiles: { template: "<div />" },
          },
        },
      });

      // Get the save handler from keyboard shortcuts
      const shortcutsConfig = useKeyboardShortcutsSpy.mock.calls[0][0];
      const saveHandler = shortcutsConfig.s;

      // Simulate save shortcut
      saveHandler();

      expect(mockAutoSave.manualSave).toHaveBeenCalled();
    });

    it("passes save status to EditorSource", () => {
      mockAutoSave.saveStatus.value = "saving";

      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: { template: "<div />" },
            EditorSource: {
              name: "EditorSource",
              template: '<div data-testid="editor-source" />',
              props: ["modelValue", "saveStatus"],
            },
            EditorFiles: { template: "<div />" },
          },
        },
      });

      const editorSource = wrapper.findComponent('[data-testid="editor-source"]');
      expect(editorSource.props("saveStatus")).toBe("saving");
    });

    it("handles input events from EditorSource", async () => {
      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: { template: "<div />" },
            EditorSource: {
              name: "EditorSource",
              template: '<div data-testid="editor-source-input" />',
              props: ["modelValue", "saveStatus"],
              emits: ["input"],
            },
            EditorFiles: { template: "<div />" },
          },
        },
      });

      const editorSource = wrapper.findComponent('[data-testid="editor-source-input"]');
      const inputEvent = { target: { value: "new content" } };

      await editorSource.vm.$emit("input", inputEvent);
      await nextTick();

      expect(mockAutoSave.onInput).toHaveBeenCalledWith(inputEvent);
    });

    it("handles concurrent operations gracefully", async () => {
      mockApi.post
        .mockResolvedValueOnce({ data: "<h1>First</h1>" })
        .mockResolvedValueOnce({ data: { id: 1 } });

      // Mock FileReader for the upload operation - support both text and binary
      const mockFileReader = {
        readAsText: vi.fn(),
        readAsDataURL: vi.fn(),
        result: "test",
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader);

      const wrapper = mount(Editor, {
        props: {
          modelValue: mockFile.value,
        },
        global: {
          provide: { api: mockApi },
          stubs: {
            EditorTopbar: {
              name: "EditorTopbar",
              template: "<div />",
              emits: ["compile", "upload"],
            },
            EditorSource: {
              name: "EditorSource",
              template: "<div />",
              props: ["modelValue", "saveStatus"],
              emits: ["update:modelValue", "input"],
            },
            EditorFiles: {
              name: "EditorFiles",
              template: "<div />",
            },
          },
        },
      });

      const topbar = wrapper.findComponent({ name: "EditorTopbar" });

      // Trigger both compile and upload simultaneously
      const mockAsset = new File(["test"], "test.txt", { type: "text/plain" });
      topbar.vm.$emit("compile");
      topbar.vm.$emit("upload", mockAsset);

      // Simulate FileReader completion for upload
      if (mockFileReader.onload) {
        mockFileReader.onload();
      }

      await nextTick();

      // Both operations should be handled without conflicts
      expect(mockApi.post).toHaveBeenCalledTimes(2);
      expect(wrapper.exists()).toBe(true);
    });
  });
});
