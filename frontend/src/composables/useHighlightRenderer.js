import { watch, nextTick, isRef } from "vue";
import { resolveAnchor } from "@/utils/anchorExtraction.js";
import { HIGHLIGHT_COLORS } from "@/constants/annotationColors.js";

export function useHighlightRenderer(annotations, manuscriptRef, activeAnnotationId) {
  function clearHighlights(root) {
    if (!root) return;
    const marks = root.querySelectorAll("mark[data-annotation-id]");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    });
    // Remove highlight styling from math elements
    root.querySelectorAll("[data-highlight-annotation]").forEach((el) => {
      el.style.removeProperty("background-color");
      el.style.removeProperty("border-radius");
      el.style.removeProperty("--mark-border");
      el.removeAttribute("data-highlight-annotation");
    });
  }

  // Wrap a range in a single <mark> element. Uses extractContents when
  // surroundContents fails (cross-boundary ranges) so each annotation
  // always produces one contiguous mark instead of per-text-node fragments.
  function wrapRange(range, mark, colors) {
    try {
      range.surroundContents(mark);
    } catch {
      // Range crosses element boundaries — extractContents handles partial
      // selections by cloning the partially-selected ancestor elements.
      const contents = range.extractContents();
      mark.appendChild(contents);
      range.insertNode(mark);
    }

    // Style any math elements inside the mark — target <math> directly since
    // native MathML rendering can obscure parent backgrounds. Fall back to the
    // wrapper span if <math> lacks a style property (e.g. jsdom).
    const annId = mark.getAttribute("data-annotation-id");
    mark.querySelectorAll("span.math, .mathblock").forEach((mathEl) => {
      const mathTarget = mathEl.querySelector("math");
      const target = mathTarget?.style ? mathTarget : mathEl;
      target.style.backgroundColor = colors.bg;
      target.style.borderRadius = "2px";
      target.style.setProperty("--mark-border", colors.border);
      target.setAttribute("data-highlight-annotation", annId);
    });
  }

  function applyHighlights() {
    const el = manuscriptRef.value?.$el || manuscriptRef.value;
    if (!el) return;

    clearHighlights(el);

    const list = isRef(annotations) ? annotations.value : annotations;
    for (const annotation of list) {
      if (!annotation.anchor_data) continue;

      const anchorData = {
        ...annotation.anchor_data,
        selected_text: annotation.selected_text,
      };
      const range = resolveAnchor(anchorData, el);
      if (!range) continue;

      const mark = document.createElement("mark");
      mark.setAttribute("data-annotation-id", annotation.id);
      const colors = HIGHLIGHT_COLORS[annotation.color] || HIGHLIGHT_COLORS.purple;
      mark.style.backgroundColor = colors.bg;
      mark.style.setProperty("--mark-border", colors.border);
      mark.style.borderRadius = "2px";
      mark.style.cursor = "pointer";

      if (activeAnnotationId?.value === annotation.id) {
        mark.classList.add("active");
      }

      wrapRange(range, mark, colors);
    }
  }

  function handleMarkClick(event) {
    const mark = event.target.closest("mark[data-annotation-id]");
    const mathHighlight = event.target.closest("[data-highlight-annotation]");
    const annId =
      mark?.getAttribute("data-annotation-id") ||
      mathHighlight?.getAttribute("data-highlight-annotation");
    if (!annId || !activeAnnotationId) return;
    activeAnnotationId.value = parseInt(annId, 10);
  }

  function setupClickHandler() {
    const el = manuscriptRef.value?.$el || manuscriptRef.value;
    if (!el) return;
    el.addEventListener("click", handleMarkClick);
    return () => el.removeEventListener("click", handleMarkClick);
  }

  watch(
    annotations,
    async () => {
      await nextTick();
      applyHighlights();
    },
    { deep: true }
  );

  if (activeAnnotationId) {
    watch(activeAnnotationId, () => {
      const el = manuscriptRef.value?.$el || manuscriptRef.value;
      if (!el) return;
      el.querySelectorAll("mark[data-annotation-id]").forEach((mark) => {
        const id = parseInt(mark.getAttribute("data-annotation-id"), 10);
        mark.classList.toggle("active", id === activeAnnotationId.value);
      });
      el.querySelectorAll("[data-highlight-annotation]").forEach((mathEl) => {
        const id = parseInt(mathEl.getAttribute("data-highlight-annotation"), 10);
        mathEl.classList.toggle("active", id === activeAnnotationId.value);
      });
    });
  }

  return { applyHighlights, clearHighlights, setupClickHandler };
}
