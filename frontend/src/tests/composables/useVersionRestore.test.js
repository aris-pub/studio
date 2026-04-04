/**
 * @file Unit tests for useVersionRestore composable
 * @description Tests lazy-inject pattern: inject() at setup, .value access in restoreVersion()
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowRef, ref } from "vue";

const mockYText = {
  length: 100,
  toString: () => "# Modified Content\n\nThis is modified.",
  delete: vi.fn(),
  insert: vi.fn(),
};

const mockYDoc = {
  getText: vi.fn(() => mockYText),
  transact: vi.fn((callback) => {
    callback();
  }),
  destroy: vi.fn(),
};

const mockAwareness = {
  getStates: vi.fn(
    () =>
      new Map([
        [1, { user: { id: 1, name: "User 1" } }],
        [2, { user: { id: 2, name: "User 2" }, cursor: { line: 5 } }],
      ])
  ),
  setLocalStateField: vi.fn(),
};

const mockCompartment = {
  reconfigure: vi.fn((exts) => ({ type: "reconfigure", exts })),
};

const mockView = {
  state: { facet: vi.fn(() => false) },
  dispatch: vi.fn(),
};

vi.mock("vue", async () => {
  const actual = await vi.importActual("vue");
  return {
    ...actual,
    inject: vi.fn(),
  };
});

vi.mock("@codemirror/state", () => ({
  EditorState: {
    readOnly: {
      of: (v) => ({ readOnly: v }),
    },
  },
}));

vi.mock("@codemirror/view", () => ({
  EditorView: {
    editable: { of: (v) => ({ editable: v }) },
  },
}));

global.fetch = vi.fn();
global.confirm = vi.fn();

import { inject } from "vue";
const { useVersionRestore } = await import("@/composables/useVersionRestore");

function setupInjects({ ydoc = mockYDoc, awareness = mockAwareness, cmView = mockView, compartment = mockCompartment, user = { id: 1, name: "User 1", email: "u@t.com" } } = {}) {
  inject.mockImplementation((key) => {
    if (key === "ydoc") return shallowRef(ydoc);
    if (key === "awareness") return shallowRef(awareness);
    if (key === "cmView") return shallowRef(cmView);
    if (key === "readOnlyCompartment") return shallowRef(compartment);
    if (key === "user") return ref(user);
    return undefined;
  });
}

describe("useVersionRestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockYText.length = 100;
    mockAwareness.getStates.mockReturnValue(
      new Map([
        [1, { user: { id: 1, name: "User 1" } }],
        [2, { user: { id: 2, name: "User 2" }, cursor: { line: 5 } }],
      ])
    );

    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("# Original Content\n\nThis is the first version."),
    });
    global.confirm.mockReturnValue(true);
  });

  describe("setup (lazy inject)", () => {
    it("does not throw at setup time even with null refs", () => {
      inject.mockImplementation(() => shallowRef(null));
      expect(() => useVersionRestore(123)).not.toThrow();
    });

    it("returns isRestoring as false initially", () => {
      setupInjects();
      const { isRestoring } = useVersionRestore(123);
      expect(isRestoring.value).toBe(false);
    });
  });

  describe("restoreVersion", () => {
    it("throws when ydoc is not available", async () => {
      inject.mockImplementation(() => shallowRef(null));
      const { restoreVersion } = useVersionRestore(123);

      await expect(restoreVersion(456)).rejects.toThrow("Editor not available");
    });

    it("fetches version content from API", async () => {
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);
      await restoreVersion(456);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/files/123/versions/456/preview"),
        expect.any(Object)
      );
    });

    it("detects concurrent editors and shows confirmation", async () => {
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);
      await restoreVersion(456);

      expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining("other user"));
    });

    it("cancels restore when user declines", async () => {
      global.confirm.mockReturnValue(false);
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);
      const result = await restoreVersion(456);

      expect(result).toBe(false);
      expect(mockYDoc.transact).not.toHaveBeenCalled();
    });

    it("performs Y.js transaction with delete and insert", async () => {
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);
      await restoreVersion(456);

      expect(mockYDoc.transact).toHaveBeenCalled();
      expect(mockYText.delete).toHaveBeenCalledWith(0, mockYText.length);
      expect(mockYText.insert).toHaveBeenCalledWith(0, expect.stringContaining("Original Content"));
    });

    it("tags transaction with restore origin", async () => {
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);
      await restoreVersion(456);

      expect(mockYDoc.transact).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          origin: expect.objectContaining({
            type: "restore-version",
            versionId: 456,
            userId: 1,
          }),
        })
      );
    });

    it("broadcasts restore intent via awareness", async () => {
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);
      await restoreVersion(456);

      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith("restoring", 456);
      expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith("restoring", null);
    });

    it("returns true on successful restore", async () => {
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);
      const result = await restoreVersion(456);

      expect(result).toBe(true);
    });

    it("handles fetch errors gracefully", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);

      await expect(restoreVersion(456)).rejects.toThrow("Network error");
    });

    it("skips confirmation if no concurrent editors", async () => {
      mockAwareness.getStates.mockReturnValue(new Map([[1, { user: { id: 1, name: "User 1" } }]]));
      setupInjects();
      const { restoreVersion } = useVersionRestore(123);
      await restoreVersion(456);

      expect(global.confirm).not.toHaveBeenCalled();
    });

    it("works without awareness (graceful degradation)", async () => {
      setupInjects({ awareness: null });
      const { restoreVersion } = useVersionRestore(123);
      const result = await restoreVersion(456);

      expect(result).toBe(true);
      expect(global.confirm).not.toHaveBeenCalled();
    });
  });

  describe("isRestoring lifecycle", () => {
    it("resets to false after successful restore", async () => {
      setupInjects();
      const { restoreVersion, isRestoring } = useVersionRestore(123);

      await restoreVersion(456);
      expect(isRestoring.value).toBe(false);
    });

    it("resets to false after failed restore", async () => {
      global.fetch.mockRejectedValue(new Error("fail"));
      setupInjects();
      const { restoreVersion, isRestoring } = useVersionRestore(123);

      try { await restoreVersion(456); } catch { /* expected */ }
      expect(isRestoring.value).toBe(false);
    });
  });
});
