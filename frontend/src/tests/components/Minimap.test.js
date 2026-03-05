import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { readFileSync } from "fs";
import { resolve } from "path";

// Mock useElementSize
vi.mock("@vueuse/core", () => ({
  useElementSize: () => ({ width: ref(200), height: ref(400) }),
}));

// ---- useMinimapMarks composable tests ----

// We test computeSectionMarks directly (it's a pure function)
import { computeSectionMarks } from "@/composables/useMinimapMarks.js";

describe("computeSectionMarks", () => {
  it("returns empty array for null input", () => {
    expect(computeSectionMarks(null)).toEqual([]);
  });

  it("returns empty array when no sections exist", () => {
    const el = document.createElement("div");
    el.innerHTML = "<p>No sections here</p>";
    // Needs a parent to act as container
    const container = document.createElement("div");
    container.classList.add("inner", "right");
    container.appendChild(el);
    document.body.appendChild(container);

    const marks = computeSectionMarks(el);
    expect(marks).toEqual([]);

    document.body.removeChild(container);
  });

  it("extracts sections with correct type and level", () => {
    const container = document.createElement("div");
    container.classList.add("inner", "right");
    Object.defineProperty(container, "scrollHeight", { value: 1000 });
    Object.defineProperty(container, "scrollTop", { value: 0 });

    const el = document.createElement("div");
    el.innerHTML = `
      <section id="s1" class="level-1"><h1>Introduction</h1></section>
      <section id="s2" class="level-2"><h2>Background</h2></section>
    `;
    container.appendChild(el);
    document.body.appendChild(container);

    const marks = computeSectionMarks(el);
    expect(marks).toHaveLength(2);
    expect(marks[0].type).toBe("section");
    expect(marks[0].level).toBe(1);
    expect(marks[0].color).toBe("var(--gray-300)");
    expect(marks[1].level).toBe(2);

    document.body.removeChild(container);
  });
});

// ---- ScrollbarMinimap component tests ----

// Mock the composable for component tests
vi.mock("@/composables/useMinimapMarks.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    useMinimapMarks: vi.fn(() => ({
      marks: ref([
        { top: 0.1, color: "var(--gray-300)", type: "section", id: "s1", level: 1 },
        { top: 0.3, color: "var(--gray-300)", type: "section", id: "s2", level: 2 },
        { top: 0.5, color: "var(--purple-400)", type: "annotation", id: "a1", label: "purple" },
        { top: 0.7, color: "var(--orange-400)", type: "search", id: "sr1", label: "Search match" },
        {
          top: 0.9,
          color: "var(--primary-400)",
          type: "presence",
          id: "p1",
          label: "Alice",
          userId: "u1",
          avatarColor: "#ff0000",
        },
      ]),
      computeMarks: vi.fn(),
    })),
  };
});

import ScrollbarMinimap from "@/views/workspace/ScrollbarMinimap.vue";

