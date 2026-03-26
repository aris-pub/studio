import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import * as Y from "yjs";
import {
  extractSourceAnchor,
  resolveSourceAnchor,
} from "@/utils/sourceAnchor.js";

beforeAll(() => {
  if (!globalThis.CSS) globalThis.CSS = {};
  if (!CSS.escape) CSS.escape = (s) => s.replace(/([^\w-])/g, "\\$1");
});

describe("extractSourceAnchor", () => {
  let manuscriptEl, ydoc, ytext;

  beforeEach(() => {
    manuscriptEl = document.createElement("div");
    document.body.appendChild(manuscriptEl);
    ydoc = new Y.Doc();
    ytext = ydoc.getText("text");
  });

  afterEach(() => {
    document.body.removeChild(manuscriptEl);
    ydoc.destroy();
  });

  it("extracts Y.RelativePositions from a plain text selection", () => {
    const source = "Hello world";
    ytext.insert(0, source);

    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="11">Hello world</p>';
    const textNode = manuscriptEl.querySelector("p").firstChild;

    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 11);

    const anchor = extractSourceAnchor(range, manuscriptEl, ytext);
    expect(anchor).not.toBeNull();
    expect(anchor.type).toBe("yjs_relative");
    expect(anchor.start_relative).toBeDefined();
    expect(anchor.end_relative).toBeDefined();
    expect(anchor.selected_text).toBe("world");
  });

  it("uses data-source-start on the nearest ancestor with source data", () => {
    const source = "Start *bold text* end";
    ytext.insert(0, source);

    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="21">' +
      'Start <span class="span" data-source-start="6" data-source-end="17"><em>bold text</em></span> end' +
      "</p>";
    const emText = manuscriptEl.querySelector("em").firstChild;

    const range = document.createRange();
    range.setStart(emText, 0);
    range.setEnd(emText, 4);

    const anchor = extractSourceAnchor(range, manuscriptEl, ytext);
    expect(anchor).not.toBeNull();
    expect(anchor.selected_text).toBe("bold");
    // The source offset should be within the span's range (6-17), not the paragraph's
    expect(anchor.source_start).toBeGreaterThanOrEqual(6);
    expect(anchor.source_start).toBeLessThanOrEqual(17);
  });

  it("returns null when no data-source-start ancestor exists", () => {
    ytext.insert(0, "text");
    manuscriptEl.innerHTML = "<p>No source data</p>";
    const textNode = manuscriptEl.querySelector("p").firstChild;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    expect(extractSourceAnchor(range, manuscriptEl, ytext)).toBeNull();
  });

  it("returns null for empty selection", () => {
    ytext.insert(0, "text");
    manuscriptEl.innerHTML = '<p data-source-start="0" data-source-end="4">text</p>';

    const range = document.createRange();
    range.setStart(manuscriptEl.querySelector("p").firstChild, 2);
    range.setEnd(manuscriptEl.querySelector("p").firstChild, 2);

    expect(extractSourceAnchor(range, manuscriptEl, ytext)).toBeNull();
  });

  it("handles math elements as atomic anchors", () => {
    const source = "The value $x^2$ end";
    ytext.insert(0, source);

    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="19">' +
      'The value <span class="math" data-source-start="10" data-source-end="15">x²</span> end' +
      "</p>";
    const mathText = manuscriptEl.querySelector(".math").firstChild;

    const range = document.createRange();
    range.setStart(mathText, 0);
    range.setEnd(mathText, 2);

    const anchor = extractSourceAnchor(range, manuscriptEl, ytext);
    expect(anchor).not.toBeNull();
    // Should snap to the full math span source range
    expect(anchor.source_start).toBe(10);
    expect(anchor.source_end).toBe(15);
  });

  it("preserves backward-compat fields", () => {
    ytext.insert(0, "Hello");
    manuscriptEl.innerHTML =
      '<p data-nodeid="n1" data-source-start="0" data-source-end="5">Hello</p>';
    const textNode = manuscriptEl.querySelector("p").firstChild;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    const anchor = extractSourceAnchor(range, manuscriptEl, ytext);
    expect(anchor.node_id).toBe("n1");
    expect(anchor.start_offset).toBe(0);
    expect(anchor.end_offset).toBe(5);
  });
});

