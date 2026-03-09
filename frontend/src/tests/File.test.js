// src/tests/unit/File.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { File } from "@/models/File.js";

// Mock the Vue reactive function
vi.mock("vue", () => ({
  reactive: vi.fn((obj) => obj),
}));

// Mock the external dependencies
vi.mock("@yaireo/relative-time", () => ({
  default: vi.fn().mockImplementation(() => ({
    from: vi.fn(() => "2 hours ago"),
  })),
}));

vi.mock("@/composables/useCasing.js", () => ({
  useSnakeCase: vi.fn(() => ({ snake_case: "converted" })),
  useCamelCase: vi.fn(() => ({ camelCase: "converted" })),
}));

describe("File", () => {
  let mockFileStore;
  let mockApi;
  let mockUser;
  let mockRouter;

  beforeEach(() => {
    // Reset mocks before each test
    mockFileStore = {
      queueSync: vi.fn(),
      tags: { value: [{ id: 1, name: "test-tag", created_at: "2024-01-01" }] },
    };

    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockUser = { id: 123 };
    mockRouter = { push: vi.fn() };

    // Clear console.error mock
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("creates a file with default values when no data provided", () => {
      const file = new File();

      expect(file.id).toBeNull();
      expect(file.title).toBeUndefined();
      expect(file.source).toBe("");
      expect(file.tags).toEqual([]);
      expect(file.selected).toBe(false);
      expect(file.filtered).toBe(false);
    });

    it("creates a file with provided raw data", () => {
      const rawData = {
        id: "test-id",
        title: "Test File",
        source: "file content",
        tags: ["tag1", "tag2"],
        owner_id: 456,
      };

      const file = new File(rawData);

      expect(file.id).toBe("test-id");
      expect(file.title).toBe("Test File");
      expect(file.source).toBe("file content");
      expect(file.tags).toEqual(["tag1", "tag2"]);
      expect(file.ownerId).toBe(456);
    });

    it("sets last_edited_at to current time when not provided", () => {
      const beforeCreate = Date.now();
      const file = new File();
      const afterCreate = Date.now();

      const fileTime = new Date(file.last_edited_at).getTime();
      expect(fileTime).toBeGreaterThanOrEqual(beforeCreate);
      expect(fileTime).toBeLessThanOrEqual(afterCreate);
    });
  });

  describe("Date Methods", () => {
    it("getFormattedDate returns relative time", () => {
      const file = new File({ last_edited_at: "2024-01-01T10:00:00Z" });

      const result = file.getFormattedDate();

      expect(result).toBe("2 hours ago");
    });

    it("getFullDateTime returns formatted local date", () => {
      const file = new File({ last_edited_at: "2024-01-01T10:00:00Z" });

      const result = file.getFullDateTime();

      // Just check it returns a string (actual format depends on locale)
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Unseen tracking", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    describe("isUnseen", () => {
      it("returns false for OWNER files", () => {
        expect(File.isUnseen({ id: 1, role: "OWNER" })).toBe(false);
      });

      it("returns true for shared files not yet seen", () => {
        expect(File.isUnseen({ id: 1, role: "EDITOR" })).toBe(true);
      });

      it("returns false for shared files already seen", () => {
        localStorage.setItem("seenFileIds", JSON.stringify([1]));
        expect(File.isUnseen({ id: 1, role: "EDITOR" })).toBe(false);
      });
    });

    describe("markSeen", () => {
      it("clears unseen flag and persists to localStorage", () => {
        const file = { id: 42, unseen: true };
        File.markSeen(file);

        expect(file.unseen).toBe(false);
        expect(JSON.parse(localStorage.getItem("seenFileIds"))).toContain(42);
      });

      it("does nothing if file is not unseen", () => {
        const file = { id: 42, unseen: false };
        File.markSeen(file);

        expect(localStorage.getItem("seenFileIds")).toBeNull();
      });

      it("does not duplicate IDs in localStorage", () => {
        localStorage.setItem("seenFileIds", JSON.stringify([42]));
        const file = { id: 42, unseen: true };
        File.markSeen(file);

        expect(JSON.parse(localStorage.getItem("seenFileIds"))).toEqual([42]);
      });
    });
  });

  describe("Static Methods", () => {
    describe("update", () => {
      it("updates file properties and queues sync", async () => {
        const file = { id: "test", title: "old title" };
        const changes = { title: "new title", source: "new content" };

        const result = await File.update(file, changes);

        expect(file.title).toBe("new title");
        expect(file.source).toBe("new content");
        expect(result).toBe(file);
      });

      it("calls fileStore.queueSync when store is available", async () => {
        // Set up global fileStore
        const file = new File({}, mockFileStore);
        const changes = { title: "updated" };

        await File.update(file, changes);

        expect(mockFileStore.queueSync).toHaveBeenCalledWith(file);
      });
    });

    describe("save", () => {
      it("creates new file when no id exists", async () => {
        const file = { title: "New File", source: "content" };
        mockApi.post.mockResolvedValue({ data: { id: "new-id", title: "New File" } });

        const result = await File.save(file, mockApi, mockUser);

        expect(mockApi.post).toHaveBeenCalledWith("/files", {
          title: "New File",
          source: "content",
          owner_id: 123,
          tags: [],
        });
        expect(file.id).toBe("new-id");
        expect(result).toBe(true);
      });

      it("updates existing file when id exists", async () => {
        const file = { id: "existing-id", title: "Updated File" };
        mockApi.put.mockResolvedValue({});

        const result = await File.save(file, mockApi, mockUser);

        expect(mockApi.put).toHaveBeenCalledWith("/files/existing-id", {
          id: "existing-id",
          title: "Updated File",
          owner_id: 123,
          tags: [],
        });
        expect(result).toBe(true);
      });

      it("handles save errors gracefully", async () => {
        const file = { title: "Test" };
        mockApi.post.mockRejectedValue(new Error("Network error"));

        const result = await File.save(file, mockApi, mockUser);

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe("delete", () => {
      it("deletes file with id", async () => {
        const file = { id: "test-id" };
        mockApi.delete.mockResolvedValue({});

        const result = await File.delete(file, mockApi, mockUser);

        expect(mockApi.delete).toHaveBeenCalledWith("/files/test-id");
        expect(result).toBe(true);
      });

      it("returns true for file without id", async () => {
        const file = { title: "No ID File" };

        const result = await File.delete(file, mockApi, mockUser);

        expect(mockApi.delete).not.toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it("handles delete errors gracefully", async () => {
        const file = { id: "test-id" };
        mockApi.delete.mockRejectedValue(new Error("Not found"));

        const result = await File.delete(file, mockApi, mockUser);

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe("select", () => {
      it("sets selected to true when not already selected", () => {
        const file = { selected: false };

        File.select(file);

        expect(file.selected).toBe(true);
      });

      it("keeps selected true when already selected", () => {
        const file = { selected: true };

        File.select(file);

        expect(file.selected).toBe(true);
      });
    });

    describe("addTag", () => {
      beforeEach(() => {
        // Set up file store for tag operations
        new File({}, mockFileStore);
      });

      it("adds tag to file when not already present", async () => {
        const file = { id: "file-id", tags: [] };
        mockApi.post.mockResolvedValue({});

        const result = await File.addTag(file, 1, mockApi, mockUser);

        expect(mockApi.post).toHaveBeenCalledWith("/users/123/files/file-id/tags/1");
        expect(file.tags).toHaveLength(1);
        expect(file.tags[0].id).toBe(1);
        expect(result).toBe(true);
      });

      it("returns false when tag already exists", async () => {
        const file = { tags: [{ id: 1 }] };

        const result = await File.addTag(file, 1, mockApi, mockUser);

        expect(mockApi.post).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it("handles API errors gracefully", async () => {
        const file = { id: "file-id", tags: [] };
        mockApi.post.mockRejectedValue(new Error("Server error"));

        const result = await File.addTag(file, 1, mockApi, mockUser);

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe("removeTag", () => {
      it("removes tag from file when present", async () => {
        const file = { id: "file-id", tags: [{ id: 1 }, { id: 2 }] };
        mockApi.delete.mockResolvedValue({});

        const result = await File.removeTag(file, 1, mockApi, mockUser);

        expect(mockApi.delete).toHaveBeenCalledWith("/users/123/files/file-id/tags/1");
        expect(file.tags).toHaveLength(1);
        expect(file.tags[0].id).toBe(2);
        expect(result).toBe(true);
      });

      it("returns false when tag not present", async () => {
        const file = { tags: [{ id: 2 }] };

        const result = await File.removeTag(file, 1, mockApi, mockUser);

        expect(mockApi.delete).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });
    });

    describe("openFile", () => {
      it("navigates to file route", () => {
        const file = { id: "test-id", unseen: false };

        File.openFile(file, mockRouter);

        expect(mockRouter.push).toHaveBeenCalledWith("/file/test-id");
      });

      it("marks unseen file as seen on open", () => {
        localStorage.clear();
        const file = { id: "test-id", unseen: true };

        File.openFile(file, mockRouter);

        expect(file.unseen).toBe(false);
        expect(JSON.parse(localStorage.getItem("seenFileIds"))).toContain("test-id");
      });
    });

    describe("getSettings", () => {
      it("fetches settings when not cached", async () => {
        const file = { id: "file-id", _settings: null };
        mockApi.get.mockResolvedValue({ data: { some_setting: "value" } });

        const result = await File.getSettings(file, mockApi);

        expect(mockApi.get).toHaveBeenCalledWith("/settings/file-id");
        expect(result).toEqual({ camelCase: "converted" });
        expect(file._settings).toEqual({ camelCase: "converted" });
      });

      it("uses defaults URL when file has no id", async () => {
        const file = { _settings: null };
        mockApi.get.mockResolvedValue({ data: { default_setting: "value" } });

        await File.getSettings(file, mockApi);

        expect(mockApi.get).toHaveBeenCalledWith("/settings/defaults");
      });

      it("returns cached settings when available", async () => {
        const cachedSettings = { cached: true };
        const file = { _settings: cachedSettings };

        const result = await File.getSettings(file, mockApi);

        expect(mockApi.get).not.toHaveBeenCalled();
        expect(result).toBe(cachedSettings);
      });
    });

    describe("updateSettings", () => {
      it("updates file settings", async () => {
        const file = { id: "file-id" };
        const newSettings = { theme: "dark" };
        mockApi.post.mockResolvedValue({});

        await File.updateSettings(file, newSettings, mockApi);

        expect(mockApi.post).toHaveBeenCalledWith("/settings/file-id", { snake_case: "converted" });
      });

      it("throws error when file has no id", async () => {
        const file = {};
        const newSettings = { theme: "dark" };

        await expect(File.updateSettings(file, newSettings, mockApi)).rejects.toThrow(
          "file id is undefined"
        );
      });
    });

    describe("updateDefaultSettings", () => {
      it("updates default settings", async () => {
        const newSettings = { theme: "light" };
        mockApi.post.mockResolvedValue({});

        await File.updateDefaultSettings(newSettings, mockApi);

        expect(mockApi.post).toHaveBeenCalledWith("/settings/defaults", {
          snake_case: "converted",
        });
      });
    });

    describe("toJSON", () => {
      it("converts file to plain object with tag IDs", () => {
        const file = {
          id: "test-id",
          title: "Test File",
          source: "content",
          ownerId: 123,
          tags: [
            { id: 1, name: "tag1" },
            { id: 2, name: "tag2" },
          ],
          selected: true, // Should not be included
          filtered: false, // Should not be included
        };

        const result = File.toJSON(file);

        expect(result).toEqual({
          id: "test-id",
          title: "Test File",
          source: "content",
          ownerId: 123,
          tags: [1, 2],
        });
      });

      it("handles mixed tag formats", () => {
        const file = {
          tags: [{ id: 1 }, 2, { id: 3 }], // Mixed objects and IDs
        };

        const result = File.toJSON(file);

        expect(result.tags).toEqual([1, 2, 3]);
      });

      it("handles empty or null tags", () => {
        const file1 = { tags: null };
        const file2 = { tags: undefined };

        expect(File.toJSON(file1).tags).toEqual([]);
        expect(File.toJSON(file2).tags).toEqual([]);
      });
    });
  });
});
