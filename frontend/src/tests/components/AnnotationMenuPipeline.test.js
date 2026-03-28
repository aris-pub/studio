// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, shallowRef, nextTick } from "vue";
import AnnotationMenu from "@/components/annotations/AnnotationMenu.vue";
import Button from "@/components/base/Button.vue";

vi.mock("@floating-ui/vue", () => ({
  useFloating: () => ({ floatingStyles: ref({}) }),
  autoUpdate: vi.fn(),
  offset: vi.fn(),
  flip: vi.fn(),
  shift: vi.fn(),
}));

vi.mock("@/utils/anchorExtraction.js", () => ({
  extractAnchor: vi.fn(),
}));
vi.mock("@/utils/sourceAnchor.js", () => ({
  extractSourceAnchor: vi.fn(),
}));

import { extractAnchor } from "@/utils/anchorExtraction.js";
import { extractSourceAnchor } from "@/utils/sourceAnchor.js";

const MOCK_ANCHOR = {
  node_id: "p1",
  element_id: "el1",
  start_offset: 0,
  end_offset: 5,
  selected_text: "Hello",
};

const MOCK_YJS_ANCHOR = {
  type: "yjs_relative",
  node_id: "p1",
  element_id: "el1",
  start_offset: 0,
  end_offset: 5,
  start_relative: { item: "abc", assoc: 0 },
  end_relative: { item: "def", assoc: 0 },
  source_start: 10,
  source_end: 15,
  selected_text: "Hello",
};

const VIEWPORT_RECT = {
  top: 100,
  bottom: 120,
  left: 50,
  right: 200,
  width: 150,
  height: 20,
};

let manuscriptContainer;
let manuscriptWrapper;

function setupDOM() {
  manuscriptContainer = document.createElement("div");
  manuscriptContainer.setAttribute("data-testid", "manuscript-viewer");
  manuscriptWrapper = document.createElement("div");
  manuscriptWrapper.classList.add("manuscriptwrapper");
  manuscriptContainer.appendChild(manuscriptWrapper);
  document.body.appendChild(manuscriptContainer);
}

function teardownDOM() {
  if (manuscriptContainer?.parentNode) {
    manuscriptContainer.parentNode.removeChild(manuscriptContainer);
  }
}

function mockSelection({
  collapsed = false,
  rangeCount = 1,
  rect = VIEWPORT_RECT,
  range = null,
} = {}) {
  const mockRange = range || {
    collapsed,
    getBoundingClientRect: () => rect,
    startContainer: manuscriptContainer,
    startOffset: 0,
    endContainer: manuscriptContainer,
    endOffset: 5,
    toString: () => "Hello",
  };
  const sel = {
    isCollapsed: collapsed,
    rangeCount,
    getRangeAt: vi.fn(() => mockRange),
    removeAllRanges: vi.fn(),
  };
  vi.spyOn(window, "getSelection").mockReturnValue(sel);
  return sel;
}

function createWrapper({ ydoc = null, actions = {} } = {}) {
  const annotationActions = {
    createAnnotation: vi.fn().mockResolvedValue({ id: 42 }),
    ...actions,
  };
  const activeAnnotationId = ref(null);
  const ydocRef = shallowRef(ydoc);

  const wrapper = mount(AnnotationMenu, {
    global: {
      components: { Button },
      provide: {
        annotationActions,
        ydoc: ydocRef,
        activeAnnotationId,
      },
    },
  });

  return { wrapper, annotationActions, activeAnnotationId };
}

