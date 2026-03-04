import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";

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
        { top: 0.5, color: "var(--purple-400)", type: "annotation", id: "a1", label: "purple" },
        { top: 0.8, color: "var(--yellow-400)", type: "search", id: "sr1" },
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

  it("renders marks as positioned divs", () => {
    const wrapper = mountComponent();
    const marks = wrapper.findAll(".minimap-mark");
    expect(marks.length).toBe(3);
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

  it("positions marks with correct top percentage", () => {
    const wrapper = mountComponent();
    const marks = wrapper.findAll(".minimap-mark");
    const sectionMark = marks[0];
    expect(sectionMark.attributes("style")).toContain("top: 10%");
  });

  it("applies type-specific classes to marks", () => {
    const wrapper = mountComponent();
    const marks = wrapper.findAll(".minimap-mark");
    expect(marks[0].classes()).toContain("section");
    expect(marks[1].classes()).toContain("annotation");
    expect(marks[2].classes()).toContain("search");
  });

  it("renders Tooltip component for hover labels", () => {
    const wrapper = mountComponent();
    expect(wrapper.findComponent({ name: "Tooltip" }).exists()).toBe(true);
  });
});
