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
