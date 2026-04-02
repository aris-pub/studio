import { ref } from "vue";

/**
 * Discovers DOM targets inside the manuscript for Vue component injection.
 *
 * After each innerHTML injection + onload.js execution, call scan() to find
 * .hr-info divs (for FeedbackIcon).
 */
export function useManuscriptSlots() {
  const hrInfoSlots = ref([]);

  let containerEl = null;

  function setContainer(el) {
    containerEl = el;
  }

  function clear() {
    hrInfoSlots.value = [];
  }

  function scan() {
    if (!containerEl) return;
    hrInfoSlots.value = [...containerEl.querySelectorAll(".hr-info")];
  }

  return { hrInfoSlots, setContainer, clear, scan };
}
