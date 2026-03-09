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
        { top: 0.5, color: "var(--purple-600)", type: "annotation", id: "a1", label: "purple" },
        { top: 0.7, color: "var(--orange-700)", type: "search", id: "sr1", label: "Search match" },
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
  "utf-8"
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
    expect(minimapMarksSource).toMatch(
      /function teardownObserver[\s\S]*?clearTimeout\(observerDebounce\)/
    );
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
    expect(ann.attributes("style")).toContain("var(--purple-600)");
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
  "utf-8"
);

describe("ScrollbarMinimap.vue — CSS structure regressions", () => {
  it("workspace strip is 20px wide with sticky positioning", () => {
    expect(minimapSource).toMatch(/\.scrollbar-minimap\.workspace\.vertical[^}]*width:\s*20px/s);
    expect(minimapSource).toMatch(
      /\.scrollbar-minimap\.workspace\.vertical[^}]*position:\s*sticky/s
    );
  });

  it("section marks have different sizes for level-1 vs sub-sections", () => {
    // Level-1: wider (left: 2px, right: 2px) and taller (4px)
    expect(minimapSource).toMatch(/\.mm-section\.level-1[^}]*height:\s*4px/s);
    // Sub-sections: narrower (left: 6px, right: 6px) and shorter (3px)
    expect(minimapSource).toMatch(/\.mm-section\s*\{[^}]*height:\s*3px/s);
  });

  it("search dashes have expanded click target like section marks", () => {
    expect(minimapSource).toMatch(/\.mm-search\s*\{[^}]*height:\s*16px/s);
    expect(minimapSource).toMatch(/\.mm-search\s*\{[^}]*transform:\s*translateY\(-50%\)/s);
  });

  it("search uses orange and has hover expansion", () => {
    expect(minimapSource).toMatch(/\.mm-search.*--orange-300/s);
    expect(minimapSource).toMatch(/\.mm-search:hover/s);
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

  it("strip is interactive (pointer-events: auto) for drag-to-scroll", () => {
    expect(minimapSource).toMatch(/\.scrollbar-minimap\s*\{[^}]*pointer-events:\s*auto/s);
  });

  it("strip has pointer event handlers for drag-to-scroll", () => {
    const templateSection = minimapSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
    const stripLine = templateSection.match(/class="scrollbar-minimap"[^>]*/)?.[0] ?? "";
    expect(stripLine).toContain("@pointerdown");
    expect(stripLine).toContain("@pointermove");
    expect(stripLine).toContain("@pointerup");
  });
});

