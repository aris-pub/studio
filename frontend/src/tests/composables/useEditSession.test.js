import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { useEditSession } from "@/composables/useEditSession.js";

describe("useEditSession", () => {
  let mockApi;
  let mockUser;
  const fileId = 123;

  beforeEach(() => {
    mockApi = {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
    };
    mockUser = { id: 1, email: "test@example.com" };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("HTTP implementation", () => {
    it("should initialize with empty content and idle status", () => {
      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
      });

      expect(session.content.value).toBe("");
      expect(session.status.value).toBe("idle");
      expect(session.isConnected.value).toBe(false);
    });

    it("should load content on start", async () => {
      mockApi.get.mockResolvedValue({
        data: { id: fileId, source: "Hello world", title: "Test" },
      });

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
      });

      await session.start();

      expect(mockApi.get).toHaveBeenCalledWith(`/files/${fileId}`);
      expect(session.content.value).toBe("Hello world");
      expect(session.status.value).toBe("idle");
    });

    it("should debounce saves when content changes", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
        debounceTime: 2000,
      });

      await session.start();

      // Change content
      session.content.value = "updated content";
      await nextTick();

      // Should not save immediately
      expect(mockApi.put).not.toHaveBeenCalled();
      expect(session.status.value).toBe("pending");

      // Advance time by debounce duration
      vi.advanceTimersByTime(2000);
      await nextTick();

      // Should save after debounce
      expect(mockApi.put).toHaveBeenCalledWith(`/files/${fileId}`, {
        source: "updated content",
      });
      expect(session.status.value).toBe("saved");
    });

    it("should reset debounce timer on multiple changes", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
        debounceTime: 2000,
      });

      await session.start();

      // First change
      session.content.value = "change 1";
      await nextTick();

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      // Second change (should reset timer)
      session.content.value = "change 2";
      await nextTick();

      // Advance another 1 second (total 2s from first change, 1s from second)
      vi.advanceTimersByTime(1000);
      await nextTick();

      // Should not have saved yet (timer was reset)
      expect(mockApi.put).not.toHaveBeenCalled();

      // Advance final 1 second (2s from second change)
      vi.advanceTimersByTime(1000);
      await nextTick();

      // Now should save
      expect(mockApi.put).toHaveBeenCalledWith(`/files/${fileId}`, {
        source: "change 2",
      });
    });

    it("should auto-save on interval", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
        debounceTime: 2000,
        autoSaveInterval: 30000,
      });

      await session.start();

      // Change content
      session.content.value = "updated";
      await nextTick();

      // Advance time by interval (triggers auto-save)
      vi.advanceTimersByTime(30000);
      await nextTick();

      expect(mockApi.put).toHaveBeenCalled();
    });

    it("should support manual save", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
        debounceTime: 2000,
      });

      await session.start();

      // Change content
      session.content.value = "updated";
      await nextTick();

      // Manual save (should bypass debounce)
      await session.manualSave();

      expect(mockApi.put).toHaveBeenCalledWith(`/files/${fileId}`, {
        source: "updated",
      });
      expect(session.status.value).toBe("saved");
    });

    it("should handle save errors", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockRejectedValue(new Error("Network error"));

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
      });

      await session.start();

      session.content.value = "updated";
      await nextTick();

      await session.manualSave();

      expect(session.status.value).toBe("error");
    });

    it("should trigger compile callback after save", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const onCompile = vi.fn().mockResolvedValue(undefined);

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
        debounceTime: 2000,
        onCompile,
      });

      await session.start();

      session.content.value = "updated";
      await nextTick();

      vi.advanceTimersByTime(2000);
      await nextTick();

      expect(onCompile).toHaveBeenCalled();
    });

    it("should handle onCompile errors gracefully", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const onCompile = vi.fn().mockRejectedValue(new Error("Compilation failed"));

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
        onCompile,
      });

      await session.start();
      session.content.value = "updated";

      await session.manualSave();

      expect(session.status.value).toBe("error");
      expect(onCompile).toHaveBeenCalled();
    });

    it("should cleanup timers on stop", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
        debounceTime: 2000,
      });

      await session.start();

      // Change content
      session.content.value = "updated";
      await nextTick();
      expect(session.status.value).toBe("pending");

      // Stop session (will save pending changes)
      await session.stop();

      // Change content again after stop
      session.content.value = "more changes";
      await nextTick();

      // Advance time - no new saves should happen after stop
      vi.advanceTimersByTime(5000);
      await nextTick();

      // Should only have been called once (during stop), not again
      expect(mockApi.put).toHaveBeenCalledTimes(1);
    });

    it("should save pending changes on stop", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
      });

      await session.start();

      session.content.value = "updated";
      await nextTick();

      await session.stop();

      // Should save pending changes before stopping
      expect(mockApi.put).toHaveBeenCalledWith(`/files/${fileId}`, {
        source: "updated",
      });
    });

    it("should transition status from pending → saving → saved", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });

      // Create a delayed promise to observe 'saving' state
      let resolvePut;
      const putPromise = new Promise((resolve) => {
        resolvePut = resolve;
      });
      mockApi.put.mockReturnValue(putPromise);

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
      });

      await session.start();

      // Initial
      expect(session.status.value).toBe("idle");

      // Change content
      session.content.value = "updated";
      await nextTick();
      expect(session.status.value).toBe("pending");

      // Trigger save
      const savePromise = session.manualSave();
      await nextTick();
      expect(session.status.value).toBe("saving");

      // Complete save
      resolvePut({ data: { success: true } });
      await savePromise;
      expect(session.status.value).toBe("saved");
    });

    it("should reset status to idle after 3 seconds", async () => {
      mockApi.get.mockResolvedValue({ data: { source: "initial" } });
      mockApi.put.mockResolvedValue({ data: { success: true } });

      const session = useEditSession(fileId, {
        implementation: "http",
        api: mockApi,
        user: mockUser,
      });

      await session.start();
      await session.manualSave();

      expect(session.status.value).toBe("saved");

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(session.status.value).toBe("idle");
    });
  });
});
