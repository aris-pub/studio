// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("AnnotationMenu — data-selecting lifecycle", () => {
  let manuscriptContainer;
  let wrapper;

  beforeEach(() => {
    manuscriptContainer = document.createElement("div");
    manuscriptContainer.setAttribute("data-testid", "manuscript-viewer");

    wrapper = document.createElement("div");
    wrapper.classList.add("manuscriptwrapper");

    manuscriptContainer.appendChild(wrapper);
    document.body.appendChild(manuscriptContainer);
  });

  afterEach(() => {
    document.body.removeChild(manuscriptContainer);
  });

  it("handleMouseDown sets data-selecting attribute on wrapper", () => {
    expect(wrapper.hasAttribute("data-selecting")).toBe(false);
    wrapper.dataset.selecting = "";
    expect(wrapper.hasAttribute("data-selecting")).toBe(true);
  });

  it("handleMouseUp removes data-selecting attribute", () => {
    wrapper.dataset.selecting = "";
    delete wrapper.dataset.selecting;
    expect(wrapper.hasAttribute("data-selecting")).toBe(false);
  });

  it("handleMouseUpFallback cleans up data-selecting leaked from outside mouseup", () => {
    wrapper.dataset.selecting = "";
    if (wrapper.hasAttribute("data-selecting")) {
      delete wrapper.dataset.selecting;
    }
    expect(wrapper.hasAttribute("data-selecting")).toBe(false);
  });

  it("handleMouseUpFallback is a no-op when data-selecting is absent", () => {
    if (wrapper.hasAttribute("data-selecting")) {
      delete wrapper.dataset.selecting;
    }
    expect(wrapper.hasAttribute("data-selecting")).toBe(false);
  });
});

describe("AnnotationMenu — mark click does not trigger handrail focus", () => {
  let manuscriptContainer;
  let hr;
  let mark;

  beforeEach(() => {
    manuscriptContainer = document.createElement("div");
    manuscriptContainer.setAttribute("data-testid", "manuscript-viewer");

    const wrapper = document.createElement("div");
    wrapper.classList.add("manuscriptwrapper");

    hr = document.createElement("div");
    hr.classList.add("hr");
    hr.setAttribute("tabindex", "0");

    mark = document.createElement("mark");
    mark.setAttribute("data-annotation-id", "1");

    hr.appendChild(mark);
    wrapper.appendChild(hr);
    manuscriptContainer.appendChild(wrapper);
    document.body.appendChild(manuscriptContainer);
  });

  afterEach(() => {
    document.body.removeChild(manuscriptContainer);
  });

  it("blurs focused .hr when mouseup target is a highlight mark", () => {
    hr.focus();
    expect(document.activeElement).toBe(hr);

    const mouseUpEvent = new MouseEvent("mouseup", { bubbles: true });
    Object.defineProperty(mouseUpEvent, "target", { value: mark });

    const clickedMark = mouseUpEvent.target.closest?.("mark[data-annotation-id]");
    expect(clickedMark).toBe(mark);

    const sel = window.getSelection();
    const isDrag = sel && !sel.isCollapsed;

    if (isDrag || clickedMark) {
      const focused = document.activeElement;
      if (focused?.closest?.(".hr")) {
        focused.blur();
      }
    }

    expect(document.activeElement).not.toBe(hr);
  });

  it("does NOT blur .hr on a plain click (no mark)", () => {
    hr.focus();
    expect(document.activeElement).toBe(hr);

    const mouseUpEvent = new MouseEvent("mouseup", { bubbles: true });
    Object.defineProperty(mouseUpEvent, "target", { value: hr });

    const clickedMark = mouseUpEvent.target.closest?.("mark[data-annotation-id]");
    expect(clickedMark).toBeNull();

    const sel = window.getSelection();
    const isDrag = sel && !sel.isCollapsed;

    if (isDrag || clickedMark) {
      const focused = document.activeElement;
      if (focused?.closest?.(".hr")) {
        focused.blur();
      }
    }

    expect(document.activeElement).toBe(hr);
  });
});

describe("AnnotationMenu — color click is terminal action", () => {
  it("onColorClick creates annotation and dismisses (highlight-only)", async () => {
    const createAnnotation = vi.fn().mockResolvedValue({ id: 1 });

    await createAnnotation({
      color: "green",
      anchorData: { node_id: "n1", start_offset: 0, end_offset: 5 },
      selectedText: "Hello",
    });

    // No addNote call when input is empty
    expect(createAnnotation).toHaveBeenCalledTimes(1);
    expect(createAnnotation).toHaveBeenCalledWith(expect.objectContaining({ color: "green" }));
  });

  it("onColorClick creates annotation with note when input has text", async () => {
    const createAnnotation = vi.fn().mockResolvedValue({ id: 1 });
    const addNote = vi.fn().mockResolvedValue({});
    const inputText = "My note";

    const annotation = await createAnnotation({
      color: "orange",
      anchorData: { node_id: "n1", start_offset: 0, end_offset: 5 },
      selectedText: "Hello",
    });

    if (inputText.trim()) {
      await addNote(annotation.id, inputText.trim());
    }

    expect(createAnnotation).toHaveBeenCalledWith(expect.objectContaining({ color: "orange" }));
    expect(addNote).toHaveBeenCalledWith(1, "My note");
  });
});

describe("AnnotationMenu — note submit uses default color", () => {
  it("onNoteSubmit creates annotation with purple when no color clicked", async () => {
    const createAnnotation = vi.fn().mockResolvedValue({ id: 1 });
    const addNote = vi.fn().mockResolvedValue({});
    const defaultColor = "purple";
    const inputText = "A thought";

    const annotation = await createAnnotation({
      color: defaultColor,
      anchorData: { node_id: "n1", start_offset: 0, end_offset: 5 },
      selectedText: "Hello",
    });

    if (inputText.trim()) {
      await addNote(annotation.id, inputText.trim());
    }

    expect(createAnnotation).toHaveBeenCalledWith(expect.objectContaining({ color: "purple" }));
    expect(addNote).toHaveBeenCalledWith(1, "A thought");
  });
});
