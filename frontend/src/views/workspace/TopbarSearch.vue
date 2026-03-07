<script setup>
  import { inject, onMounted, useTemplateRef, ref } from "vue";
  import { IconSearch, IconAdjustmentsHorizontal } from "@tabler/icons-vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import { useSearch } from "@/composables/useSearch.js";

  const manuscriptRef = inject("manuscriptRef");
  const file = inject("file");
  const showSearch = inject("showSearch", null);

  const {
    query,
    isSearching,
    isAdvanced,
    activeScopes,
    hintText,
    buttonsDisabled,
    search,
    next: onNext,
    prev: onPrev,
    clear,
    toggleScope,
    toggleAdvanced,
  } = useSearch({ manuscriptRef, file });

  const inputRef = useTemplateRef("inputRef");
  const searchText = ref("");

  const scopes = [
    { id: "document", label: "Document" },
    { id: "source", label: "Source" },
    { id: "marginalia", label: "Marginalia" },
    { id: "math", label: "Math" },
  ];

  const onEnter = (ev) => {
    if (!isSearching.value || searchText.value.trim() !== query.value) {
      search(searchText.value);
      return;
    }
    if (!ev.shiftKey) onNext();
    else onPrev();
  };

  const onEscape = () => {
    if (isSearching.value) {
      clear();
      searchText.value = "";
    } else {
      closePanel();
    }
  };

  const closePanel = () => {
    if (isSearching.value) {
      clear();
      searchText.value = "";
    }
    if (showSearch) showSearch.value = false;
  };

  const focusInput = () => inputRef.value?.focus();

  onMounted(() => focusInput());
  useKeyboardShortcuts({ "/": () => focusInput() });

  defineExpose({ closePanel, focusInput });
</script>

<template>
  <div class="topbar-search" :class="{ advanced: isAdvanced }">
    <div class="search-row">
      <IconSearch class="search-icon" />

      <input
        ref="inputRef"
        v-model="searchText"
        data-testid="search-input"
        type="text"
        class="text-caption"
        placeholder="search..."
        @keyup.enter.stop="onEnter"
        @keyup.escape="onEscape"
        @click.stop
      />

      <span v-if="hintText" data-testid="search-hint" class="hint text-caption">
        {{ hintText }}
      </span>

      <Button
        data-testid="search-prev"
        kind="tertiary"
        icon="ChevronLeft"
        size="sm"
        :disabled="buttonsDisabled"
        @click.stop="onPrev"
      />
      <Button
        data-testid="search-next"
        kind="tertiary"
        icon="ChevronRight"
        size="sm"
        :disabled="buttonsDisabled"
        @click.stop="onNext"
      />

      <Button
        data-testid="search-toggle-advanced"
        kind="tertiary"
        size="sm"
        :class="{ 'btn-active': isAdvanced }"
        @click.stop="toggleAdvanced"
      >
        <IconAdjustmentsHorizontal :size="18" />
      </Button>

      <ButtonClose data-testid="search-close" @close="closePanel" />
    </div>

    <div v-if="isAdvanced" data-testid="scope-chips" class="advanced-row">
      <div class="chips">
        <ButtonToggle
          v-for="scope in scopes"
          :key="scope.id"
          :data-testid="`scope-chip-${scope.id}`"
          :model-value="activeScopes.has(scope.id)"
          :text="scope.label"
          size="sm"
          type="outline"
          active-color="blue"
          @update:model-value="toggleScope(scope.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
  .topbar-search {
    display: flex;
    flex-direction: column;
    width: 100%;
    background-color: inherit;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .search-row {
    display: flex;
    align-items: center;
    height: calc(48px - var(--border-extrathin) * 2);
    padding-inline: 12px;
    gap: 4px;
  }

  .search-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    color: var(--gray-500);
  }

  input {
    flex: 1;
    border: none;
    background: transparent;
    font: inherit;
    color: var(--extra-dark);
    outline: none;
    height: 100%;
    padding-inline: 8px;
    min-width: 0;
  }

  input::placeholder {
    color: var(--gray-400);
  }

  .hint {
    color: var(--gray-700);
    white-space: nowrap;
    margin-inline: 4px;
  }

  .btn-active {
    color: var(--primary-600);
  }

  .advanced-row {
    display: flex;
    align-items: center;
    height: 40px;
    padding-inline: 12px;
    border-top: 1px solid var(--gray-100);
  }

  .chips {
    display: flex;
    gap: 8px;
    padding-inline: 28px;
  }
</style>

<style>
  .aris-search-highlight {
    background-color: var(--yellow-300);
  }

  .aris-search-highlight--current {
    background-color: var(--orange-300);
  }

  .aris-search-math-container {
    background-color: color-mix(in srgb, var(--yellow-200) 25%, transparent);
    border-radius: 3px;
  }

  math .aris-search-highlight {
    outline: 2px solid var(--yellow-500);
    outline-offset: 1px;
    border-radius: 2px;
  }

  math .aris-search-highlight--current {
    outline: 2.5px solid var(--orange-500);
    outline-offset: 1px;
    border-radius: 2px;
  }
</style>