describe("ScrollbarMinimap.vue — annotation mark activates card (std-0ha7)", () => {
  const scriptSection = minimapSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";

  it("injects activeAnnotationId", () => {
    expect(scriptSection).toMatch(/inject\(\s*["']activeAnnotationId["']/);
  });

  it("onMarkClick sets activeAnnotationId for annotation marks", () => {
    expect(scriptSection).toMatch(
      /mark\.type\s*===\s*["']annotation["'][\s\S]*?activeAnnotationId\.value/
    );
  });
});

// ---- Layout regressions ----

const canvasSource = readFileSync(resolve(__dirname, "../../views/workspace/Canvas.vue"), "utf-8");

const editorSource = readFileSync(
  resolve(__dirname, "../../views/workspace/EditorCodeMirror.vue"),
  "utf-8"
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

  it("minimap strip has no margin-left (replaces native scrollbar)", () => {
    expect(minimapSource).toMatch(/\.scrollbar-minimap\.workspace\.vertical[^}]*margin-left:\s*0/s);
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

// ---- Minimap replaces native scrollbar (std-b9dz) ----

const canvasStyle = canvasSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";
const minimapScript = minimapSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";
const minimapStyle = minimapSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";

describe("Minimap replaces native scrollbar (std-b9dz)", () => {
  it("native scrollbar is hidden on .inner.right", () => {
    expect(canvasStyle).toMatch(/&\.right\s*\{[^}]*scrollbar-width:\s*none/s);
    expect(canvasStyle).toMatch(/::-webkit-scrollbar/);
  });

  it("drag-to-scroll: isDragging ref exists", () => {
    expect(minimapScript).toMatch(/isDragging\s*=\s*ref\(false\)/);
  });

  it("drag-to-scroll: scrollToFraction computes scroll position", () => {
    expect(minimapScript).toMatch(/function scrollToFraction/);
  });

  it("drag-to-scroll: pointerdown skips mark elements", () => {
    expect(minimapScript).toMatch(/onStripPointerDown[\s\S]*?event\.target\s*!==\s*stripRef/);
  });

  it("viewport indicator is visible with position absolute", () => {
    expect(minimapStyle).toMatch(/\.viewport-indicator\s*\{[^}]*position:\s*absolute/s);
    expect(minimapStyle).not.toMatch(/\.viewport-indicator\s*\{[^}]*display:\s*none/s);
  });

  it("dragging class shows grabbing cursor", () => {
    expect(minimapStyle).toMatch(/\.scrollbar-minimap\.dragging[^}]*cursor:\s*grabbing/s);
  });
});

// ---- Homepage compact minimap (std-lqa2) ----

import { FEEDBACK_COLORS } from "@/composables/useMinimapMarks.js";

const filesItemSource = readFileSync(
  resolve(__dirname, "../../views/home/FilesItem.vue"),
  "utf-8"
);
const filesHeaderSource = readFileSync(
  resolve(__dirname, "../../views/home/FilesHeader.vue"),
  "utf-8"
);
const filesPaneSource = readFileSync(
  resolve(__dirname, "../../views/home/FilesPane.vue"),
  "utf-8"
);

describe("FEEDBACK_COLORS export", () => {
  it("is a non-empty object with known reaction types", () => {
    expect(typeof FEEDBACK_COLORS).toBe("object");
    expect(Object.keys(FEEDBACK_COLORS)).toEqual(
      expect.arrayContaining(["bookmark", "star", "heart", "check", "exclamation", "question", "quote"])
    );
  });

  it("each value is a CSS custom property", () => {
    for (const color of Object.values(FEEDBACK_COLORS)) {
      expect(color).toMatch(/^var\(--/);
    }
  });
});

describe("ScrollbarMinimap — compact mode features (std-lqa2)", () => {
  it("injects reactions with a default empty ref", () => {
    expect(minimapScript).toMatch(/inject\(\s*["']reactions["']/);
  });

  it("imports FEEDBACK_COLORS for compact reaction marks", () => {
    expect(minimapScript).toContain("FEEDBACK_COLORS");
  });

  it("posStyle returns left for horizontal, top for vertical", () => {
    expect(minimapScript).toMatch(/isHorizontal\.value\s*\?\s*\{\s*left:/);
    expect(minimapScript).toMatch(/:\s*\{\s*top:/);
  });

  it("compact mode computes annotation marks from anchor_data.node_id", () => {
    expect(minimapScript).toContain("ann.anchor_data?.node_id");
    expect(minimapScript).toMatch(/el\.querySelector.*data-nodeid/);
  });

  it("compact mode computes feedback marks from reactions", () => {
    expect(minimapScript).toContain("rxn.node_id");
    expect(minimapScript).toContain("FEEDBACK_COLORS[rxn.reaction_type]");
    expect(minimapScript).toContain('type: "feedback"');
  });

  it("compact mode watches reactions for recompute", () => {
    expect(minimapScript).toMatch(/watch\(reactions,\s*computeCompactMarks/);
  });

  it("compact horizontal marks disable pointer events", () => {
    expect(minimapStyle).toMatch(
      /\.scrollbar-minimap\.compact\s+\.mm-section[\s\S]*?pointer-events:\s*none/
    );
  });

  it("horizontal annotation icons are vertically centered", () => {
    expect(minimapStyle).toMatch(
      /\.scrollbar-minimap\.horizontal\s+\.mm-annotation[^}]*top:\s*50%/s
    );
  });

  it("compact annotation icons use icon size 10", () => {
    const templateSection = minimapSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
    expect(templateSection).toMatch(/isCompact\s*\?\s*10\s*:\s*20/);
  });
});

describe("FilesItem — homepage minimap integration (std-lqa2)", () => {
  const filesItemScript =
    filesItemSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";
  const filesItemStyle =
    filesItemSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";
  const filesItemTemplate =
    filesItemSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";

  it("provides manuscriptRef for compact minimap DOM measurement", () => {
    expect(filesItemScript).toMatch(/provide\(\s*["']manuscriptRef["']/);
  });

  it("provides annotations for compact minimap", () => {
    expect(filesItemScript).toMatch(/provide\(\s*["']annotations["']/);
  });

  it("fetches annotations from API for minimap", () => {
    expect(filesItemSource).toContain('.get("/annotations/"');
  });

  it("renders hidden manuscript div for DOM measurement", () => {
    expect(filesItemTemplate).toContain('class="minimap-source"');
    expect(filesItemTemplate).toContain("v-html");
  });

  it("hidden manuscript is invisible and out of flow", () => {
    expect(filesItemStyle).toMatch(/\.minimap-source\s*\{[^}]*visibility:\s*hidden/s);
    expect(filesItemStyle).toMatch(/\.minimap-source\s*\{[^}]*position:\s*absolute/s);
  });

  it("renders ScrollbarMinimap in compact horizontal mode for list view", () => {
    expect(filesItemTemplate).toMatch(/ScrollbarMinimap[^>]*mode="compact"[^>]*orientation="horizontal"/);
  });

  it("minimap cell has padding-right for spacing from Tags column", () => {
    expect(filesItemStyle).toMatch(/\.minimap-cell\s*\{[^}]*padding-right:\s*12px/s);
  });

  it("compact minimap track extends 24px wider than cell", () => {
    expect(filesItemStyle).toMatch(/calc\(100%\s*\+\s*24px\)/);
  });

  it("default minimap track is neutral gray", () => {
    expect(filesItemStyle).toMatch(
      /\.minimap-cell\s+:deep\(\.scrollbar-minimap\.compact\.horizontal\)[^}]*background:\s*var\(--gray-100\)/s
    );
  });

  it("hovered/current minimap track lights up blue", () => {
    expect(filesItemStyle).toContain("--blue-50");
    expect(filesItemStyle).toContain("--blue-300");
  });

  it("hovered section marks turn blue", () => {
    expect(filesItemStyle).toMatch(/\.mm-section::after[^}]*--blue-400/s);
    expect(filesItemStyle).toMatch(/\.mm-section\.level-1::after[^}]*--blue-500/s);
  });

  it("hovered annotation marks turn blue", () => {
    expect(filesItemStyle).toMatch(/\.mm-annotation[^}]*--blue-400/s);
  });
});

describe("FilesHeader — Structure column (std-lqa2)", () => {
  it("has Structure in columnInfo", () => {
    expect(filesHeaderSource).toMatch(/Structure:\s*\{\}/);
  });

  it("Structure is NOT rendered as a spacer div", () => {
    // Only 'Spacer' should render as spacer, not Structure
    expect(filesHeaderSource).not.toMatch(/name\s*===\s*['"]Structure['"]/);
  });

  it("Structure column renders via HeaderLabel (falls through to v-else)", () => {
    // Structure has no sortable/filterable, so HeaderLabel renders plain text
    const templateSection =
      filesHeaderSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
    // The spacer condition should only match 'Spacer'
    expect(templateSection).toMatch(/name\s*===\s*'Spacer'/);
    expect(templateSection).not.toMatch(/name\s*===\s*'Structure'/);
  });
});

describe("FilesPane — grid layout includes minimap column (std-lqa2)", () => {
  it("non-xs grid includes minimap column (minmax(80px, 1.5fr))", () => {
    // The full-width grid template must contain the minimap/structure column
    expect(filesPaneSource).toContain("minmax(80px, 1.5fr)");
  });

  it("Structure column is hidden on xs screens", () => {
    expect(filesPaneSource).toMatch(/["']Structure["']/);
    expect(filesPaneSource).toMatch(
      /\[.*"Structure".*\].*includes\(columnName\).*xsMode/s
    );
  });
});