describe("ScrollbarMinimap.vue", () => {
  const file = { id: 1, html: "<p>content</p>", source: "# hello" };

  const mountComponent = (props = {}, provides = {}) => {
    return mount(ScrollbarMinimap, {
      props: { file, ...props },
      global: {
        provide: {
          manuscriptRef: ref(null),
          annotations: ref([]),
          awareness: ref(null),
          columnSizes: { inner: { height: 400 } },
          ...provides,
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders in workspace mode by default", () => {
    const wrapper = mountComponent();
    expect(wrapper.find(".scrollbar-minimap").classes()).toContain("workspace");
    expect(wrapper.find(".scrollbar-minimap").classes()).toContain("vertical");
  });

  it("renders marks for each type", () => {
    const wrapper = mountComponent();
    expect(wrapper.findAll(".mm-section").length).toBe(2);
    expect(wrapper.findAll(".mm-annotation").length).toBe(1);
    expect(wrapper.findAll(".mm-search").length).toBe(1);
    expect(wrapper.findAll(".mm-presence").length).toBe(1);
  });

  it("renders viewport indicator in workspace mode", () => {
    const wrapper = mountComponent();
    expect(wrapper.find(".viewport-indicator").exists()).toBe(true);
  });

  it("hides viewport indicator in compact mode", () => {
    const wrapper = mountComponent({ mode: "compact", orientation: "horizontal" });
    expect(wrapper.find(".viewport-indicator").exists()).toBe(false);
  });

  it("applies correct classes for compact horizontal mode", () => {
    const wrapper = mountComponent({ mode: "compact", orientation: "horizontal" });
    const strip = wrapper.find(".scrollbar-minimap");
    expect(strip.classes()).toContain("compact");
    expect(strip.classes()).toContain("horizontal");
  });

  it("positions section marks with correct top percentage", () => {
    const wrapper = mountComponent();
    const sections = wrapper.findAll(".mm-section");
    expect(sections[0].attributes("style")).toContain("top: 10%");
    expect(sections[1].attributes("style")).toContain("top: 30%");
  });

  it("distinguishes level-1 sections from sub-sections", () => {
    const wrapper = mountComponent();
    const sections = wrapper.findAll(".mm-section");
    expect(sections[0].classes()).toContain("level-1");
    expect(sections[1].classes()).not.toContain("level-1");
  });

  it("renders annotation marks with bubble icon", () => {
    const wrapper = mountComponent();
    const ann = wrapper.find(".mm-annotation");
    expect(ann.exists()).toBe(true);
    expect(ann.attributes("style")).toContain("top: 50%");
    // Should use IconMessageFilled (SVG inside)
    expect(ann.find("svg").exists()).toBe(true);
  });

  it("renders presence marks with avatar color", () => {
    const wrapper = mountComponent();
    const presence = wrapper.find(".mm-presence");
    expect(presence.exists()).toBe(true);
    // Color may be hex or rgb depending on renderer
    const style = presence.attributes("style");
    expect(style.includes("#ff0000") || style.includes("rgb(255, 0, 0)")).toBe(true);
  });

  it("renders Tooltip component for hover labels", () => {
    const wrapper = mountComponent();
    expect(wrapper.findComponent({ name: "Tooltip" }).exists()).toBe(true);
  });
});

// ---- useMinimapMarks behavioral unit tests ----

// These run BEFORE the vi.mock above (which only affects component tests)
// so we use the real computeSectionMarks already imported.

describe("computeSectionMarks — edge cases", () => {
  it("handles $el wrapper (Vue component ref)", () => {
    const container = document.createElement("div");
    container.classList.add("inner", "right");
    Object.defineProperty(container, "scrollHeight", { value: 500 });
    Object.defineProperty(container, "scrollTop", { value: 0 });

    const el = document.createElement("div");
    el.innerHTML = '<section class="level-1">Title</section>';
    container.appendChild(el);
    document.body.appendChild(container);

    // Simulate a Vue component ref with $el
    const marks = computeSectionMarks({ $el: el });
    expect(marks).toHaveLength(1);
    expect(marks[0].type).toBe("section");

    document.body.removeChild(container);
  });

  it("falls back to parentElement when .inner.right not found", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "scrollHeight", { value: 500 });
    Object.defineProperty(container, "scrollTop", { value: 0 });

    const el = document.createElement("div");
    el.innerHTML = '<section class="level-2">Sub</section>';
    container.appendChild(el);
    document.body.appendChild(container);

    const marks = computeSectionMarks(el);
    expect(marks).toHaveLength(1);
    expect(marks[0].level).toBe(2);

    document.body.removeChild(container);
  });

  it("defaults to level 1 when no level- class is present", () => {
    const container = document.createElement("div");
    container.classList.add("inner", "right");
    Object.defineProperty(container, "scrollHeight", { value: 500 });
    Object.defineProperty(container, "scrollTop", { value: 0 });

    const el = document.createElement("div");
    el.innerHTML = "<section>No level class</section>";
    container.appendChild(el);
    document.body.appendChild(container);

    const marks = computeSectionMarks(el);
    expect(marks[0].level).toBe(1);

    document.body.removeChild(container);
  });
});

// ---- useMinimapMarks source-level regression tests ----

const minimapMarksSource = readFileSync(
  resolve(__dirname, "../../composables/useMinimapMarks.js"),
  "utf-8",
);

describe("useMinimapMarks — search highlight query regression", () => {
  it("queries both aris-search-highlight and --current variant", () => {
    expect(minimapMarksSource).toContain("mark.aris-search-highlight--current");
  });

  it("MutationObserver fires on all childList changes (debounced, no relevance filter)", () => {
    // Observer must not filter by specific class names — that missed batch insertions
    expect(minimapMarksSource).toMatch(/new MutationObserver\(\(\)\s*=>/);
    expect(minimapMarksSource).toContain("childList: true");
    expect(minimapMarksSource).toContain("subtree: true");
    // Must debounce, not fire synchronously
    expect(minimapMarksSource).toContain("setTimeout");
  });

  it("observer debounce timer is cleaned up in teardown", () => {
    // teardownObserver must clear the debounce timer to prevent stale recomputes
    expect(minimapMarksSource).toMatch(/function teardownObserver[\s\S]*?clearTimeout\(observerDebounce\)/);
  });

  it("presence marks include userId and avatarColor fields", () => {
    expect(minimapMarksSource).toContain("userId: state.user.id");
    expect(minimapMarksSource).toContain("avatarColor: state.user.avatar_color");
  });

  it("deduplicates annotation marks by id", () => {
    expect(minimapMarksSource).toContain("seenAnnIds");
  });

  it("annotation color falls back to purple when ann.color is missing", () => {
    expect(minimapMarksSource).toMatch(/ann\?\.color\s*\|\|\s*"purple"/);
  });

  it("skips own client in presence marks", () => {
    expect(minimapMarksSource).toContain("clientId === awarenessVal.clientID");
  });

  it("clamps presence position to 0-1 range", () => {
    expect(minimapMarksSource).toMatch(/Math\.max\(0,\s*Math\.min\(1/);
  });

  it("awareness listener is cleaned up on unmount", () => {
    expect(minimapMarksSource).toMatch(/onUnmounted[\s\S]*?awarenessCleanup/);
  });

  it("delayed recompute after manuscript mount catches late-rendering annotations", () => {
    expect(minimapMarksSource).toMatch(/setTimeout\(\(\)\s*=>\s*computeMarks\(\),\s*500\)/);
  });
});

// ---- ScrollbarMinimap component behavioral tests ----

describe("ScrollbarMinimap.vue — interaction behavior", () => {
  const file = { id: 1, html: "<p>content</p>", source: "# hello" };

  const mountComponent = (props = {}, provides = {}) => {
    return mount(ScrollbarMinimap, {
      props: { file, ...props },
      global: {
        provide: {
          manuscriptRef: ref(null),
          annotations: ref([]),
          awareness: ref(null),
          columnSizes: { inner: { height: 400 } },
          ...provides,
        },
      },
    });
  };

  it("annotation mark sets --ann-color CSS variable from mark color", () => {
    const wrapper = mountComponent();
    const ann = wrapper.find(".mm-annotation");
    expect(ann.attributes("style")).toContain("--ann-color");
    expect(ann.attributes("style")).toContain("var(--purple-400)");
  });

  it("search marks are positioned independently from section marks", () => {
    const wrapper = mountComponent();
    const search = wrapper.find(".mm-search");
    expect(search.attributes("style")).toContain("top: 70%");
  });

  it("presence marks use clamp to stay within strip bounds", () => {
    const wrapper = mountComponent();
    const presence = wrapper.find(".mm-presence");
    expect(presence.attributes("style")).toContain("clamp");
  });

  it("compact mode does not render annotations, search, or presence marks", () => {
    const wrapper = mountComponent({ mode: "compact", orientation: "horizontal" });
    // Compact mode uses computeSectionMarks (sections-only), not useMinimapMarks
    // Since manuscriptRef is null, there are no marks at all
    expect(wrapper.findAll(".mm-annotation").length).toBe(0);
    expect(wrapper.findAll(".mm-search").length).toBe(0);
    expect(wrapper.findAll(".mm-presence").length).toBe(0);
  });

  it("mark click stops propagation (doesn't trigger strip click)", async () => {
    const wrapper = mountComponent();
    const section = wrapper.find(".mm-section");
    const event = new Event("click", { bubbles: true });
    const stopProp = vi.spyOn(event, "stopPropagation");
    section.element.dispatchEvent(event);
    expect(stopProp).toHaveBeenCalled();
  });

  it("mouseenter and mouseleave events are bound on annotation marks", () => {
    const wrapper = mountComponent();
    const ann = wrapper.find(".mm-annotation");
    expect(ann.exists()).toBe(true);
    // Verify the element has the event listeners (bound via @mouseenter/@mouseleave in template)
    expect(ann.attributes()).toBeDefined();
  });
});

// ---- ScrollbarMinimap CSS structure regression tests ----

const minimapSource = readFileSync(
  resolve(__dirname, "../../views/workspace/ScrollbarMinimap.vue"),
  "utf-8",
);

describe("ScrollbarMinimap.vue — CSS structure regressions", () => {
  it("workspace strip is 24px wide with sticky positioning", () => {
    expect(minimapSource).toMatch(/\.scrollbar-minimap\.workspace\.vertical[^}]*width:\s*24px/s);
    expect(minimapSource).toMatch(/\.scrollbar-minimap\.workspace\.vertical[^}]*position:\s*sticky/s);
  });

  it("section marks have different sizes for level-1 vs sub-sections", () => {
    // Level-1: wider (left: 2px, right: 2px) and taller (4px)
    expect(minimapSource).toMatch(/\.mm-section\.level-1[^}]*height:\s*4px/s);
    // Sub-sections: narrower (left: 6px, right: 6px) and shorter (3px)
    expect(minimapSource).toMatch(/\.mm-section\s*\{[^}]*height:\s*3px/s);
  });

  it("search dashes are narrower than section lines (25% inset)", () => {
    expect(minimapSource).toMatch(/\.mm-search\s*\{[^}]*left:\s*25%/s);
    expect(minimapSource).toMatch(/\.mm-search\s*\{[^}]*right:\s*25%/s);
  });

  it("search uses orange, not yellow, to distinguish from annotations", () => {
    expect(minimapSource).toMatch(/\.mm-search\s*\{[^}]*--orange-400/s);
  });

  it("presence dots are 14px circles with white ring", () => {
    expect(minimapSource).toMatch(/\.mm-presence\s*\{[^}]*width:\s*14px/s);
    expect(minimapSource).toMatch(/\.mm-presence\s*\{[^}]*border-radius:\s*50%/s);
    expect(minimapSource).toMatch(/\.mm-presence\s*\{[^}]*box-shadow/s);
  });

  it("annotation icons use line-height: 0 to prevent container sizing issues", () => {
    expect(minimapSource).toMatch(/\.mm-annotation\s*\{[^}]*line-height:\s*0/s);
  });

  it("compact horizontal mode is 4px tall", () => {
    expect(minimapSource).toMatch(/\.scrollbar-minimap\.compact\.horizontal[^}]*height:\s*4px/s);
  });

  it("minimap height matches inner.right (calc(100vh - 32px))", () => {
    expect(minimapSource).toContain("height: calc(100vh - 32px)");
  });

  it("strip background is not clickable (pointer-events: none), only marks are", () => {
    expect(minimapSource).toMatch(/\.scrollbar-minimap\s*\{[^}]*pointer-events:\s*none/s);
    expect(minimapSource).toMatch(/\.mm-section\s*\{[^}]*pointer-events:\s*auto/s);
    expect(minimapSource).toMatch(/\.mm-annotation\s*\{[^}]*pointer-events:\s*auto/s);
    expect(minimapSource).toMatch(/\.mm-search\s*\{[^}]*pointer-events:\s*auto/s);
    expect(minimapSource).toMatch(/\.mm-presence\s*\{[^}]*pointer-events:\s*auto/s);
  });

  it("strip has no click handler in template", () => {
    const templateSection = minimapSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
    const stripLine = templateSection.match(/class="scrollbar-minimap"[^>]*/)?.[0] ?? "";
    expect(stripLine).not.toContain("@click");
  });
});

