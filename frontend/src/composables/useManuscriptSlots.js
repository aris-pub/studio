import { ref } from "vue";

/**
 * Discovers DOM targets inside the manuscript for Vue component injection via Teleport.
 *
 * After each innerHTML injection + onload.js execution, call scan() to find
 * .hr-info divs (for FeedbackIcon) and figure[data-static] elements (for FigureToggle).
 * The reactive arrays update and Teleport components re-bind to the new targets.
 */
export function useManuscriptSlots() {
  const hrInfoSlots = ref([]);
  const figureToggleSlots = ref([]);

  let containerEl = null;

  function setContainer(el) {
    containerEl = el;
  }

  function clear() {
    hrInfoSlots.value = [];
    figureToggleSlots.value = [];
  }

  function scan() {
    if (!containerEl) return;
    hrInfoSlots.value = [...containerEl.querySelectorAll(".hr-info")];
    figureToggleSlots.value = [...containerEl.querySelectorAll("figure[data-static]")];
  }

  return { hrInfoSlots, figureToggleSlots, setContainer, clear, scan };
}
