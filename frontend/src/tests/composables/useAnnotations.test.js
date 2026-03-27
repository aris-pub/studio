import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, shallowRef, nextTick } from "vue";
import { useAnnotations } from "@/composables/useAnnotations.js";
import * as Y from "yjs";

describe("useAnnotations composable", () => {
  let api;
  let fileId;

  beforeEach(() => {
    api = {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
      put: vi.fn().mockResolvedValue({ data: { id: 1 } }),
      delete: vi.fn().mockResolvedValue({}),
    };
    fileId = ref(42);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("basic CRUD", () => {
    it("fetches annotations for the current file", async () => {
      const mockAnnotations = [{ id: 1, color: "purple" }, { id: 2, color: "blue" }];
      api.get.mockResolvedValue({ data: mockAnnotations });

      const { annotations, fetchAnnotations } = useAnnotations(fileId, api);
      await fetchAnnotations();

      expect(api.get).toHaveBeenCalledWith("/annotations/", { params: { file_id: 42 } });
      expect(annotations.value).toEqual(mockAnnotations);
    });

    it("does not fetch when fileId is null", async () => {
      fileId.value = null;
      const { fetchAnnotations } = useAnnotations(fileId, api);
      await fetchAnnotations();
      expect(api.get).not.toHaveBeenCalled();
    });

    it("creates annotation and adds to local state", async () => {
      const newAnnotation = { id: 3, color: "green" };
      api.post.mockResolvedValue({ data: newAnnotation });

      const { annotations, createAnnotation } = useAnnotations(fileId, api);
      const result = await createAnnotation({
        color: "green",
        anchorData: {},
        selectedText: "hello",
      });

      expect(result).toEqual(newAnnotation);
      expect(annotations.value).toContainEqual(newAnnotation);
    });

    it("deletes annotation and removes from local state", async () => {
      api.get.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });

      const { annotations, fetchAnnotations, deleteAnnotation } = useAnnotations(fileId, api);
      await fetchAnnotations();
      await deleteAnnotation(1);

      expect(annotations.value).toEqual([{ id: 2 }]);
    });

    it("updates annotation and replaces in local state", async () => {
      api.get.mockResolvedValue({ data: [{ id: 1, color: "purple" }, { id: 2, color: "blue" }] });
      api.put.mockResolvedValue({ data: { id: 1, color: "green" } });

      const { annotations, fetchAnnotations, updateAnnotation } = useAnnotations(fileId, api);
      await fetchAnnotations();
      const result = await updateAnnotation(1, { color: "green" });

      expect(api.put).toHaveBeenCalledWith("/annotations/1", { color: "green" });
      expect(result).toEqual({ id: 1, color: "green" });
      expect(annotations.value[0]).toEqual({ id: 1, color: "green" });
      expect(annotations.value[1]).toEqual({ id: 2, color: "blue" });
    });

    it("updateAnnotation handles non-existent id gracefully", async () => {
      api.get.mockResolvedValue({ data: [{ id: 1, color: "purple" }] });
      api.put.mockResolvedValue({ data: { id: 999, color: "green" } });

      const { annotations, fetchAnnotations, updateAnnotation } = useAnnotations(fileId, api);
      await fetchAnnotations();
      const result = await updateAnnotation(999, { color: "green" });

      expect(result).toEqual({ id: 999, color: "green" });
      // Original annotation unchanged
      expect(annotations.value).toEqual([{ id: 1, color: "purple" }]);
    });
  });

  describe("note CRUD", () => {
    it("addNote appends message to annotation's messages array", async () => {
      api.get.mockResolvedValue({ data: [{ id: 1, messages: [] }] });
      api.post.mockResolvedValue({ data: { id: 101, content: "hello" } });

      const { annotations, fetchAnnotations, addNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      const result = await addNote(1, "hello");

      expect(api.post).toHaveBeenCalledWith("/annotations/1/messages", { content: "hello" });
      expect(result).toEqual({ id: 101, content: "hello" });
      expect(annotations.value[0].messages).toEqual([{ id: 101, content: "hello" }]);
    });

    it("addNote creates messages array when absent", async () => {
      api.get.mockResolvedValue({ data: [{ id: 1 }] });
      api.post.mockResolvedValue({ data: { id: 101, content: "first note" } });

      const { annotations, fetchAnnotations, addNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      await addNote(1, "first note");

      expect(annotations.value[0].messages).toEqual([{ id: 101, content: "first note" }]);
    });

    it("addNote does not crash when annotation not found locally", async () => {
      api.get.mockResolvedValue({ data: [{ id: 1 }] });
      api.post.mockResolvedValue({ data: { id: 101, content: "orphan" } });

      const { annotations, fetchAnnotations, addNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      const result = await addNote(999, "orphan");

      expect(result).toEqual({ id: 101, content: "orphan" });
      // annotation 1 untouched
      expect(annotations.value[0].messages).toBeUndefined();
    });

    it("updateNote modifies message in-place via Object.assign", async () => {
      api.get.mockResolvedValue({
        data: [{ id: 1, messages: [{ id: 101, content: "old" }] }],
      });
      api.put.mockResolvedValue({ data: { id: 101, content: "new", edited: true } });

      const { annotations, fetchAnnotations, updateNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      const result = await updateNote(101, "new");

      expect(api.put).toHaveBeenCalledWith("/annotations/messages/101", { content: "new" });
      expect(result).toEqual({ id: 101, content: "new", edited: true });
      // Object.assign merges onto same reference
      expect(annotations.value[0].messages[0]).toEqual({ id: 101, content: "new", edited: true });
    });

    it("updateNote finds message across multiple annotations", async () => {
      api.get.mockResolvedValue({
        data: [
          { id: 1, messages: [{ id: 101, content: "a" }] },
          { id: 2, messages: [{ id: 201, content: "b" }] },
        ],
      });
      api.put.mockResolvedValue({ data: { id: 201, content: "updated-b" } });

      const { annotations, fetchAnnotations, updateNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      await updateNote(201, "updated-b");

      expect(annotations.value[0].messages[0].content).toBe("a");
      expect(annotations.value[1].messages[0].content).toBe("updated-b");
    });

    it("updateNote handles message not found locally", async () => {
      api.get.mockResolvedValue({ data: [{ id: 1, messages: [{ id: 101, content: "a" }] }] });
      api.put.mockResolvedValue({ data: { id: 999, content: "ghost" } });

      const { annotations, fetchAnnotations, updateNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      const result = await updateNote(999, "ghost");

      expect(result).toEqual({ id: 999, content: "ghost" });
      expect(annotations.value[0].messages[0].content).toBe("a");
    });

    it("deleteNote removes message from annotation", async () => {
      api.get.mockResolvedValue({
        data: [{ id: 1, messages: [{ id: 101 }, { id: 102 }] }],
      });

      const { annotations, fetchAnnotations, deleteNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      await deleteNote(101);

      expect(api.delete).toHaveBeenCalledWith("/annotations/messages/101");
      expect(annotations.value[0].messages).toEqual([{ id: 102 }]);
    });

    it("deleteNote filters across all annotations", async () => {
      api.get.mockResolvedValue({
        data: [
          { id: 1, messages: [{ id: 101 }, { id: 102 }] },
          { id: 2, messages: [{ id: 201 }] },
        ],
      });

      const { annotations, fetchAnnotations, deleteNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      await deleteNote(201);

      expect(annotations.value[0].messages).toEqual([{ id: 101 }, { id: 102 }]);
      expect(annotations.value[1].messages).toEqual([]);
    });

    it("deleteNote skips annotations without messages array", async () => {
      api.get.mockResolvedValue({
        data: [{ id: 1 }, { id: 2, messages: [{ id: 201 }] }],
      });

      const { annotations, fetchAnnotations, deleteNote } = useAnnotations(fileId, api);
      await fetchAnnotations();
      await deleteNote(201);

      expect(annotations.value[0].messages).toBeUndefined();
      expect(annotations.value[1].messages).toEqual([]);
    });
  });

  describe("note operations bump Y.js version", () => {
    it("addNote bumps Y.js version", async () => {
      const ydoc = new Y.Doc();
      api.get.mockResolvedValue({ data: [{ id: 1, messages: [] }] });
      api.post.mockResolvedValue({ data: { id: 101, content: "hi" } });

      const { fetchAnnotations, setYDoc, addNote } = useAnnotations(fileId, api);
      setYDoc(ydoc);
      await fetchAnnotations();

      const meta = ydoc.getMap("annotations-meta");
      expect(meta.get("version")).toBeUndefined();

      await addNote(1, "hi");
      expect(typeof meta.get("version")).toBe("number");

      ydoc.destroy();
    });

    it("updateNote bumps Y.js version", async () => {
      const ydoc = new Y.Doc();
      api.get.mockResolvedValue({
        data: [{ id: 1, messages: [{ id: 101, content: "old" }] }],
      });
      api.put.mockResolvedValue({ data: { id: 101, content: "new" } });

      const { fetchAnnotations, setYDoc, updateNote } = useAnnotations(fileId, api);
      setYDoc(ydoc);
      await fetchAnnotations();

      const meta = ydoc.getMap("annotations-meta");
      await updateNote(101, "new");
      expect(typeof meta.get("version")).toBe("number");

      ydoc.destroy();
    });

    it("deleteNote bumps Y.js version", async () => {
      const ydoc = new Y.Doc();
      api.get.mockResolvedValue({
        data: [{ id: 1, messages: [{ id: 101 }] }],
      });

      const { fetchAnnotations, setYDoc, deleteNote } = useAnnotations(fileId, api);
      setYDoc(ydoc);
      await fetchAnnotations();

      const meta = ydoc.getMap("annotations-meta");
      await deleteNote(101);
      expect(typeof meta.get("version")).toBe("number");

      ydoc.destroy();
    });

    it("updateAnnotation bumps Y.js version", async () => {
      const ydoc = new Y.Doc();
      api.get.mockResolvedValue({ data: [{ id: 1, color: "purple" }] });
      api.put.mockResolvedValue({ data: { id: 1, color: "green" } });

      const { fetchAnnotations, setYDoc, updateAnnotation } = useAnnotations(fileId, api);
      setYDoc(ydoc);
      await fetchAnnotations();

      const meta = ydoc.getMap("annotations-meta");
      await updateAnnotation(1, { color: "green" });
      expect(typeof meta.get("version")).toBe("number");

      ydoc.destroy();
    });
  });

  describe("Y.js real-time sync", () => {
    it("re-fetches annotations when remote Y.js version changes", async () => {
      const ydoc = new Y.Doc();
      const remoteDoc = new Y.Doc();

      const { annotations, fetchAnnotations, setYDoc } = useAnnotations(fileId, api);
      setYDoc(ydoc);
      await fetchAnnotations();

      expect(api.get).toHaveBeenCalledTimes(1);

      // Simulate a remote client bumping the annotation version
      const remoteMap = remoteDoc.getMap("annotations-meta");
      remoteMap.set("version", Date.now());

      // Sync remote change to local doc
      const update = Y.encodeStateAsUpdate(remoteDoc);
      Y.applyUpdate(ydoc, update);

      // Allow microtask/debounce to settle
      await new Promise((r) => setTimeout(r, 350));

      expect(api.get).toHaveBeenCalledTimes(2);

      ydoc.destroy();
      remoteDoc.destroy();
    });

    it("does not re-fetch for local Y.js version changes", async () => {
      const ydoc = new Y.Doc();

      const { fetchAnnotations, setYDoc, notifyAnnotationChange } = useAnnotations(fileId, api);
      setYDoc(ydoc);
      await fetchAnnotations();

      expect(api.get).toHaveBeenCalledTimes(1);

      // Local mutation (from this client's own annotation action)
      notifyAnnotationChange();

      await new Promise((r) => setTimeout(r, 350));

      // Should NOT have re-fetched because the change was local
      expect(api.get).toHaveBeenCalledTimes(1);

      ydoc.destroy();
    });

    it("cleans up Y.js observer when setYDoc is called with null", async () => {
      const ydoc = new Y.Doc();
      const remoteDoc = new Y.Doc();

      const { fetchAnnotations, setYDoc } = useAnnotations(fileId, api);
      setYDoc(ydoc);
      await fetchAnnotations();

      // Disconnect
      setYDoc(null);

      // Simulate remote change after disconnect
      const remoteMap = remoteDoc.getMap("annotations-meta");
      remoteMap.set("version", Date.now());
      const update = Y.encodeStateAsUpdate(remoteDoc);
      Y.applyUpdate(ydoc, update);

      await new Promise((r) => setTimeout(r, 350));

      // Should still only have the initial fetch
      expect(api.get).toHaveBeenCalledTimes(1);

      ydoc.destroy();
      remoteDoc.destroy();
    });

    it("mutation methods bump Y.js version after successful API call", async () => {
      const ydoc = new Y.Doc();

      const { setYDoc, createAnnotation } = useAnnotations(fileId, api);
      setYDoc(ydoc);

      const meta = ydoc.getMap("annotations-meta");
      expect(meta.get("version")).toBeUndefined();

      api.post.mockResolvedValue({ data: { id: 10, color: "purple" } });
      await createAnnotation({ color: "purple", anchorData: {}, selectedText: "hi" });

      expect(meta.get("version")).toBeDefined();
      expect(typeof meta.get("version")).toBe("number");

      ydoc.destroy();
    });

    it("does not bump Y.js version when API call fails", async () => {
      const ydoc = new Y.Doc();

      const { setYDoc, createAnnotation } = useAnnotations(fileId, api);
      setYDoc(ydoc);

      const meta = ydoc.getMap("annotations-meta");

      api.post.mockRejectedValue(new Error("Server error"));

      await expect(createAnnotation({ color: "purple", anchorData: {}, selectedText: "hi" }))
        .rejects.toThrow("Server error");

      expect(meta.get("version")).toBeUndefined();

      ydoc.destroy();
    });
  });
});
