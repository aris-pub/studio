<script setup>
  import { inject, ref, useTemplateRef } from "vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";

  const fileStore = inject("fileStore");

  /* Search */
  const onSearchSubmit = (searchString) => {
    const trimmedSearch = (searchString || "").trim();

    if (!trimmedSearch) {
      fileStore.value.clearFilter("search");
      return;
    }

    fileStore.value.applyFilter("search", (file) => {
      const searchTerms = trimmedSearch.toLowerCase().split(/\s+/);

      const searchableFields = [
        file.title || "",
        file.abstract || "",
        file.keywords || "",
        ...(file.tags || []).map((t) => t.name || ""),
        ...(file.collaborators || []).map((c) => c.name || ""),
      ];
      const searchableText = searchableFields.join(" ").toLowerCase();

      const hasMatch = searchTerms.some((term) => searchableText.includes(term));
      return !hasMatch;
    });
  };
  const searchBar = useTemplateRef("search-bar-ref");

  /* Ownership filter */
  const SEGMENTS = ["All", "My files", "Shared with me"];
  const activeSegment = ref(0);

  const onSegmentChange = (idx) => {
    activeSegment.value = idx;
    if (idx === 0) {
      fileStore.value.clearFilter("ownership");
    } else if (idx === 1) {
      fileStore.value.applyFilter("ownership", (file) => file.role !== "OWNER");
    } else if (idx === 2) {
      fileStore.value.applyFilter("ownership", (file) => file.role === "OWNER");
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts(
    {
      "/": { fn: () => searchBar.value.focusInput(), description: "search" },
    },
    true,
    "Home view"
  );

  defineExpose({ onSearchSubmit, activeSegment });
</script>

<template>
  <div class="tb-wrapper">
    <div class="tb-search">
      <SearchBar ref="search-bar-ref" @submit="onSearchSubmit" />
    </div>
    <div class="tb-filter" role="radiogroup" aria-label="File ownership filter">
      <SegmentedControl
        v-model="activeSegment"
        :labels="SEGMENTS"
        :default-active="0"
        @update:model-value="onSegmentChange"
      />
    </div>
  </div>
</template>

<style scoped>
  .tb-wrapper {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    column-gap: 48px;
    row-gap: 8px;
    max-width: calc(100% - (100px + 48px));

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
