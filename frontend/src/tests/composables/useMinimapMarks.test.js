import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { useMinimapMarks } from "@/composables/useMinimapMarks.js";

describe("useMinimapMarks — annotation mark detection", () => {
  let container, manuscriptEl;

  beforeEach(() => {
    container = document.createElement("div");
    container.classList.add("inner", "right");
    Object.defineProperty(container, "scrollHeight", { value: 1000 });
    Object.defineProperty(container, "scrollTop", { value: 0 });
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 1000, height: 1000 });

    manuscriptEl = document.createElement("div");
    container.appendChild(manuscriptEl);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("finds <mark> annotation elements", () => {
    manuscriptEl.innerHTML = '<p>Text <mark data-annotation-id="42">highlighted</mark> end</p>';
    const annotations = ref([{ id: 42, color: "purple", selected_text: "highlighted", visibility: "shared" }]);
    const manuscriptRef = ref(manuscriptEl);
    const { marks, computeMarks } = useMinimapMarks(manuscriptRef, { annotations });
    computeMarks();
    const annMarks = marks.value.filter((m) => m.type === "annotation");
    expect(annMarks.length).toBe(1);
    expect(annMarks[0].id).toBe("ann-42");
  });

  it("finds data-highlight-annotation elements (math highlights)", () => {
    manuscriptEl.innerHTML = '<p>Text <math data-highlight-annotation="99"><mi>x</mi></math> end</p>';
    const annotations = ref([{ id: 99, color: "blue", selected_text: "x", visibility: "shared" }]);
    const manuscriptRef = ref(manuscriptEl);
    const { marks, computeMarks } = useMinimapMarks(manuscriptRef, { annotations });
    computeMarks();
    const annMarks = marks.value.filter((m) => m.type === "annotation");
    expect(annMarks.length).toBe(1);
    expect(annMarks[0].id).toBe("ann-99");
  });

  it("deduplicates when both mark and data-highlight-annotation exist for same annotation", () => {
    manuscriptEl.innerHTML =
      '<p><mark data-annotation-id="50">text</mark> <math data-highlight-annotation="50"><mi>y</mi></math></p>';
    const annotations = ref([{ id: 50, color: "green", selected_text: "text", visibility: "private" }]);
    const manuscriptRef = ref(manuscriptEl);
    const { marks, computeMarks } = useMinimapMarks(manuscriptRef, { annotations });
    computeMarks();
    const annMarks = marks.value.filter((m) => m.type === "annotation");
    expect(annMarks.length).toBe(1);
  });

  it("uses annotation color from the annotations list", () => {
    manuscriptEl.innerHTML = '<p><mark data-annotation-id="7">text</mark></p>';
    const annotations = ref([{ id: 7, color: "red", selected_text: "text", visibility: "shared" }]);
    const manuscriptRef = ref(manuscriptEl);
    const { marks, computeMarks } = useMinimapMarks(manuscriptRef, { annotations });
    computeMarks();
    const annMarks = marks.value.filter((m) => m.type === "annotation");
    expect(annMarks[0].color).toBe("var(--red-600)");
  });
});
