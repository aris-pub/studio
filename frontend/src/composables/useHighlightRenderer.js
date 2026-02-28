import { watch, nextTick, isRef } from "vue";
import { resolveAnchor } from "@/utils/anchorExtraction.js";

const COLOR_MAP = {
  purple: "var(--purple-200)",
  orange: "var(--orange-200)",
  green: "var(--green-200)",
  red: "var(--red-200)",
  pink: "var(--pink-200)",
  yellow: "var(--yellow-200)",
};

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
      mark.style.backgroundColor = COLOR_MAP[annotation.color] || COLOR_MAP.purple;
      mark.style.borderRadius = "2px";
      mark.style.cursor = "pointer";

      if (activeAnnotationId?.value === annotation.id) {
        mark.classList.add("active");
      }

      try {
        range.surroundContents(mark);
      } catch {
        // Range spans multiple elements — use extractContents fallback
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
      }
    }
  }

  function handleMarkClick(event) {
    const mark = event.target.closest("mark[data-annotation-id]");
    if (!mark || !activeAnnotationId) return;
    activeAnnotationId.value = parseInt(mark.getAttribute("data-annotation-id"));
  }

  function setupClickHandler() {
    const el = manuscriptRef.value?.$el || manuscriptRef.value;
    if (!el) return;
    el.addEventListener("click", handleMarkClick);
    return () => el.removeEventListener("click", handleMarkClick);
  }

  watch(
    [annotations, () => manuscriptRef.value],
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
        const id = parseInt(mark.getAttribute("data-annotation-id"));
        mark.classList.toggle("active", id === activeAnnotationId.value);
      });
    });
  }

  return { applyHighlights, clearHighlights, setupClickHandler };
}