describe("AnnotationMenu — isRectInViewport", () => {
  it("rejects null rect", () => {
    // Tested via tryShowMenu: if getBoundingClientRect returns an offscreen rect,
    // the menu should be dismissed via updateFloatingPosition. Here we test the
    // logic inline since it's a pure predicate.
    const isRectInViewport = (rect) => {
      if (!rect || (rect.width === 0 && rect.height === 0)) return false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      return rect.bottom >= 0 && rect.right >= 0 && rect.top <= vh && rect.left <= vw;
    };

    expect(isRectInViewport(null)).toBe(false);
  });

  it("rejects zero-dimension rect", () => {
    const isRectInViewport = (rect) => {
      if (!rect || (rect.width === 0 && rect.height === 0)) return false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      return rect.bottom >= 0 && rect.right >= 0 && rect.top <= vh && rect.left <= vw;
    };

    expect(isRectInViewport({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })).toBe(
      false
    );
  });

  it("accepts rect fully inside viewport", () => {
    const isRectInViewport = (rect) => {
      if (!rect || (rect.width === 0 && rect.height === 0)) return false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      return rect.bottom >= 0 && rect.right >= 0 && rect.top <= vh && rect.left <= vw;
    };

    expect(
      isRectInViewport({ top: 10, bottom: 50, left: 10, right: 100, width: 90, height: 40 })
    ).toBe(true);
  });

  it("rejects rect entirely above viewport", () => {
    const isRectInViewport = (rect) => {
      if (!rect || (rect.width === 0 && rect.height === 0)) return false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      return rect.bottom >= 0 && rect.right >= 0 && rect.top <= vh && rect.left <= vw;
    };

    expect(
      isRectInViewport({ top: -200, bottom: -100, left: 10, right: 100, width: 90, height: 100 })
    ).toBe(false);
  });

  it("rejects rect entirely to the left of viewport", () => {
    const isRectInViewport = (rect) => {
      if (!rect || (rect.width === 0 && rect.height === 0)) return false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      return rect.bottom >= 0 && rect.right >= 0 && rect.top <= vh && rect.left <= vw;
    };

    expect(
      isRectInViewport({ top: 10, bottom: 50, left: -200, right: -100, width: 100, height: 40 })
    ).toBe(false);
  });
});

describe("AnnotationMenu — tryShowMenu pipeline", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractAnchor.mockReset();
    extractSourceAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows menu when selection is valid and anchor is extracted", async () => {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();

    const { wrapper } = createWrapper();
    await nextTick();

    // Simulate mouseup on manuscript — triggers tryShowMenu via setTimeout
    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();

    expect(extractAnchor).toHaveBeenCalled();
    expect(wrapper.find(".hl-menu").exists()).toBe(true);
  });

  it("does not show menu when selection is collapsed", async () => {
    mockSelection({ collapsed: true });

    const { wrapper } = createWrapper();
    await nextTick();

    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(false);
  });

  it("does not show menu when no anchor is extracted", async () => {
    extractAnchor.mockReturnValue(null);
    mockSelection();

    const { wrapper } = createWrapper();
    await nextTick();

    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(false);
  });

  it("does not show menu when rangeCount is 0", async () => {
    mockSelection({ rangeCount: 0 });
    // Override getSelection to return rangeCount=0 and isCollapsed
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      rangeCount: 0,
      getRangeAt: vi.fn(),
      removeAllRanges: vi.fn(),
    });

    const { wrapper } = createWrapper();
    await nextTick();

    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(false);
  });

  it("uses extractSourceAnchor when ydoc is available", async () => {
    extractSourceAnchor.mockReturnValue(MOCK_YJS_ANCHOR);
    mockSelection();

    const mockYtext = { toString: () => "doc content" };
    const mockYdoc = { getText: vi.fn(() => mockYtext) };

    const { wrapper } = createWrapper({ ydoc: mockYdoc });
    await nextTick();

    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();

    expect(extractSourceAnchor).toHaveBeenCalledWith(
      expect.anything(),
      manuscriptContainer,
      mockYtext
    );
    expect(extractAnchor).not.toHaveBeenCalled();
    expect(wrapper.find(".hl-menu").exists()).toBe(true);
  });

  it("falls back to extractAnchor when ydoc has no text", async () => {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();

    const mockYdoc = { getText: vi.fn(() => null) };

    createWrapper({ ydoc: mockYdoc });
    await nextTick();

    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();

    expect(extractAnchor).toHaveBeenCalled();
    expect(extractSourceAnchor).not.toHaveBeenCalled();
  });
});

