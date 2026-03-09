<script setup>
  import { reactive, inject } from "vue";
  import HeaderLabel from "./FilesHeaderLabel.vue";

  const props = defineProps({
    mode: { type: String, default: "list" },
  });
  const fileStore = inject("fileStore");
  const xsMode = inject("xsMode");

  const columnInfo = {
    Title: { sortable: true, filterable: false, sortKey: "title" },
    Structure: {},
    Tags: { sortable: false, filterable: true, sortKey: "" },
    Spacer: {},
    Collaborators: { sortable: false, filterable: false, sortKey: "" },
    "Last edit": { sortable: true, filterable: false, sortKey: "last_edited_at" },
  };
  const columnState = reactive({
    Title: null,
    Tags: null,
    Collaborators: null,
    "Last edit": null,
  });
  const shouldShowColumn = inject("shouldShowColumn");

  const handleColumnSortEvent = (columnName, mode) => {
    const sortKey = columnInfo[columnName]["sortKey"];
    if (mode === "asc") {
      fileStore.value.sortFiles((a, b) => a[sortKey].localeCompare(b[sortKey]));
    } else if (mode === "desc") {
      fileStore.value.sortFiles((a, b) => b[sortKey].localeCompare(a[sortKey]));
    }
    for (const name in columnState) {
      if (name === columnName) continue;
      if (columnInfo[name]["sortable"]) {
        columnState[name] = "";
      }
    }
  };
  const handleColumnFilterEvent = (columnName, tags) => {
    if (tags.length === 0) {
      fileStore.value.clearFilters();
    } else {
      fileStore.value.filterFiles((file) => {
        const filterTagIds = tags.map((t) => t.id);
        const fileTagIds = file.tags.map((t) => t.id);
        return filterTagIds.some((id) => !fileTagIds.includes(id));
      });
    }
  };
</script>

<template>
  <Header :class="mode">
    <template v-for="name in Object.keys(columnInfo)" :key="name">
      <template v-if="shouldShowColumn(name, mode)">
        <div v-if="name === 'Spacer'" class="spacer"></div>
        <HeaderLabel
          v-else
          v-model="columnState[name]"
          :name="name"
          :sortable="columnInfo[name]['sortable']"
          :filterable="columnInfo[name]['filterable']"
          @sort="(mode) => handleColumnSortEvent(name, mode)"
          @filter="(tags) => handleColumnFilterEvent(name, tags)"
        />
      </template>
    </template>
    <!-- to complete the grid -->
    <span v-if="mode === 'list'" class="spacer spacer-1"></span>
  </Header>
</template>

<style scoped>
  .pane-header {
    padding-inline: 0;
  }

  .pane-header.list {
    & > *:first-child {
      padding-left: calc(16px - var(--border-med));
      border-top-left-radius: var(--border-radius);
      border-bottom-left-radius: var(--border-radius);
      border-left: var(--border-med) solid transparent;
    }

    & > *:last-child {
      padding-right: 8px;
      border-top-right-radius: var(--border-radius);
      border-bottom-right-radius: var(--border-radius);
    }
  }

  .pane-header.cards {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    padding-inline: 8px;

    & > .col-header {
      width: fit-content;
      padding-inline: 8px;
    }
  }
</style>
