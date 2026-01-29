import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import WorkspaceView from "@/views/workspace/View.vue";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";

// Mock vue-router
const createMockRoute = (fileId) => ({
  params: { file_id: fileId },
});

const pushMock = vi.fn();
const mockRouter = () => ({ push: pushMock });

import { useRoute } from "vue-router";

vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(() => mockRouter()),
}));

// Mock other dependencies
vi.mock("@/models/File.js", () => ({
  File: {
    getSettings: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/views/workspace/EditorCodeMirror.vue", () => ({
  default: {
    name: "EditorCodeMirror",
    template: "<div />",
  },
}));

describe("WorkspaceView File ID Matching Regression Tests", () => {
  let useRouteMock;
  const api = { post: vi.fn() };

  beforeEach(() => {
    vi.spyOn(KSMod, "useKeyboardShortcuts").mockImplementation(() => {});
    useRouteMock = vi.mocked(useRoute);
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("string route param to numeric file ID matching", () => {
    it("should match string route param '42' to numeric file ID 42", () => {
      // This tests the exact bug that was fixed: route params are strings but file IDs are numbers
      useRouteMock.mockReturnValue(createMockRoute("42"));

      const fileStore = {
        value: {
          files: {
            file_42: { id: 42, title: "Test File 42" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      // Should successfully match and provide the file
      expect(wrapper.vm.file.id).toBe(42);
      expect(wrapper.vm.file.title).toBe("Test File 42");
    });

    it("should handle large numeric IDs correctly", () => {
      useRouteMock.mockReturnValue(createMockRoute("999999"));

      const fileStore = {
        value: {
          files: {
            file_999999: { id: 999999, title: "Large ID File" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      expect(wrapper.vm.file.id).toBe(999999);
      expect(wrapper.vm.file.title).toBe("Large ID File");
    });

    it("should handle leading zeros in route params", () => {
      useRouteMock.mockReturnValue(createMockRoute("007"));

      const fileStore = {
        value: {
          files: {
            file_7: { id: 7, title: "File Seven" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      // parseInt("007") should equal 7
      expect(wrapper.vm.file.id).toBe(7);
      expect(wrapper.vm.file.title).toBe("File Seven");
    });

    it("should return empty object for non-numeric route params", () => {
      useRouteMock.mockReturnValue(createMockRoute("not-a-number"));

      const fileStore = {
        value: {
          files: {
            file_42: { id: 42, title: "Test File" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      // parseInt("not-a-number") returns NaN, should return empty object
      expect(wrapper.vm.file).toEqual({});
      expect(wrapper.vm.file.id).toBeUndefined();
    });
  });

  describe("Object.values() vs direct array access", () => {
    it("should search through Object.values(files) not files directly", () => {
      useRouteMock.mockReturnValue(createMockRoute("123"));

      // Files is an object, not an array - the original bug was treating it like an array
      const fileStore = {
        value: {
          files: {
            item_1: { id: 1, title: "File One" },
            item_123: { id: 123, title: "Target File" },
            item_999: { id: 999, title: "File 999" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      // Should find file with id 123 regardless of object key structure
      expect(wrapper.vm.file.id).toBe(123);
      expect(wrapper.vm.file.title).toBe("Target File");
    });

    it("should handle mixed object key naming", () => {
      useRouteMock.mockReturnValue(createMockRoute("456"));

      const fileStore = {
        value: {
          files: {
            file_123: { id: 123, title: "File 123" },
            document_456: { id: 456, title: "Document 456" },
            random_key: { id: 789, title: "File 789" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      expect(wrapper.vm.file.id).toBe(456);
      expect(wrapper.vm.file.title).toBe("Document 456");
    });

    it("should return empty when file ID not found in object values", () => {
      useRouteMock.mockReturnValue(createMockRoute("999"));

      const fileStore = {
        value: {
          files: {
            file_1: { id: 1, title: "File One" },
            file_2: { id: 2, title: "File Two" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      // No file with id 999 exists
      expect(wrapper.vm.file).toEqual({});
      expect(wrapper.vm.file.id).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty files object", () => {
      useRouteMock.mockReturnValue(createMockRoute("42"));

      const fileStore = {
        value: {
          files: {},
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      expect(wrapper.vm.file).toEqual({});
    });

    it("should handle null/undefined files", () => {
      useRouteMock.mockReturnValue(createMockRoute("42"));

      const fileStore = {
        value: {
          files: null,
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      expect(wrapper.vm.file).toEqual({});
    });

    it("should handle missing route param", () => {
      useRouteMock.mockReturnValue({ params: {} });

      const fileStore = {
        value: {
          files: {
            file_42: { id: 42, title: "Test File" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      expect(wrapper.vm.file).toEqual({});
    });

    it("should handle zero as file ID (current bug: zero is treated as falsy)", () => {
      useRouteMock.mockReturnValue(createMockRoute("0"));

      const fileStore = {
        value: {
          files: {
            file_0: { id: 0, title: "File Zero" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      // CURRENT BUG: parseInt("0") returns 0, but !0 is true, so the function returns early
      // This documents the current (buggy) behavior - should be fixed to properly handle file ID 0
      expect(wrapper.vm.file).toEqual({});
      expect(wrapper.vm.file.id).toBeUndefined();

      // TODO: When fixed, this should be:
      // expect(wrapper.vm.file.id).toBe(0);
      // expect(wrapper.vm.file.title).toBe("File Zero");
    });
  });

  describe("original bug simulation (these would fail with the old code)", () => {
    it("would fail with original bug: string vs numeric comparison", () => {
      // Original bug: const found = files.find((f) => f.id === fileId);
      // where fileId was string "42" and f.id was number 42
      // This test verifies the fix works

      useRouteMock.mockReturnValue(createMockRoute("42"));

      const fileStore = {
        value: {
          files: {
            file_42: { id: 42, title: "Test File" }, // Note: id is number 42
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      // With the fix (parseInt), this should work
      expect(wrapper.vm.file.id).toBe(42);

      // Simulate what the old code would have done:
      const files = fileStore.value.files;
      const oldBugFileId = "42"; // No parseInt conversion
      const oldBugResult = Object.values(files).find((f) => f.id === oldBugFileId);

      // This would have been undefined with the old bug (42 !== "42")
      expect(oldBugResult).toBeUndefined();
    });

    it("would fail with original bug: wrong data structure access", () => {
      // Original bug: const found = files.find((f) => f.id === fileId);
      // where files was an object, not an array

      useRouteMock.mockReturnValue(createMockRoute("123"));

      const fileStore = {
        value: {
          files: {
            item_1: { id: 1, title: "File One" },
            item_123: { id: 123, title: "Target File" },
          },
          isLoading: false,
        },
      };

      const wrapper = mount(WorkspaceView, {
        global: {
          provide: { fileStore, api, mobileMode: false },
          stubs: { Sidebar: true, Canvas: true, Button: true },
        },
      });

      // With the fix (Object.values), this should work
      expect(wrapper.vm.file.id).toBe(123);

      // Simulate what the old code would have done:
      const files = fileStore.value.files;
      const fileId = 123;

      // Old bug: trying to call .find() on an object (not an array)
      // This would throw: TypeError: files.find is not a function
      expect(() => files.find((f) => f.id === fileId)).toThrow();
    });
  });
});