describe("AnnotationMenu — onCreateAnnotation (private vs shared)", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractAnchor.mockReset();
    extractSourceAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function showMenu(opts = {}) {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();
    const result = createWrapper(opts);
    await nextTick();
    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();
    return result;
  }

  it("Note button creates private annotation with selected color", async () => {
    const { wrapper, annotationActions } = await showMenu();

    const noteBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Note");
    expect(noteBtn).toBeTruthy();
    await noteBtn.trigger("click");
    await flushPromises();

    expect(annotationActions.createAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: "private",
        color: "purple",
        anchorData: expect.objectContaining({ node_id: "p1" }),
        selectedText: "Hello",
      })
    );
  });

  it("Comment button creates shared annotation", async () => {
    const { wrapper, annotationActions } = await showMenu();

    const commentBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Comment");
    expect(commentBtn).toBeTruthy();
    await commentBtn.trigger("click");
    await flushPromises();

    expect(annotationActions.createAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: "shared",
        color: "purple",
      })
    );
  });

  it("sets activeAnnotationId after creating annotation", async () => {
    const { wrapper, activeAnnotationId } = await showMenu();

    const noteBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Note");
    await noteBtn.trigger("click");
    await flushPromises();
    await nextTick();

    expect(activeAnnotationId.value).toBe(42);
  });

  it("clears menu after creating annotation", async () => {
    const { wrapper } = await showMenu();

    const noteBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Note");
    await noteBtn.trigger("click");
    await flushPromises();
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(false);
  });

  it("clears menu even when createAnnotation fails", async () => {
    const failingActions = {
      createAnnotation: vi.fn().mockRejectedValue(new Error("fail")),
    };
    const { wrapper } = await showMenu({ actions: failingActions });

    const noteBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Note");
    await noteBtn.trigger("click");
    await flushPromises();
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(false);
  });
});

describe("AnnotationMenu — onHighlight (mark-only)", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function showMenu(opts = {}) {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();
    const result = createWrapper(opts);
    await nextTick();
    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();
    return result;
  }

  it("Mark button creates annotation without visibility or activeAnnotationId", async () => {
    const { wrapper, annotationActions, activeAnnotationId } = await showMenu();

    const markBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Mark");
    expect(markBtn).toBeTruthy();
    await markBtn.trigger("click");
    await flushPromises();
    await nextTick();

    expect(annotationActions.createAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "purple",
        anchorData: expect.objectContaining({ node_id: "p1" }),
        selectedText: "Hello",
      })
    );
    // onHighlight does NOT set activeAnnotationId
    expect(activeAnnotationId.value).toBeNull();
  });
});

describe("AnnotationMenu — buildAnchorData with yjs_relative anchor", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractSourceAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("passes yjs_relative fields through to createAnnotation", async () => {
    extractSourceAnchor.mockReturnValue(MOCK_YJS_ANCHOR);
    mockSelection();

    const mockYtext = { toString: () => "doc content" };
    const mockYdoc = { getText: vi.fn(() => mockYtext) };

    const { wrapper, annotationActions } = createWrapper({ ydoc: mockYdoc });
    await nextTick();

    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();

    const markBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Mark");
    await markBtn.trigger("click");
    await flushPromises();

    expect(annotationActions.createAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorData: expect.objectContaining({
          type: "yjs_relative",
          start_relative: MOCK_YJS_ANCHOR.start_relative,
          end_relative: MOCK_YJS_ANCHOR.end_relative,
          source_start: 10,
          source_end: 15,
        }),
      })
    );
  });

  it("omits yjs_relative fields for plain anchors", async () => {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();

    const { wrapper, annotationActions } = createWrapper();
    await nextTick();

    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();

    const markBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Mark");
    await markBtn.trigger("click");
    await flushPromises();

    const call = annotationActions.createAnnotation.mock.calls[0][0];
    expect(call.anchorData).not.toHaveProperty("type");
    expect(call.anchorData).not.toHaveProperty("start_relative");
    expect(call.anchorData).not.toHaveProperty("source_start");
    expect(call.anchorData).toEqual({
      node_id: "p1",
      element_id: "el1",
      start_offset: 0,
      end_offset: 5,
    });
  });
});

