<script setup>
  import { inject, computed } from "vue";

  const props = defineProps({
    showTitle: { type: Boolean, required: true },
    currentSection: { type: String, default: "" },
    component: { type: Object, default: null },
  });

  const file = inject("file");
  const fileSettings = inject("fileSettings");

  const focusMode = inject("focusMode");
  const mobileMode = inject("mobileMode");
  const isActive = computed(() => props.showTitle || props.component);
</script>

<template>
  <div class="topbar" :class="{ active: isActive, focus: focusMode, mobile: mobileMode }">
    <span v-if="!component && showTitle" class="topbar-section">{{ currentSection }}</span>
    <component :is="component" v-if="component" ref="middle-comp" :file="file" side="top" />
    <div class="topbar-trailing">
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

  .topbar.focus {
    display: none;
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
