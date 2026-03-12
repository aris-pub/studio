<script setup>
  import { inject, onMounted, useTemplateRef } from "vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import { useSearch } from "@/composables/useSearch.js";

  const manuscriptRef = inject("manuscriptRef");
  const file = inject("file");
  const showSearch = inject("showSearch", null);

  const {
    isSearching,
    hintText,
    buttonsDisabled,
    search,
    next: onNext,
    prev: onPrev,
    clear,
  } = useSearch({ manuscriptRef, file });

  const onSubmit = (searchString) => {
    const trimmed = searchString.trim();
    if (trimmed === "") {
      if (isSearching.value) clear();
      return;
    }
    search(trimmed);
  };

  const closePanel = () => {
    if (isSearching.value) clear();
    if (showSearch) showSearch.value = false;
  };

  const onSearchBarCancel = () => {
    if (isSearching.value) {
      clear();
    } else {
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
  @import "@/assets/css/search-highlights.css";
</style>