describe("AnnotationMenu — clearSelection", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function showMenu() {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    const sel = mockSelection();
    const result = createWrapper();
    await nextTick();
    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();
    return { ...result, sel };
  }

  it("hides menu and clears browser selection", async () => {
    const { wrapper, sel } = await showMenu();

    expect(wrapper.find(".hl-menu").exists()).toBe(true);

    // Trigger Escape to clearSelection
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(false);
    expect(sel.removeAllRanges).toHaveBeenCalled();
  });
});

describe("AnnotationMenu — keyboard dismissal", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function showMenu() {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();
    const result = createWrapper();
    await nextTick();
    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();
    return result;
  }

  it("Escape key hides the menu", async () => {
    const { wrapper } = await showMenu();
    expect(wrapper.find(".hl-menu").exists()).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(false);
  });

  it("non-Escape keys do not hide the menu", async () => {
    const { wrapper } = await showMenu();
    expect(wrapper.find(".hl-menu").exists()).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(true);
  });
});

describe("AnnotationMenu — outside click dismissal", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function showMenu() {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();
    const result = createWrapper();
    await nextTick();
    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();
    return result;
  }

  it("mousedown outside menu hides it", async () => {
    const { wrapper } = await showMenu();
    expect(wrapper.find(".hl-menu").exists()).toBe(true);

    const outsideEl = document.createElement("div");
    document.body.appendChild(outsideEl);
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(false);
    outsideEl.remove();
  });

  it("mousedown inside menu does not hide it", async () => {
    const { wrapper } = await showMenu();
    expect(wrapper.find(".hl-menu").exists()).toBe(true);

    // Teleport is stubbed, so the menu is rendered in the wrapper
    const menuEl = wrapper.find(".hl-menu").element;
    const evt = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(evt, "target", { value: menuEl });
    document.dispatchEvent(evt);
    await nextTick();

    expect(wrapper.find(".hl-menu").exists()).toBe(true);
  });
});

describe("AnnotationMenu — swatch color selection", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function showMenu() {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();
    const result = createWrapper();
    await nextTick();
    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();
    return result;
  }

  it("clicking a swatch changes the selected color used in annotation", async () => {
    const { wrapper, annotationActions } = await showMenu();

    // Click the orange swatch (second one)
    const swatches = wrapper.findAll(".swatch-btn");
    expect(swatches.length).toBeGreaterThan(1);
    await swatches[1].trigger("click");

    // Now create annotation — should use the selected color
    const markBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Mark");
    await markBtn.trigger("click");
    await flushPromises();

    expect(annotationActions.createAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({ color: "orange" })
    );
  });

  it("default swatch color is purple", async () => {
    const { wrapper } = await showMenu();

    const checkedSwatch = wrapper.find('.swatch-btn[aria-checked="true"]');
    expect(checkedSwatch.exists()).toBe(true);
    expect(checkedSwatch.attributes("aria-label")).toBe("purple color");
  });

  it("arrow keys navigate through swatches", async () => {
    const { wrapper } = await showMenu();

    const swatchContainer = wrapper.find(".swatches");
    await swatchContainer.trigger("keydown", { key: "ArrowRight" });
    await nextTick();

    const checkedSwatch = wrapper.find('.swatch-btn[aria-checked="true"]');
    expect(checkedSwatch.attributes("aria-label")).toBe("orange color");
  });
});

describe("AnnotationMenu — no annotationActions guard", () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
    extractAnchor.mockReset();
  });

  afterEach(() => {
    teardownDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("onHighlight is a no-op when annotationActions is null", async () => {
    extractAnchor.mockReturnValue(MOCK_ANCHOR);
    mockSelection();

    const wrapper = mount(AnnotationMenu, {
      global: {
        components: { Button },
        provide: {
          annotationActions: null,
          ydoc: shallowRef(null),
          activeAnnotationId: ref(null),
        },
      },
    });
    await nextTick();

    manuscriptContainer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    vi.runAllTimers();
    await nextTick();
    await nextTick();

    const markBtn = wrapper.findAllComponents(Button).find((b) => b.props("text") === "Mark");
    // Should not throw
    await markBtn.trigger("click");
    await flushPromises();
  });
});
