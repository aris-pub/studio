import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { extractAnchor, resolveAnchor } from "@/utils/anchorExtraction.js";

// jsdom lacks CSS.escape — polyfill for element_id fallback tests
beforeAll(() => {
  if (!globalThis.CSS) globalThis.CSS = {};
  if (!CSS.escape) CSS.escape = (s) => s.replace(/([^\w-])/g, "\\$1");
});

describe("extractAnchor", () => {
  let manuscriptEl;

  beforeEach(() => {
    manuscriptEl = document.createElement("div");
    document.body.appendChild(manuscriptEl);
  });

  afterEach(() => {
    document.body.removeChild(manuscriptEl);
  });

  it("extracts anchor from a single text node", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">Hello world</p>';
    const textNode = manuscriptEl.querySelector("p").firstChild;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    const anchor = extractAnchor(range, manuscriptEl);
    expect(anchor).toEqual({
      node_id: "n1",
      element_id: null,
      start_offset: 0,
      end_offset: 5,
      selected_text: "Hello",
    });
  });

  it("extracts anchor crossing an <em> boundary", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">Hello <em>world</em> end</p>';
    const p = manuscriptEl.querySelector("p");
    const startText = p.firstChild; // "Hello "
    const emText = p.querySelector("em").firstChild; // "world"

    const range = document.createRange();
    range.setStart(startText, 3);
    range.setEnd(emText, 3);

    const anchor = extractAnchor(range, manuscriptEl);
    expect(anchor).not.toBeNull();
    expect(anchor.node_id).toBe("n1");
    expect(anchor.start_offset).toBe(3);
    expect(anchor.end_offset).toBe(9); // "lo wor" = 6+3=9
    expect(anchor.selected_text).toBe("lo wor");
  });

  it("returns null when no [data-nodeid] ancestor exists", () => {
    manuscriptEl.innerHTML = "<p>No node id here</p>";
    const textNode = manuscriptEl.querySelector("p").firstChild;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    expect(extractAnchor(range, manuscriptEl)).toBeNull();
  });

  it("returns null when range is outside manuscriptEl", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">Inside</p>';
    const outside = document.createElement("div");
    outside.innerHTML = '<p data-nodeid="n2">Outside</p>';
    document.body.appendChild(outside);

    const textNode = outside.querySelector("p").firstChild;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 3);

    expect(extractAnchor(range, manuscriptEl)).toBeNull();
    document.body.removeChild(outside);
  });

  it("returns null for null range or manuscriptEl", () => {
    expect(extractAnchor(null, manuscriptEl)).toBeNull();
    expect(extractAnchor(document.createRange(), null)).toBeNull();
  });

  it("includes element_id when block has an id attribute", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1" id="para-1">Hello</p>';
    const textNode = manuscriptEl.querySelector("p").firstChild;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    const anchor = extractAnchor(range, manuscriptEl);
    expect(anchor.element_id).toBe("para-1");
  });
});

describe("resolveAnchor", () => {
  let manuscriptEl;

  beforeEach(() => {
    manuscriptEl = document.createElement("div");
    document.body.appendChild(manuscriptEl);
  });

  afterEach(() => {
    document.body.removeChild(manuscriptEl);
  });

  it("resolves anchor by offset to correct range", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">Hello world</p>';

    const range = resolveAnchor(
      { node_id: "n1", start_offset: 6, end_offset: 11, selected_text: "world" },
      manuscriptEl
    );

    expect(range).not.toBeNull();
    expect(range.toString()).toBe("world");
  });

  it("falls back to text search when offsets shift", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">Hello world</p>';

    const range = resolveAnchor(
      { node_id: "n1", start_offset: 99, end_offset: 104, selected_text: "world" },
      manuscriptEl
    );

    expect(range).not.toBeNull();
    expect(range.toString()).toBe("world");
  });

  it("returns null when block is not found", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">Hello</p>';

    const result = resolveAnchor(
      { node_id: "nonexistent", start_offset: 0, end_offset: 5, selected_text: "Hello" },
      manuscriptEl
    );

    expect(result).toBeNull();
  });

  it("falls back to element_id when node_id is missing", () => {
    manuscriptEl.innerHTML = '<p id="para-1" data-nodeid="n1">Hello</p>';

    const range = resolveAnchor(
      {
        node_id: "missing",
        element_id: "para-1",
        start_offset: 0,
        end_offset: 5,
        selected_text: "Hello",
      },
      manuscriptEl
    );

    expect(range).not.toBeNull();
    expect(range.toString()).toBe("Hello");
  });

  it("returns null when text search finds no match", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">Hello world</p>';

    const result = resolveAnchor(
      { node_id: "n1", start_offset: 99, end_offset: 110, selected_text: "nonexistent text" },
      manuscriptEl
    );

    expect(result).toBeNull();
  });

  it("returns null for null inputs", () => {
    expect(resolveAnchor(null, manuscriptEl)).toBeNull();
    expect(resolveAnchor({ node_id: "n1" }, null)).toBeNull();
  });
});

describe("extractAnchor → resolveAnchor round-trip", () => {
  let manuscriptEl;

  beforeEach(() => {
    manuscriptEl = document.createElement("div");
    document.body.appendChild(manuscriptEl);
  });

  afterEach(() => {
    document.body.removeChild(manuscriptEl);
  });

  it("round-trips a simple text selection", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">The quick brown fox</p>';
    const textNode = manuscriptEl.querySelector("p").firstChild;

    const range = document.createRange();
    range.setStart(textNode, 4);
    range.setEnd(textNode, 9);
    expect(range.toString()).toBe("quick");

    const anchor = extractAnchor(range, manuscriptEl);
    const resolved = resolveAnchor(anchor, manuscriptEl);

    expect(resolved).not.toBeNull();
    expect(resolved.toString()).toBe("quick");
  });

  it("round-trips a cross-element selection", () => {
    manuscriptEl.innerHTML = '<p data-nodeid="n1">Hello <strong>brave</strong> world</p>';
    const p = manuscriptEl.querySelector("p");
    const startText = p.firstChild; // "Hello "
    const endText = p.lastChild; // " world"

    const range = document.createRange();
    range.setStart(startText, 4);
    range.setEnd(endText, 4);

    const anchor = extractAnchor(range, manuscriptEl);
    const resolved = resolveAnchor(anchor, manuscriptEl);

    expect(resolved).not.toBeNull();
    expect(resolved.toString()).toBe(range.toString());
  });
});
