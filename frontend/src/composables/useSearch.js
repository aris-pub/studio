import { ref, shallowRef, markRaw, computed, watch, nextTick, toRaw } from "vue";
import {
  SearchQuery,
  setSearchQuery,
  findNext as cmFindNext,
  findPrevious as cmFindPrevious,
  getSearchQuery,
} from "@codemirror/search";
import {
  highlightSearchMatches,
  highlightMathMatches,
  clearHighlights,
  updateCurrentMatch,
} from "@/utils/highlightSearchMatches.js";

function countCMMatches(view, searchQuery) {
  if (!view || !searchQuery.valid) return 0;
  const cursor = searchQuery.getCursor(view.state);
  let count = 0;
  while (!cursor.next().done) count++;
  return count;
}

function clearCMSearch(cmView) {
  const view = toRaw(cmView?.value);
  if (!view) return;
  const empty = new SearchQuery({ search: "" });
  view.dispatch({ effects: setSearchQuery.of(empty) });
}

export function useSearch({ manuscriptRef, file, cmView }) {
  const query = ref("");
  const isSearching = ref(false);
  const matches = shallowRef([]);
  const sourceMatchCount = ref(0);
  const currentIndex = ref(-1);

  const caseSensitive = ref(false);
  const wholeWord = ref(false);
  const isAdvanced = ref(false);
  const activeScopes = ref(new Set(["output"]));

  const totalMatchCount = computed(() => {
    const outputCount = matches.value.length;
    const srcCount = activeScopes.value.has("source") ? sourceMatchCount.value : 0;
    return outputCount + srcCount;
  });

  const hintText = computed(() => {
    if (!isSearching.value) return "";
    const total = totalMatchCount.value;
    if (total === 0) return "No matches";

    const scopes = activeScopes.value;
    const hasOutput = scopes.has("output");
    const hasSource = scopes.has("source");

    if (hasOutput && !hasSource) {
      return `${currentIndex.value + 1} of ${matches.value.length}`;
    }
    if (hasSource && !hasOutput) {
      return `${sourceMatchCount.value} in source`;
    }
    // Both scopes active
    const parts = [];
    if (matches.value.length > 0) {
      parts.push(`${currentIndex.value + 1} of ${matches.value.length} in output`);
    }
    if (sourceMatchCount.value > 0) {
      parts.push(`${sourceMatchCount.value} in source`);
    }
    return parts.join(", ") || "No matches";
  });

  const buttonsDisabled = computed(() => {
    return !isSearching.value || matches.value.length === 0;
  });

  function getManuscriptEl() {
    const ref = manuscriptRef.value;
    if (!ref) return null;
    return ref.$el || ref;
  }

  function syncCMSearch(trimmed) {
    const view = toRaw(cmView?.value);
    if (!view) {
      sourceMatchCount.value = 0;
      return;
    }

    const sq = new SearchQuery({
      search: trimmed,
      caseSensitive: caseSensitive.value,
      wholeWord: wholeWord.value,
    });
    view.dispatch({ effects: setSearchQuery.of(sq) });
    sourceMatchCount.value = countCMMatches(view, sq);

    // Position CM on the first match so highlights appear immediately
    if (sourceMatchCount.value > 0) {
      cmFindNext(view);
    }
  }

  function search(searchString) {
    const trimmed = searchString.trim();
    if (!trimmed) return;

    const el = getManuscriptEl();
    if (!el) return;

    if (isSearching.value) {
      clearHighlights(el);
    }

    query.value = trimmed;
    isSearching.value = true;

    const options = {};
    if (caseSensitive.value) options.caseSensitive = true;
    if (wholeWord.value) options.wholeWord = true;

    const scopes = activeScopes.value;
    const allMatches = [];

    if (scopes.has("output")) {
      const result = highlightSearchMatches(el, trimmed, options);
      if (result) allMatches.push(...result);
      const mathResult = highlightMathMatches(el, trimmed, options);
      if (mathResult) allMatches.push(...mathResult);
    }

    matches.value = allMatches.length > 0 ? markRaw(allMatches) : [];

    if (scopes.has("source")) {
      syncCMSearch(trimmed);
    } else {
      clearCMSearch(cmView);
      sourceMatchCount.value = 0;
    }

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
    if (!isSearching.value) return;
    if (matches.value.length > 0) {
      currentIndex.value = (currentIndex.value + 1) % matches.value.length;
      navigateToMatch(currentIndex.value);
    }
    // Also advance CM cursor if source scope is active
    const view = toRaw(cmView?.value);
    if (view && activeScopes.value.has("source")) {
      cmFindNext(view);
    }
  }

  function prev() {
    if (!isSearching.value) return;
    if (matches.value.length > 0) {
      currentIndex.value = (currentIndex.value - 1 + matches.value.length) % matches.value.length;
      navigateToMatch(currentIndex.value);
    }
    const view = toRaw(cmView?.value);
    if (view && activeScopes.value.has("source")) {
      cmFindPrevious(view);
    }
  }

  function toggleScope(scope) {
    const next = new Set(activeScopes.value);
    if (next.has(scope)) {
      next.delete(scope);
    } else {
      next.add(scope);
    }
    if (next.size === 0) {
      next.add("output");
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
    clearCMSearch(cmView);
    query.value = "";
    isSearching.value = false;
    matches.value = [];
    sourceMatchCount.value = 0;
    currentIndex.value = -1;
  }

  // Re-run search when manuscript HTML changes (recompilation)
  watch(
    () => file.value?.html,
    async () => {
      if (!isSearching.value || !query.value) return;
      await nextTick();
      search(query.value);
    }
  );

  return {
    query,
    isSearching,
    matches,
    sourceMatchCount,
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