describe("resolveSourceAnchor", () => {
  let manuscriptEl, ydoc, ytext;

  beforeEach(() => {
    manuscriptEl = document.createElement("div");
    document.body.appendChild(manuscriptEl);
    ydoc = new Y.Doc();
    ytext = ydoc.getText("text");
  });

  afterEach(() => {
    document.body.removeChild(manuscriptEl);
    ydoc.destroy();
  });

  it("resolves a Y.RelativePosition back to a DOM range", () => {
    const source = "Hello world";
    ytext.insert(0, source);

    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="11">Hello world</p>';

    // Create anchor
    const textNode = manuscriptEl.querySelector("p").firstChild;
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 11);

    const anchor = extractSourceAnchor(range, manuscriptEl, ytext);
    const resolved = resolveSourceAnchor(anchor, manuscriptEl, ydoc);

    expect(resolved).not.toBeNull();
    expect(resolved.toString()).toBe("world");
  });

  it("resolves correctly after text is inserted before the anchor", () => {
    const source = "Hello world";
    ytext.insert(0, source);

    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="11">Hello world</p>';

    // Create anchor for "world" at source offset 6-11
    const textNode = manuscriptEl.querySelector("p").firstChild;
    const createRange = document.createRange();
    createRange.setStart(textNode, 6);
    createRange.setEnd(textNode, 11);
    const anchor = extractSourceAnchor(createRange, manuscriptEl, ytext);

    // Simulate edit: insert "NEW " at position 0
    ytext.insert(0, "NEW ");

    // Re-render manuscript with updated source offsets
    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="15">NEW Hello world</p>';

    const resolved = resolveSourceAnchor(anchor, manuscriptEl, ydoc);
    expect(resolved).not.toBeNull();
    expect(resolved.toString()).toBe("world");
  });

  it("returns null when anchor text has been deleted", () => {
    ytext.insert(0, "Hello world");

    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="11">Hello world</p>';

    const textNode = manuscriptEl.querySelector("p").firstChild;
    const createRange = document.createRange();
    createRange.setStart(textNode, 6);
    createRange.setEnd(textNode, 11);
    const anchor = extractSourceAnchor(createRange, manuscriptEl, ytext);

    // Delete "world" from the Y.Text
    ytext.delete(6, 5);

    // Re-render without "world"
    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="6">Hello </p>';

    const resolved = resolveSourceAnchor(anchor, manuscriptEl, ydoc);
    // When the anchored text is deleted, resolution should return null
    expect(resolved).toBeNull();
  });

  it("falls back to legacy resolution for old-format anchors", () => {
    manuscriptEl.innerHTML =
      '<p data-nodeid="n1">Hello world</p>';

    const anchor = {
      node_id: "n1",
      start_offset: 6,
      end_offset: 11,
      selected_text: "world",
    };

    const resolved = resolveSourceAnchor(anchor, manuscriptEl, ydoc);
    expect(resolved).not.toBeNull();
    expect(resolved.toString()).toBe("world");
  });
});

describe("extractSourceAnchor → resolveSourceAnchor round-trip", () => {
  let manuscriptEl, ydoc, ytext;

  beforeEach(() => {
    manuscriptEl = document.createElement("div");
    document.body.appendChild(manuscriptEl);
    ydoc = new Y.Doc();
    ytext = ydoc.getText("text");
  });

  afterEach(() => {
    document.body.removeChild(manuscriptEl);
    ydoc.destroy();
  });

  it("round-trips a selection in unchanged document", () => {
    ytext.insert(0, "The quick brown fox");
    manuscriptEl.innerHTML =
      '<p data-nodeid="1" data-source-start="0" data-source-end="19">The quick brown fox</p>';

    const textNode = manuscriptEl.querySelector("p").firstChild;
    const range = document.createRange();
    range.setStart(textNode, 4);
    range.setEnd(textNode, 9);

    const anchor = extractSourceAnchor(range, manuscriptEl, ytext);
    const resolved = resolveSourceAnchor(anchor, manuscriptEl, ydoc);

    expect(resolved).not.toBeNull();
    expect(resolved.toString()).toBe("quick");
  });
});
