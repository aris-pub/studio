// src/tests/unit/FileStore.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createFileStore } from "@/store/FileStore.js";
import { File } from "@/models/File.js";

// Mock Vue reactivity functions
vi.mock("vue", () => ({
  ref: vi.fn((value) => ({ value })),
  computed: vi.fn((fn) => ({ value: fn() })),
  reactive: vi.fn((obj) => {
    // Handle Set objects properly - return the actual Set
    if (obj instanceof Set) {
      return obj;
    }
    // For other objects, return a simple reactive-like wrapper
    return new Proxy(obj, {
      get(target, prop) {
        return target[prop];
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
  }),
}));

// Mock File class
vi.mock("@/models/File.js", () => ({
  File: vi.fn().mockImplementation((data) => ({
    ...data,
    id: data.id || Math.random(),
    selected: data.selected || false,
    filtered: data.filtered || false,
    tags: data.tags || [],
    last_edited_at: data.last_edited_at || new Date().toISOString(),
  })),
}));

// Mock File static methods
const mockFileSave = vi.fn();
const mockFileDelete = vi.fn();
const mockFileAddTag = vi.fn();
const mockFileRemoveTag = vi.fn();

File.save = mockFileSave;
File.delete = mockFileDelete;
File.addTag = mockFileAddTag;
File.removeTag = mockFileRemoveTag;

describe("FileStore", () => {
  let mockApi;
  let mockUser;
  let store;

  beforeEach(() => {
    // Reset mocks before each test
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockUser = { id: 123 };

    // Clear console.error mock
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset File static method mocks
    mockFileSave.mockClear();
    mockFileDelete.mockClear();
    mockFileAddTag.mockClear();
    mockFileRemoveTag.mockClear();

    // Reset File constructor mock
    File.mockClear();

    // Create fresh store for each test
    store = createFileStore(mockApi, mockUser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  describe("Store Creation", () => {
    it("creates a store with initial state", () => {
      expect(store.files.value).toEqual([]);
      expect(store.tags.value).toEqual([]);
      expect(store.numFiles.value).toBe(0);
    });

    it("provides all required methods", () => {
      const expectedMethods = [
        "loadFiles",
        "createFile",
        "deleteFile",
        "sortFiles",
        "filterFiles",
        "clearFilters",
        "selectFile",
        "clearSelection",
        "getRecentFiles",
        "loadTags",
        "createTag",
        "updateTag",
        "getTags",
        "addTagToFile",
        "removeTagFromFile",
        "toggleFileTag",
      ];

      expectedMethods.forEach((method) => {
        expect(typeof store[method]).toBe("function");
      });
    });
  });

  describe("File Loading", () => {
    it("loads files from server successfully", async () => {
      const mockFiles = [
        { id: 1, title: "File 1", tags: [] },
        { id: 2, title: "File 2", tags: [] },
      ];
      mockApi.get.mockResolvedValue({ data: mockFiles });

      await store.loadFiles();

      expect(mockApi.get).toHaveBeenCalledWith(`/users/${mockUser.id}/files`, {
        params: { with_tags: true },
      });
      expect(store.files.value).toHaveLength(2);
      expect(File).toHaveBeenCalledTimes(2);
    });

    it("preserves existing file states when reloading", async () => {
      // Set up existing files with states
      store.files.value = [
        { id: 1, selected: true, filtered: true },
        { id: 2, selected: false, filtered: false },
      ];

      const mockFiles = [
        { id: 1, title: "Updated File 1" },
        { id: 2, title: "Updated File 2" },
      ];
      mockApi.get.mockResolvedValue({ data: mockFiles });

      await store.loadFiles();

      expect(File).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          title: "Updated File 1",
          selected: true,
          filtered: true,
        }),
        store
      );
    });

    it("handles API errors gracefully", async () => {
      const error = new Error("API Error");
      mockApi.get.mockRejectedValue(error);

      await store.loadFiles();

      expect(console.error).toHaveBeenCalledWith("Error loading files:", error);
    });
  });

  describe("File Creation", () => {
    it("creates a new file with default data", async () => {
      mockFileSave.mockResolvedValue(true);

      const newFile = await store.createFile();

      expect(store.files.value).toHaveLength(1);
      expect(File).toHaveBeenCalledWith(
        expect.objectContaining({
          last_edited_at: expect.any(String),
        }),
        store
      );
      expect(mockFileSave).toHaveBeenCalledWith(newFile, mockApi, mockUser);
    });

    it("creates a new file with provided data", async () => {
      mockFileSave.mockResolvedValue(true);
      const fileData = { title: "New File", source: "content" };

      await store.createFile(fileData);
      expect(File).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New File",
          source: "content",
          last_edited_at: expect.any(String),
        }),
        store
      );
    });
  });

  describe("File Deletion", () => {
    beforeEach(() => {
      store.files.value = [
        { id: 1, title: "File 1" },
        { id: 2, title: "File 2" },
      ];
    });

    it("deletes file by object", async () => {
      mockFileDelete.mockResolvedValue(true);
      const fileToDelete = store.files.value[0];

      await store.deleteFile(fileToDelete);

      expect(mockFileDelete).toHaveBeenCalledWith(fileToDelete, mockApi, mockUser);
      expect(store.files.value).toHaveLength(1);
      expect(store.files.value[0].id).toBe(2);
    });

    it("deletes file by ID", async () => {
      mockFileDelete.mockResolvedValue(true);

      await store.deleteFile(1);

      expect(store.files.value).toHaveLength(1);
      expect(store.files.value[0].id).toBe(2);
    });

    it("does nothing when file not found", async () => {
      await store.deleteFile(999);

      expect(mockFileDelete).not.toHaveBeenCalled();
      expect(store.files.value).toHaveLength(2);
    });

    it("does not remove file when deletion fails", async () => {
      mockFileDelete.mockResolvedValue(false);

      await store.deleteFile(1);

      expect(store.files.value).toHaveLength(2);
    });
  });

  describe("File Sorting and Filtering", () => {
    beforeEach(() => {
      store.files.value = [
        { id: 1, title: "B File", filtered: false },
        { id: 2, title: "A File", filtered: false },
        { id: 3, title: "C File", filtered: false },
      ];
    });

    it("sorts files with provided compare function", () => {
      const compareFunc = (a, b) => a.title.localeCompare(b.title);
      store.sortFiles(compareFunc);

      expect(store.files.value[0].title).toBe("A File");
      expect(store.files.value[1].title).toBe("B File");
      expect(store.files.value[2].title).toBe("C File");
    });

    it("filters files with provided filter function", () => {
      const filterFunc = (file) => file.title.startsWith("A");
      store.filterFiles(filterFunc);

      expect(store.files.value[0].filtered).toBe(false); // B File - filtered out
      expect(store.files.value[1].filtered).toBe(true); // A File - shown
      expect(store.files.value[2].filtered).toBe(false); // C File - filtered out
    });

    it("clears all filters", () => {
      // Set some files as filtered
      store.files.value[0].filtered = true;
      store.files.value[1].filtered = true;

      store.clearFilters();

      store.files.value.forEach((file) => {
        expect(file.filtered).toBe(false);
      });
    });
  });

  describe("File Selection", () => {
    beforeEach(() => {
      store.files.value = [
        { id: 1, selected: false },
        { id: 2, selected: true },
        { id: 3, selected: false },
      ];
    });

    it("selects a file and deselects others", () => {
      const fileToSelect = store.files.value[0];
      store.selectFile(fileToSelect);

      expect(store.files.value[0].selected).toBe(true);
      expect(store.files.value[1].selected).toBe(false);
      expect(store.files.value[2].selected).toBe(false);
    });

    it("does nothing if file is already selected", () => {
      const alreadySelected = store.files.value[1];
      store.selectFile(alreadySelected);

      expect(store.files.value[1].selected).toBe(true);
    });

    it("clears selection", () => {
      store.clearSelection();

      store.files.value.forEach((file) => {
        expect(file.selected).toBe(false);
      });
    });
  });

  describe("Recent Files", () => {
    beforeEach(() => {
      const now = new Date();
      store.files.value = [
        { id: 1, last_edited_at: new Date(now - 3600000).toISOString() }, // 1 hour ago
        { id: 2, last_edited_at: new Date(now - 7200000).toISOString() }, // 2 hours ago
        { id: 3, last_edited_at: new Date(now - 1800000).toISOString() }, // 30 min ago
        { id: 4, last_edited_at: new Date(now - 10800000).toISOString() }, // 3 hours ago
      ];
    });

    it("returns most recent files in order", () => {
      const recent = store.getRecentFiles(3);

      expect(recent).toHaveLength(3);
      expect(recent[0].id).toBe(3); // Most recent
      expect(recent[1].id).toBe(1);
      expect(recent[2].id).toBe(2);
    });

    it("returns default of 5 files when no count specified", () => {
      const recent = store.getRecentFiles();

      expect(recent).toHaveLength(4); // We only have 4 files
    });

    it("does not mutate original files array", () => {
      const originalOrder = store.files.value.map((f) => f.id);
      store.getRecentFiles();

      expect(store.files.value.map((f) => f.id)).toEqual(originalOrder);
    });
  });

  describe("Tag Management", () => {
    it("loads tags from server", async () => {
      const mockTags = [
        { id: 1, name: "Tag 1" },
        { id: 2, name: "Tag 2" },
      ];
      mockApi.get.mockResolvedValue({ data: mockTags });

      await store.loadTags();

      expect(mockApi.get).toHaveBeenCalledWith(`/users/${mockUser.id}/tags`);
      expect(store.tags.value).toEqual(mockTags);
    });

    it("handles tag loading errors", async () => {
      const error = new Error("Tag load error");
      mockApi.get.mockRejectedValue(error);

      await store.loadTags();

      expect(console.error).toHaveBeenCalledWith("Error loading tags:", error);
    });

    it("creates a new tag", async () => {
      mockApi.post.mockResolvedValue({});
      mockApi.get.mockResolvedValue({ data: [] }); // for loadTags call

      await store.createTag("New Tag", "#ff0000");

      expect(mockApi.post).toHaveBeenCalledWith(`/users/${mockUser.id}/tags`, {
        name: "New Tag",
        color: "#ff0000",
      });
    });

    it("creates tag with default empty color", async () => {
      mockApi.post.mockResolvedValue({});
      mockApi.get.mockResolvedValue({ data: [] });

      await store.createTag("New Tag");

      expect(mockApi.post).toHaveBeenCalledWith(`/users/${mockUser.id}/tags`, {
        name: "New Tag",
        color: "",
      });
    });

    it("updates existing tag", async () => {
      const oldTag = { id: 1, name: "Old Tag" };
      const newTag = { name: "Updated Tag" };
      store.tags.value = [oldTag];

      mockApi.put.mockResolvedValue({});
      mockApi.get.mockResolvedValue({ data: [] });

      await store.updateTag(oldTag, newTag);

      expect(mockApi.put).toHaveBeenCalledWith(`/users/${mockUser.id}/tags/1`, newTag);
    });

    it("deletes tag when newTag is null", async () => {
      const oldTag = { id: 1, name: "Tag to delete" };
      store.tags.value = [oldTag];

      mockApi.delete.mockResolvedValue({});
      mockApi.get.mockResolvedValue({ data: [] });

      await store.updateTag(oldTag, null);

      expect(mockApi.delete).toHaveBeenCalledWith(`/users/${mockUser.id}/tags/1`);
    });

    it("reloads tags when oldTag is null", async () => {
      mockApi.get.mockResolvedValue({ data: [] });

      await store.updateTag(null, { name: "Some tag" });

      expect(mockApi.get).toHaveBeenCalledWith(`/users/${mockUser.id}/tags`);
    });

    it("returns all tags", () => {
      const mockTags = [{ id: 1, name: "Tag 1" }];
      store.tags.value = mockTags;

      expect(store.getTags()).toEqual(mockTags);
    });
  });

  describe("File Tag Operations", () => {
    let mockFile;

    beforeEach(() => {
      mockFile = { id: 1, tags: [{ id: 1 }, { id: 2 }] };
    });

    it("adds tag to file", async () => {
      mockFileAddTag.mockResolvedValue(true);

      await store.addTagToFile(mockFile, 3);

      expect(mockFileAddTag).toHaveBeenCalledWith(mockFile, 3, mockApi, mockUser);
    });

    it("removes tag from file", async () => {
      mockFileRemoveTag.mockResolvedValue(true);

      await store.removeTagFromFile(mockFile, 1);

      expect(mockFileRemoveTag).toHaveBeenCalledWith(mockFile, 1, mockApi, mockUser);
    });

    it("toggles tag on file - removes existing tag", async () => {
      mockFileRemoveTag.mockResolvedValue(true);

      await store.toggleFileTag(mockFile, 1);

      expect(mockFileRemoveTag).toHaveBeenCalledWith(mockFile, 1, mockApi, mockUser);
      expect(mockFileAddTag).not.toHaveBeenCalled();
    });

    it("toggles tag on file - adds new tag", async () => {
      mockFileAddTag.mockResolvedValue(true);

      await store.toggleFileTag(mockFile, 3);

      expect(mockFileAddTag).toHaveBeenCalledWith(mockFile, 3, mockApi, mockUser);
      expect(mockFileRemoveTag).not.toHaveBeenCalled();
    });
  });
});
