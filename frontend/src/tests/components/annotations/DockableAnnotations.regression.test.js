import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";

// These tests exercise the logic from DockableAnnotations.vue without
// mounting it (it depends on injected manuscriptRef and global DOM queries).
// We test the sort function, click-to-deselect logic, and selection guard
// as pure functions extracted from the component's behavior.

describe("DockableAnnotations — sortByDomPosition (std-z99r)", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function addMark(id) {
    const mark = document.createElement("mark");
    mark.setAttribute("data-annotation-id", String(id));
    container.appendChild(mark);
    return mark;
  }

  function sortByDomPosition(list) {
    return [...list].sort((a, b) => {
      const markA =
        document.querySelector(`mark[data-annotation-id="${a.id}"]`) ||
        document.querySelector(`[data-highlight-annotation="${a.id}"]`);
      const markB =
        document.querySelector(`mark[data-annotation-id="${b.id}"]`) ||
        document.querySelector(`[data-highlight-annotation="${b.id}"]`);
      if (!markA || !markB) return 0;
      const pos = markA.compareDocumentPosition(markB);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }

  it("sorts annotations by their mark position in the DOM", () => {
    addMark(3);
    addMark(1);
    addMark(2);

    const annotations = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const sorted = sortByDomPosition(annotations);

    expect(sorted.map((a) => a.id)).toEqual([3, 1, 2]);
  });

  it("handles missing marks gracefully (keeps original order)", () => {
    addMark(1);
    // mark for id=2 does not exist

    const annotations = [{ id: 1 }, { id: 2 }];
    const sorted = sortByDomPosition(annotations);
    // When a mark is missing, comparator returns 0, so order is stable
    expect(sorted.map((a) => a.id)).toEqual([1, 2]);
  });

  it("works with data-highlight-annotation (math elements)", () => {
    const math = document.createElement("span");
    math.setAttribute("data-highlight-annotation", "10");
    container.appendChild(math);

    addMark(20);

    const annotations = [{ id: 20 }, { id: 10 }];
    const sorted = sortByDomPosition(annotations);
    expect(sorted.map((a) => a.id)).toEqual([10, 20]);
  });

  it("returns empty array for empty input", () => {
    expect(sortByDomPosition([])).toEqual([]);
  });
});

describe("DockableAnnotations — click-to-deselect (std-y9yh)", () => {
  it("onContainerClick clears activeAnnotationId when target is not a .note", () => {
    const activeAnnotationId = ref(5);
    const container = document.createElement("div");

    function onContainerClick(e) {
      if (!e.target.closest(".note")) {
        activeAnnotationId.value = null;
      }
    }

    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: container });
    onContainerClick(event);

    expect(activeAnnotationId.value).toBeNull();
  });

  it("onContainerClick does NOT clear when target is inside .note", () => {
    const activeAnnotationId = ref(5);

    const note = document.createElement("div");
    note.classList.add("note");
    const child = document.createElement("span");
    note.appendChild(child);
    document.body.appendChild(note);

    function onContainerClick(e) {
      if (!e.target.closest(".note")) {
        activeAnnotationId.value = null;
      }
    }

    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: child });
    onContainerClick(event);

    expect(activeAnnotationId.value).toBe(5);
    document.body.removeChild(note);
  });

  it("onOutsideClick skips when text is selected (preserves selection menu)", () => {
    const activeAnnotationId = ref(5);

    function onOutsideClick(e) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (
        e.target.closest(".note") ||
        e.target.closest(".annotations") ||
        e.target.closest("mark[data-annotation-id]") ||
        e.target.closest("[data-highlight-annotation]")
      ) return;
      activeAnnotationId.value = null;
    }

    // Simulate an active text selection
    const textNode = document.createTextNode("selectable text");
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: document.body });
    onOutsideClick(event);

    // Should NOT have cleared because selection is active
    expect(activeAnnotationId.value).toBe(5);

    window.getSelection().removeAllRanges();
    document.body.removeChild(textNode);
  });

  it("onOutsideClick clears when no text selected and not on a mark", () => {
    const activeAnnotationId = ref(5);

    function onOutsideClick(e) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (
        e.target.closest(".note") ||
        e.target.closest(".annotations") ||
        e.target.closest("mark[data-annotation-id]") ||
        e.target.closest("[data-highlight-annotation]")
      ) return;
      activeAnnotationId.value = null;
    }

    window.getSelection().removeAllRanges();

    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: document.body });
    onOutsideClick(event);

    expect(activeAnnotationId.value).toBeNull();
  });

  it("onOutsideClick does NOT clear when clicking on a highlight mark", () => {
    const activeAnnotationId = ref(5);
    const mark = document.createElement("mark");
    mark.setAttribute("data-annotation-id", "1");
    document.body.appendChild(mark);

    function onOutsideClick(e) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (
        e.target.closest(".note") ||
        e.target.closest(".annotations") ||
        e.target.closest("mark[data-annotation-id]") ||
        e.target.closest("[data-highlight-annotation]")
      ) return;
      activeAnnotationId.value = null;
    }

    window.getSelection().removeAllRanges();
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: mark });
    onOutsideClick(event);

    expect(activeAnnotationId.value).toBe(5);
    document.body.removeChild(mark);
  });
});

describe("DockableAnnotations — selection menu guard (std-epgb)", () => {
  it("onOutsideClick preserves activeAnnotationId during text selection", () => {
    const activeAnnotationId = ref(3);

    function onOutsideClick(e) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (
        e.target.closest(".note") ||
        e.target.closest(".annotations") ||
        e.target.closest("mark[data-annotation-id]") ||
        e.target.closest("[data-highlight-annotation]")
      ) return;
      activeAnnotationId.value = null;
    }

    // Create text and select it
    const p = document.createElement("p");
    p.textContent = "Some manuscript text to select";
    document.body.appendChild(p);

    const range = document.createRange();
    range.selectNodeContents(p);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: p });
    onOutsideClick(event);

    // Must NOT clear — selection is active, menu should appear
    expect(activeAnnotationId.value).toBe(3);

    window.getSelection().removeAllRanges();
    document.body.removeChild(p);
  });
});

describe("DockableAnnotations — MutationObserver re-sort (std-z99r cont.)", () => {
  it("observer filters for MARK additions only", () => {
    const callback = vi.fn();

    function filterMutations(mutations) {
      const hasMarks = mutations.some((m) =>
        [...m.addedNodes].some(
          (n) => n.nodeType === 1 && (n.tagName === "MARK" || n.querySelector?.("mark")),
        ),
      );
      if (hasMarks) callback();
    }

    // Simulate a mutation with a mark
    const mark = document.createElement("mark");
    filterMutations([{ addedNodes: [mark] }]);
    expect(callback).toHaveBeenCalledTimes(1);

    // Simulate a mutation without a mark
    callback.mockClear();
    const div = document.createElement("div");
    filterMutations([{ addedNodes: [div] }]);
    expect(callback).not.toHaveBeenCalled();

    // Simulate a mutation with a mark nested inside a container
    callback.mockClear();
    const container = document.createElement("div");
    container.appendChild(document.createElement("mark"));
    filterMutations([{ addedNodes: [container] }]);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
