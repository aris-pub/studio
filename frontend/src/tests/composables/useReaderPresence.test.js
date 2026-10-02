import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  resolveCursorOffset,
  findBlockForOffset,
  buildPresenceEntries,
} from "@/composables/useReaderPresence.js";

describe("resolveCursorOffset", () => {
  it("decodes a y-codemirror cursor JSON into an absolute source offset", () => {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codemirror");
    ytext.insert(0, "hello world");
    const rel = Y.createRelativePositionFromTypeIndex(ytext, 6);
    const cursor = { head: Y.relativePositionToJSON(rel) };
    expect(resolveCursorOffset(cursor, ydoc)).toBe(6);
  });

  it("falls back to anchor when head is absent", () => {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codemirror");
    ytext.insert(0, "abcdef");
    const rel = Y.createRelativePositionFromTypeIndex(ytext, 3);
    const cursor = { anchor: Y.relativePositionToJSON(rel) };
    expect(resolveCursorOffset(cursor, ydoc)).toBe(3);
  });

  it("returns null for missing cursor, missing doc, or garbage", () => {
    const ydoc = new Y.Doc();
    ydoc.getText("codemirror").insert(0, "x");
    expect(resolveCursorOffset(null, ydoc)).toBeNull();
    expect(resolveCursorOffset({ head: {} }, null)).toBeNull();
    expect(resolveCursorOffset({ head: { not: "valid" } }, ydoc)).toBeNull();
  });
});

describe("findBlockForOffset", () => {
  function manuscript(ranges) {
    const root = document.createElement("div");
    for (const [start, end, id] of ranges) {
      const el = document.createElement("p");
      el.setAttribute("data-source-start", String(start));
      el.setAttribute("data-source-end", String(end));
      el.setAttribute("data-id", id);
      root.appendChild(el);
    }
    return root;
  }

  it("returns the block whose source range contains the offset", () => {
    const root = manuscript([
      [0, 10, "a"],
      [11, 25, "b"],
      [26, 40, "c"],
    ]);
    expect(findBlockForOffset(root, 15).getAttribute("data-id")).toBe("b");
  });

  it("prefers the smallest containing range when blocks nest", () => {
    const root = manuscript([
      [0, 100, "outer"],
      [10, 30, "inner"],
    ]);
    expect(findBlockForOffset(root, 20).getAttribute("data-id")).toBe("inner");
  });

  it("returns null when no block contains the offset or inputs are missing", () => {
    const root = manuscript([[0, 5, "a"]]);
    expect(findBlockForOffset(root, 99)).toBeNull();
    expect(findBlockForOffset(null, 1)).toBeNull();
    expect(findBlockForOffset(root, null)).toBeNull();
  });
});

describe("buildPresenceEntries", () => {
  const base = {
    selfClientId: 1,
    resolveOffset: (c) => c.off ?? null,
    findBlock: (off) => (off === 10 ? { tag: "block" } : null),
    now: 1000,
    lastSeen: new Map(),
    idleMs: 5000,
  };

  function states(entries) {
    return new Map(entries);
  }

  it("excludes self, user-less states, and users with no resolvable block", () => {
    const s = states([
      [1, { user: { id: 1 }, cursor: { off: 10 } }], // self -> excluded
      [2, { user: null, cursor: { off: 10 } }], // no user -> excluded
      [3, { user: { id: 3 }, cursor: { off: 999 } }], // no block -> excluded
      [4, { user: { id: 4, avatar_color: "#f00" }, cursor: { off: 10 } }], // kept
    ]);
    const out = buildPresenceEntries(s, base);
    expect(out).toHaveLength(1);
    expect(out[0].clientId).toBe(4);
    expect(out[0].color).toBe("#f00");
  });

  it("marks a client inactive once it has been quiet past idleMs", () => {
    const lastSeen = new Map([[4, 1000]]);
    const s = states([[4, { user: { id: 4 }, cursor: { off: 10 } }]]);
    const fresh = buildPresenceEntries(s, { ...base, lastSeen, now: 3000 });
    expect(fresh[0].active).toBe(true);
    const stale = buildPresenceEntries(s, { ...base, lastSeen, now: 9000 });
    expect(stale[0].active).toBe(false);
  });

  it("falls back to a default color when the user has none", () => {
    const s = states([[4, { user: { id: 4 }, cursor: { off: 10 } }]]);
    expect(buildPresenceEntries(s, base)[0].color).toBe("var(--primary-400)");
  });
});
