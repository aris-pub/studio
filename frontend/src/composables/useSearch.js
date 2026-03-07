import { ref, shallowRef, markRaw, computed, watch } from "vue";
import {
  highlightSearchMatches,
  highlightMathMatches,
  highlightSearchMatchesSource,
  clearHighlights,
  updateCurrentMatch,
} from "@/utils/highlightSearchMatches.js";

export function useSearch({ manuscriptRef, file }) {
  const query = ref("");
  const isSearching = ref(false);
  const matches = shallowRef([]);
  const sourceMatches = ref([]);
  const currentIndex = ref(-1);

  const caseSensitive = ref(false);
  const wholeWord = ref(false);
  const isAdvanced = ref(false);
  const activeScopes = ref(new Set(["document"]));

  const hintText = computed(() => {
    if (!isSearching.value) return "";
    if (matches.value.length === 0) return "No matches";
    return `${currentIndex.value + 1} of ${matches.value.length}`;
  });

  const buttonsDisabled = computed(() => {
    return !isSearching.value || matches.value.length === 0;
  });

  function getManuscriptEl() {
    const ref = manuscriptRef.value;
    if (!ref) return null;
    return ref.$el || ref;
  }

  function search(searchString) {
    const trimmed = searchString.trim();
    if (!trimmed) return;

    const el = getManuscriptEl();
    if (!el) return;

    // Clear previous search
    if (isSearching.value) {
      clearHighlights(el);
    }

    query.value = trimmed;
    isSearching.value = true;

    const options = {};
    if (caseSensitive.value) options.caseSensitive = true;
    if (wholeWord.value) options.wholeWord = true;

    const scopes = activeScopes.value;
    let allMatches = [];

    if (scopes.has("document")) {
      const result = highlightSearchMatches(el, trimmed, options);
      if (result) allMatches.push(...result);
    }
    if (scopes.has("math")) {
      const mathResult = highlightMathMatches(el, trimmed, options);
      if (mathResult) allMatches.push(...mathResult);
    }

    matches.value = allMatches.length > 0 ? markRaw(allMatches) : [];
    sourceMatches.value = highlightSearchMatchesSource(file.value?.source || "", trimmed);

    if (matches.value.length > 0) {
      currentIndex.value = 0;
      navigateToMatch(0);
    } else {
      currentIndex.value = -1;
    }
  }

  function navigateToMatch(index) {
    updateCurrentMatch(matches.value, index);
    const match = matches.value[index];
    if (match?.mark) {
      match.mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function next() {
    if (!isSearching.value || matches.value.length === 0) return;
    currentIndex.value = (currentIndex.value + 1) % matches.value.length;
    navigateToMatch(currentIndex.value);
  }

  function prev() {
    if (!isSearching.value || matches.value.length === 0) return;
    currentIndex.value =
      (currentIndex.value - 1 + matches.value.length) % matches.value.length;
    navigateToMatch(currentIndex.value);
  }

  function toggleScope(scope) {
    const next = new Set(activeScopes.value);
    if (next.has(scope)) {
      next.delete(scope);
    } else {
      next.add(scope);
    }
    // Never allow empty scopes — revert to document
    if (next.size === 0) {
      next.add("document");
    }
    activeScopes.value = next;
    if (isSearching.value && query.value) {
      search(query.value);
    }
  }

  function toggleAdvanced() {
    isAdvanced.value = !isAdvanced.value;
  }

  function clear() {
    const el = getManuscriptEl();
    if (el && isSearching.value) {
      clearHighlights(el);
    }
    query.value = "";
    isSearching.value = false;
    matches.value = [];
    sourceMatches.value = [];
    currentIndex.value = -1;
  }

  return {
    query,
    isSearching,
    matches,
    sourceMatches,
    currentIndex,
    caseSensitive,
    wholeWord,
    isAdvanced,
    activeScopes,
    hintText,
    buttonsDisabled,
    search,
    next,
    prev,
    clear,
    toggleScope,
    toggleAdvanced,
  };
}
