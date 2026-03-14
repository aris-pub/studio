import { describe, it, expect } from "vitest";
import { highlightSearchMatches, clearHighlights } from "@/utils/highlightSearchMatches.js";

describe("highlightSearchMatches mark filter", () => {
  const createContainer = (html) => {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el;
  };

  it("finds text inside annotation marks", () => {
    const el = createContainer(
      '<p>Before <mark data-annotation-id="42">annotated text</mark> after</p>'
    );

    const matches = highlightSearchMatches(el, "annotated");
    expect(matches.length).toBe(1);
    expect(matches[0].mark).toBeTruthy();
  });

  it("skips text inside search highlight marks", () => {
    const el = createContainer(
      '<p>Before <mark class="aris-search-highlight">highlighted</mark> after</p>'
    );

    const matches = highlightSearchMatches(el, "highlighted");
    expect(matches).toBe(0);
  });

  it("skips text inside current search highlight marks", () => {
    const el = createContainer(
      '<p>Before <mark class="aris-search-highlight--current">current</mark> after</p>'
    );

    const matches = highlightSearchMatches(el, "current");
    expect(matches).toBe(0);
  });

  it("finds text inside generic marks without search classes", () => {
    const el = createContainer('<p>Some <mark class="custom-mark">marked text</mark> here</p>');

    const matches = highlightSearchMatches(el, "marked");
    expect(matches.length).toBe(1);
  });

  it("finds text spanning into and out of annotation marks", () => {
    const el = createContainer('<p>hello <mark data-annotation-id="1">world</mark></p>');

    const matches = highlightSearchMatches(el, "hello world");
    expect(matches.length).toBe(1);
  });

  it("clearHighlights only removes search marks, not annotation marks", () => {
    const el = createContainer(
      '<p><mark class="aris-search-highlight">search</mark> and <mark data-annotation-id="5">annotation</mark></p>'
    );

    clearHighlights(el);

    expect(el.querySelectorAll("mark.aris-search-highlight").length).toBe(0);
    expect(el.querySelectorAll("mark[data-annotation-id]").length).toBe(1);
    expect(el.textContent).toBe("search and annotation");
  });
});
