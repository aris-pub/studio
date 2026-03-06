<script setup>
  import { inject, computed, ref } from "vue";
  import { IconArrowUp } from "@tabler/icons-vue";

  const props = defineProps({
    showTitle: { type: Boolean, required: true },
    manuscriptTitle: { type: String, default: "" },
    currentSection: { type: String, default: "" },
    component: { type: Object, default: null },
  });

  const emit = defineEmits(["scroll-to-top"]);

  const file = inject("file");
  const fileSettings = inject("fileSettings");

  const focusMode = inject("focusMode");
  const mobileMode = inject("mobileMode");
  const isActive = computed(() => props.showTitle || props.component);

  const sectionLabel = computed(() => {
    if (props.currentSection) return props.currentSection;
    if (props.manuscriptTitle) return props.manuscriptTitle;
    return file.value?.title || "";
  });
</script>

<template>
  <div class="topbar" :class="{ active: isActive, focus: focusMode, mobile: mobileMode }">
    <span v-if="!component && showTitle" class="topbar-title">{{ sectionLabel }}</span>
    <component :is="component" v-if="component" ref="middle-comp" :file="file" side="top" />
    <div class="topbar-trailing">
      <slot name="trailing" />
      <button
        v-if="showTitle"
        class="scroll-to-top-btn"
        aria-label="Scroll to top"
        @click="emit('scroll-to-top')"
      >
        <IconArrowUp :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
  .topbar {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    border: var(--border-extrathin) solid transparent;
    border-radius: 8px 8px 0 0;
    background-color: transparent;
    padding-inline: 16px;
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

  .topbar-title {
    font-family: "Montserrat", sans-serif;
    font-weight: var(--weight-medium);
    font-size: 14px;
    line-height: 1.7143;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .topbar-trailing {
    position: absolute;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .scroll-to-top-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--gray-700);
    cursor: pointer;

    &:hover {
      background-color: var(--gray-100);
    }

    &:focus-visible {
      outline: 2px solid var(--border-action);
      outline-offset: 2px;
    }
  }
</style>
