<script setup>
  import { inject, useTemplateRef } from "vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";

  /* Search */
  const fileStore = inject("fileStore");
  const onSearchSubmit = (searchString) => {
    fileStore.value.clearFilters();

    // Handle null/undefined and trim whitespace
    const trimmedSearch = (searchString || "").trim();

    fileStore.value.filterFiles((file) => {
      // If search is empty/whitespace, don't filter anything (show all files)
      if (!trimmedSearch) {
        return false;
      }

      // Split search into terms and match any term
      const searchTerms = trimmedSearch.toLowerCase().split(/\s+/);
      const fileTitle = file.title.toLowerCase();

      // Show file if it contains any search term
      const hasMatch = searchTerms.some((term) => fileTitle.includes(term));

      // Return true to hide, false to show
      return !hasMatch;
    });
  };
  const searchBar = useTemplateRef("search-bar-ref");

  // Keyboard shortcuts
  useKeyboardShortcuts(
    {
      "/": { fn: () => searchBar.value.focusInput(), description: "search" },
    },
    true,
    "Home view"
  );
</script>

<template>
  <div class="tb-wrapper">
    <div class="tb-search">
      <SearchBar ref="search-bar-ref" @submit="onSearchSubmit" />
    </div>
  </div>
</template>

<style scoped>
  .tb-wrapper {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    column-gap: 48px;
    row-gap: 8px;
    max-width: calc(100% - (96px + 48px));

    &.mobile {
      background-color: var(--extra-light);
    }
  }

  .tb-wrapper .tb-search {
    flex: 1;
  }

  .tb-search {
    min-width: 192px;
    max-width: 500px;
  }
</style>
