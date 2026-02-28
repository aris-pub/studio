<script setup>
  import { ref, computed, reactive, watch, inject, onMounted, useTemplateRef } from "vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import {
    highlightSearchMatches,
    highlightSearchMatchesSource,
    clearHighlights,
    updateCurrentMatch,
  } from "@/utils/highlightSearchMatches.js";

  const manuscriptRef = inject("manuscriptRef");
  const file = inject("file");
  const showSearch = inject("showSearch", null);

  const searchInfo = reactive({
    isSearching: false,
    searchString: "",
    matches: [],
    sourceMatches: [],
    lastMatchScrolledTo: null,
  });

  const hintText = computed(() => {
    if (!searchInfo.isSearching) return "";
    if (searchInfo.matches.length === 0) return "No matches";
    const idx = (searchInfo.lastMatchScrolledTo ?? 0) + 1;
    return `${idx} of ${searchInfo.matches.length}`;
  });

  const buttonsDisabled = computed(() => {
    return searchInfo.isSearching && searchInfo.matches.length === 0;
  });

  const startSearch = () => {
    searchInfo.matches = highlightSearchMatches(manuscriptRef.value.$el, searchInfo.searchString);
    searchInfo.sourceMatches = highlightSearchMatchesSource(
      file.value.source,
      searchInfo.searchString
    );
    searchInfo.lastMatchScrolledTo = null;
    onNext();
  };

  const resetSearchState = () => {
    searchInfo.searchString = "";
    searchInfo.matches = [];
    searchInfo.sourceMatches = [];
    searchInfo.lastMatchScrolledTo = null;
  };

  const cancelSearch = () => {
    if (!searchInfo.isSearching) return;
    clearHighlights(manuscriptRef.value.$el);
    searchInfo.isSearching = false;
    resetSearchState();
  };

  watch(
    () => searchInfo.isSearching,
    (newVal) => {
      if (newVal) startSearch();
    }
  );

  const onSubmit = (searchString) => {
    if (!manuscriptRef.value) return;
    const trimmed = searchString.trim();
    if (trimmed === "") {
      if (searchInfo.isSearching) cancelSearch();
      return;
    }
    searchInfo.searchString = trimmed;
    searchInfo.isSearching = true;
  };

  const onNext = () => {
    if (!searchInfo.isSearching || searchInfo.matches.length === 0) return;
    const lastMatchScrolledTo =
      searchInfo.lastMatchScrolledTo === null ? -1 : searchInfo.lastMatchScrolledTo;
    const scrollTo = (lastMatchScrolledTo + 1) % searchInfo.matches.length;
    if (searchInfo.matches[scrollTo] && searchInfo.matches[scrollTo].mark) {
      searchInfo.matches[scrollTo].mark.scrollIntoView({ behavior: "smooth", block: "center" });
      searchInfo.lastMatchScrolledTo = scrollTo;
      updateCurrentMatch(searchInfo.matches, scrollTo);
    }
  };

  const onPrev = () => {
    if (!searchInfo.isSearching || searchInfo.matches.length === 0) return;
    const lastMatchScrolledTo =
      searchInfo.lastMatchScrolledTo === null
        ? searchInfo.matches.length + 1
        : searchInfo.lastMatchScrolledTo;
    const scrollTo =
      (lastMatchScrolledTo - 1 + searchInfo.matches.length) % searchInfo.matches.length;
    if (searchInfo.matches[scrollTo] && searchInfo.matches[scrollTo].mark) {
      searchInfo.matches[scrollTo].mark.scrollIntoView({ behavior: "smooth", block: "center" });
      searchInfo.lastMatchScrolledTo = scrollTo;
      updateCurrentMatch(searchInfo.matches, scrollTo);
    }
  };

  const closePanel = () => {
    if (searchInfo.isSearching) cancelSearch();
    if (showSearch) showSearch.value = false;
  };

  const onSearchBarCancel = () => {
    if (searchInfo.isSearching) {
      // First ESC: clear the active search but keep the panel open
      cancelSearch();
    } else {
      // Second ESC: search was already cleared, close the panel
      closePanel();
    }
  };

  const searchBar = useTemplateRef("searchBar");
  onMounted(() => searchBar.value?.focusInput());
  useKeyboardShortcuts({ "/": () => searchBar.value?.focusInput() });

  defineExpose({ closePanel });
</script>

<template>
  <div class="dockable-search">
    <SearchBar
      ref="searchBar"
      size="compact"
      :with-buttons="true"
      :hint-text="hintText"
      :buttons-disabled="buttonsDisabled"
      placeholder="search term..."
      :show-icon="true"
      :button-close="true"
      @submit="onSubmit"
      @next="onNext"
      @prev="onPrev"
      @cancel="onSearchBarCancel"
      @close="closePanel"
    />
  </div>
</template>

<style scoped>
  .dockable-search {
    width: 360px;
    box-shadow: var(--shadow-soft);
  }

  :deep(.s-wrapper) {
    gap: 4px;
  }

  :deep(.btn-close) {
    height: 24px;
    width: 24px;
    margin-inline: 4px;
    color: var(--dark);
  }
</style>

<style>
  .aris-search-highlight {
    background-color: var(--yellow-300);
  }

  .aris-search-highlight--current {
    background-color: var(--orange-300);
  }
</style>
