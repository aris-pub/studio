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

  it("presence marks include userId and avatarColor fields", () => {
    expect(minimapMarksSource).toContain("userId: state.user.id");
    expect(minimapMarksSource).toContain("avatarColor: state.user.avatar_color");
  });

  it("deduplicates annotation marks by id", () => {
    expect(minimapMarksSource).toContain("seenAnnIds");
  });
});

// ---- Layout regressions ----

const canvasSource = readFileSync(resolve(__dirname, "../../views/workspace/Canvas.vue"), "utf-8");

const minimapSource = readFileSync(
  resolve(__dirname, "../../views/workspace/ScrollbarMinimap.vue"),
  "utf-8"
);

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

  it("minimap strip has margin-left spacing from manuscript", () => {
    expect(minimapSource).toContain("margin-left: 8px");
  });

  it("inner.right height accounts for outer padding (not raw 100vh)", () => {
    expect(canvasSource).toMatch(/&\.right\s*\{[^}]*height:\s*calc\(100vh\s*-\s*32px\)/s);
  });

  it("CodeMirror gutters use smaller font-size", () => {
    expect(editorSource).toMatch(/\.cm-gutters[^}]*font-size:\s*11px/s);
  });
});
