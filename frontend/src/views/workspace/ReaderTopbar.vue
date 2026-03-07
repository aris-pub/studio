<script setup>
  import { inject, computed } from "vue";

  const props = defineProps({
    showTitle: { type: Boolean, required: true },
    revealed: { type: Boolean, default: false },
    currentSection: { type: String, default: "" },
    component: { type: Object, default: null },
    searchActive: { type: Boolean, default: false },
  });

  const file = inject("file");
  const fileSettings = inject("fileSettings");

  const focusMode = inject("focusMode");
  const mobileMode = inject("mobileMode");
  const isActive = computed(
    () => props.revealed || props.showTitle || props.component || props.searchActive
  );
</script>

<template>
  <div class="topbar" :class="{ active: isActive, full: showTitle && !searchActive, search: searchActive, focus: focusMode, mobile: mobileMode }">
    <slot v-if="searchActive" name="search" />
    <template v-else>
      <span v-if="!component && showTitle" class="topbar-section">{{ currentSection }}</span>
      <component :is="component" v-if="component" ref="middle-comp" :file="file" side="top" />
    </template>
    <div v-if="!searchActive" class="topbar-trailing">
      <slot name="trailing" />
    </div>
  </div>
</template>

<style scoped>
  .topbar {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    position: relative;
    border: var(--border-extrathin) solid transparent;
    border-radius: 8px 8px 0 0;
    background-color: transparent;
    padding-inline: 38px;
    overflow: clip;
  }

  .topbar.active {
    height: 48px;
    border-color: var(--border-primary);
    border-bottom: var(--border-extrathin) solid var(--border-primary);
    background-color: v-bind(fileSettings.background);
  }

  .topbar.search {
    height: auto;
    min-height: 48px;
    overflow: visible;
    padding-inline: 0;
    border-color: var(--border-primary);
    border-bottom: var(--border-extrathin) solid var(--border-primary);
    background-color: v-bind(fileSettings.background);
    box-shadow: var(--shadow-soft);
  }

  .topbar.full {
    box-shadow: var(--shadow-soft);
  }


  .topbar-section {
    font-family: "Montserrat", sans-serif;
    font-weight: var(--weight-medium);
    font-size: 14px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    padding-left: 12px;
    border-left: 3px solid var(--gray-300);
  }

  .topbar-trailing {
    position: absolute;
    right: 38px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

</style>