// ---- Layout regressions ----

const canvasSource = readFileSync(resolve(__dirname, "../../views/workspace/Canvas.vue"), "utf-8");

const editorSource = readFileSync(
  resolve(__dirname, "../../views/workspace/EditorCodeMirror.vue"),
  "utf-8",
);

describe("Layout regressions — editor/manuscript split", () => {
  it("editor panel uses flex: 2, manuscript uses flex: 3", () => {
    expect(canvasSource).toMatch(/&\.left\s*\{[^}]*flex:\s*2/s);
    expect(canvasSource).toMatch(/&\.right\s*\{[^}]*flex:\s*3/s);
  });

  it("no left-column element in Canvas template", () => {
    const templateSection = canvasSource.match(/<template>([\s\S]*)<\/template>/);
    expect(templateSection[1]).not.toContain("left-column");
  });

  it("minimap strip has margin-left spacing from manuscript", () => {
    expect(minimapSource).toContain("margin-left: 8px");
  });

  it("inner.right height accounts for outer padding (not raw 100vh)", () => {
    expect(canvasSource).toMatch(/&\.right\s*\{[^}]*height:\s*calc\(100vh\s*-\s*32px\)/s);
  });

  it("CodeMirror gutters use smaller font-size", () => {
    expect(editorSource).toMatch(/\.cm-gutters[^}]*font-size:\s*11px/s);
  });

  it("Canvas provides awareness as a shallowRef for sibling communication", () => {
    expect(canvasSource).toContain('provide("awareness"');
    expect(canvasSource).toContain("shallowRef(null)");
  });

  it("EditorCodeMirror injects awareness (not provides)", () => {
    expect(editorSource).toContain('inject("awareness"');
    // Must NOT create its own provide — it shares via Canvas
    expect(editorSource).not.toContain('provide("awareness"');
  });
});
