import { describe, it, expect, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import { useHighlightRenderer } from "@/composables/useHighlightRenderer.js";

describe("useHighlightRenderer — highlight colors", () => {
  let el;

  afterEach(() => {
    if (el && el.parentNode) document.body.removeChild(el);
  });

  function setup(html, annotationList) {
    el = document.createElement("div");
    el.innerHTML = html;
    document.body.appendChild(el);

    const manuscriptRef = ref(el);
    const activeAnnotationId = ref(null);
    const annotations = ref(annotationList);

    const { applyHighlights, clearHighlights, setupClickHandler } = useHighlightRenderer(
      annotations,
      manuscriptRef,
      activeAnnotationId
    );
    applyHighlights();
    return {
      el,
      annotations,
      activeAnnotationId,
      applyHighlights,
      clearHighlights,
      setupClickHandler,
    };
  }

  it("sets --mark-border CSS variable matching the annotation color", () => {
    const { el } = setup('<p data-nodeid="n1">The possibilities are endless</p>', [
      {
        id: 1,
        color: "orange",
        anchor_data: { node_id: "n1", start_offset: 0, end_offset: 5 },
        selected_text: "The p",
      },
      {
        id: 2,
        color: "green",
        anchor_data: { node_id: "n1", start_offset: 20, end_offset: 27 },
        selected_text: "endless",
      },
    ]);

    const marks = el.querySelectorAll("mark[data-annotation-id]");
    expect(marks).toHaveLength(2);

    const orangeMark = el.querySelector('mark[data-annotation-id="1"]');
    expect(orangeMark.style.getPropertyValue("--mark-border")).toBe("var(--orange-400)");
    expect(orangeMark.style.backgroundColor).toBe("var(--orange-200)");

    const greenMark = el.querySelector('mark[data-annotation-id="2"]');
    expect(greenMark.style.getPropertyValue("--mark-border")).toBe("var(--green-400)");
    expect(greenMark.style.backgroundColor).toBe("var(--green-200)");
  });

  it("defaults to purple when color is unknown", () => {
    const { el } = setup('<p data-nodeid="n1">Hello world</p>', [
      {
        id: 1,
        color: "chartreuse",
        anchor_data: { node_id: "n1", start_offset: 0, end_offset: 5 },
        selected_text: "Hello",
      },
    ]);

    const mark = el.querySelector('mark[data-annotation-id="1"]');
    expect(mark).not.toBeNull();
    expect(mark.style.getPropertyValue("--mark-border")).toBe("var(--purple-400)");
    expect(mark.style.backgroundColor).toBe("var(--purple-200)");
  });

  it("clearHighlights removes all <mark> elements", () => {
    const { el, clearHighlights } = setup('<p data-nodeid="n1">Hello world</p>', [
      {
        id: 1,
        color: "purple",
        anchor_data: { node_id: "n1", start_offset: 0, end_offset: 5 },
        selected_text: "Hello",
      },
    ]);

    expect(el.querySelectorAll("mark[data-annotation-id]")).toHaveLength(1);
    clearHighlights(el);
    expect(el.querySelectorAll("mark[data-annotation-id]")).toHaveLength(0);
    // Text content should be preserved
    expect(el.querySelector("p").textContent).toBe("Hello world");
  });

  it("clearHighlights removes math highlight styles", () => {
    el = document.createElement("div");
    el.innerHTML =
      '<p data-nodeid="n1"><span class="math" data-highlight-annotation="1"><math>x</math></span></p>';
    document.body.appendChild(el);

    const mathEl = el.querySelector("[data-highlight-annotation]");
    mathEl.style.backgroundColor = "var(--purple-200)";
    mathEl.style.borderRadius = "2px";
    mathEl.style.setProperty("--mark-border", "var(--purple-400)");

    const manuscriptRef = ref(el);
    const { clearHighlights } = useHighlightRenderer(ref([]), manuscriptRef, ref(null));

    clearHighlights(el);
    expect(el.querySelector("[data-highlight-annotation]")).toBeNull();
    expect(mathEl.style.backgroundColor).toBe("");
  });

  it("wrapRange cross-boundary: single mark wraps across <em>", () => {
    const { el } = setup('<p data-nodeid="n1">Hello <em>beautiful</em> world</p>', [
      {
        id: 1,
        color: "green",
        anchor_data: { node_id: "n1", start_offset: 4, end_offset: 20 },
        selected_text: "o beautiful worl",
      },
    ]);

    const marks = el.querySelectorAll('mark[data-annotation-id="1"]');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("o beautiful worl");
  });

  it("styles math elements with backgroundColor on <math> element", () => {
    const { el } = setup(
      '<p data-nodeid="n1">See <span class="math"><math>x+1</math></span> here</p>',
      [
        {
          id: 1,
          color: "red",
          anchor_data: { node_id: "n1", start_offset: 0, end_offset: 12 },
          selected_text: "See x+1 here",
        },
      ]
    );

    const mathEl = el.querySelector("[data-highlight-annotation]");
    expect(mathEl).not.toBeNull();
    expect(mathEl.style.backgroundColor).toBe("var(--red-200)");
    expect(mathEl.getAttribute("data-highlight-annotation")).toBe("1");
  });

  it("handleMarkClick sets activeAnnotationId from data-annotation-id", () => {
    const { el, activeAnnotationId, setupClickHandler } = setup(
      '<p data-nodeid="n1">Hello world</p>',
      [
        {
          id: 42,
          color: "purple",
          anchor_data: { node_id: "n1", start_offset: 0, end_offset: 5 },
          selected_text: "Hello",
        },
      ]
    );

    setupClickHandler();
    const mark = el.querySelector('mark[data-annotation-id="42"]');
    mark.click();
    expect(activeAnnotationId.value).toBe(42);
  });

  it("handleMarkClick sets activeAnnotationId from data-highlight-annotation", () => {
    el = document.createElement("div");
    el.innerHTML = '<p data-nodeid="n1"><span data-highlight-annotation="7">math</span></p>';
    document.body.appendChild(el);

    const manuscriptRef = ref(el);
    const activeAnnotationId = ref(null);
    const { setupClickHandler } = useHighlightRenderer(ref([]), manuscriptRef, activeAnnotationId);

    setupClickHandler();
    el.querySelector("[data-highlight-annotation]").click();
    expect(activeAnnotationId.value).toBe(7);
  });

  it("activeAnnotationId watcher toggles .active on marks", async () => {
    const { el, activeAnnotationId } = setup('<p data-nodeid="n1">Hello world again</p>', [
      {
        id: 1,
        color: "purple",
        anchor_data: { node_id: "n1", start_offset: 0, end_offset: 5 },
        selected_text: "Hello",
      },
      {
        id: 2,
        color: "orange",
        anchor_data: { node_id: "n1", start_offset: 6, end_offset: 11 },
        selected_text: "world",
      },
    ]);

    activeAnnotationId.value = 1;
    await nextTick();

    const mark1 = el.querySelector('mark[data-annotation-id="1"]');
    const mark2 = el.querySelector('mark[data-annotation-id="2"]');
    expect(mark1.classList.contains("active")).toBe(true);
    expect(mark2.classList.contains("active")).toBe(false);

    activeAnnotationId.value = 2;
    await nextTick();

    expect(mark1.classList.contains("active")).toBe(false);
    expect(mark2.classList.contains("active")).toBe(true);
  });

  it("activeAnnotationId watcher toggles .active on math highlights", async () => {
    el = document.createElement("div");
    el.innerHTML = '<p data-nodeid="n1"><span data-highlight-annotation="5">math</span></p>';
    document.body.appendChild(el);

    const manuscriptRef = ref(el);
    const activeAnnotationId = ref(null);
    useHighlightRenderer(ref([]), manuscriptRef, activeAnnotationId);

    activeAnnotationId.value = 5;
    await nextTick();

    const mathEl = el.querySelector("[data-highlight-annotation]");
    expect(mathEl.classList.contains("active")).toBe(true);

    activeAnnotationId.value = 99;
    await nextTick();

    expect(mathEl.classList.contains("active")).toBe(false);
  });

  it("overlapping annotations: both marks exist", () => {
    const { el } = setup('<p data-nodeid="n1">Hello world</p>', [
      {
        id: 1,
        color: "purple",
        anchor_data: { node_id: "n1", start_offset: 0, end_offset: 11 },
        selected_text: "Hello world",
      },
      {
        id: 2,
        color: "orange",
        anchor_data: { node_id: "n1", start_offset: 6, end_offset: 11 },
        selected_text: "world",
      },
    ]);

    const mark1 = el.querySelector('mark[data-annotation-id="1"]');
    const mark2 = el.querySelector('mark[data-annotation-id="2"]');
    expect(mark1).not.toBeNull();
    expect(mark2).not.toBeNull();
  });

  it("overlapping annotations: newest annotation color wins in overlap region", () => {
    const { el } = setup('<p data-nodeid="n1">Hello world today</p>', [
      {
        id: 1,
        color: "purple",
        anchor_data: { node_id: "n1", start_offset: 0, end_offset: 11 },
        selected_text: "Hello world",
      },
      {
        id: 2,
        color: "orange",
        anchor_data: { node_id: "n1", start_offset: 6, end_offset: 17 },
        selected_text: "world today",
      },
    ]);

    // "world" is the overlap. The newest annotation (id=2, orange) should be
    // the innermost mark so its background-color wins visually.
    const mark2 = el.querySelector('mark[data-annotation-id="2"]');
    expect(mark2).not.toBeNull();
    expect(mark2.textContent).toContain("world");

    // The orange mark should be inside the purple mark in the overlap
    const parentMark = mark2.closest('mark[data-annotation-id="1"]');
    expect(parentMark).not.toBeNull();
  });

  it("renders highlights for API-created annotations with non-matching node_id", () => {
    const { el } = setup(
      '<div data-nodeid="0"><p data-nodeid="1">Hello world</p><p data-nodeid="2">Goodbye world</p></div>',
      [
        {
          id: 1,
          color: "purple",
          anchor_data: { node_id: "wrong-node-id", start_offset: 0, end_offset: 5 },
          selected_text: "Hello",
        },
      ]
    );

    const mark = el.querySelector('mark[data-annotation-id="1"]');
    expect(mark).not.toBeNull();
    expect(mark.textContent).toBe("Hello");
  });

  it("clearHighlights unwraps nested marks without losing text", () => {
    const { el, clearHighlights } = setup('<p data-nodeid="n1">Hello world today</p>', [
      {
        id: 1,
        color: "purple",
        anchor_data: { node_id: "n1", start_offset: 0, end_offset: 11 },
        selected_text: "Hello world",
      },
      {
        id: 2,
        color: "orange",
        anchor_data: { node_id: "n1", start_offset: 6, end_offset: 17 },
        selected_text: "world today",
      },
    ]);

    // Verify marks are nested before clearing
    const marksBefore = el.querySelectorAll("mark[data-annotation-id]");
    expect(marksBefore.length).toBeGreaterThanOrEqual(2);

    clearHighlights(el);

    expect(el.querySelectorAll("mark[data-annotation-id]").length).toBe(0);
    expect(el.querySelector("p").textContent).toBe("Hello world today");
  });

  it("clearHighlights handles deeply nested marks (3 annotations overlapping)", () => {
    const { el, clearHighlights } = setup('<p data-nodeid="n1">ABCDEFGHIJ</p>', [
      {
        id: 1,
        color: "purple",
        anchor_data: { node_id: "n1", start_offset: 0, end_offset: 10 },
        selected_text: "ABCDEFGHIJ",
      },
      {
        id: 2,
        color: "orange",
        anchor_data: { node_id: "n1", start_offset: 2, end_offset: 8 },
        selected_text: "CDEFGH",
      },
      {
        id: 3,
        color: "green",
        anchor_data: { node_id: "n1", start_offset: 4, end_offset: 6 },
        selected_text: "EF",
      },
    ]);

    clearHighlights(el);

    expect(el.querySelectorAll("mark[data-annotation-id]").length).toBe(0);
    expect(el.querySelector("p").textContent).toBe("ABCDEFGHIJ");
  });

  it("cross-boundary range produces a single contiguous mark", () => {
    const { el } = setup('<p data-nodeid="n1">Hello <em>beautiful</em> world</p>', [
      {
        id: 1,
        color: "green",
        anchor_data: { node_id: "n1", start_offset: 4, end_offset: 20 },
        selected_text: "o beautiful worl",
      },
    ]);

    const marks = el.querySelectorAll('mark[data-annotation-id="1"]');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toContain("beautiful");
  });
});
