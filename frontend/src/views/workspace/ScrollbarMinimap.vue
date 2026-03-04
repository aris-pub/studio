<script setup>
  import { ref, computed, inject, watch, onMounted, onUnmounted } from "vue";
  import { useMinimapMarks, computeSectionMarks } from "@/composables/useMinimapMarks.js";
  import Tooltip from "@/components/base/Tooltip.vue";

  const hoveredMark = ref(null);
  const hoveredEl = ref(null);
  const tooltipText = computed(() => hoveredMark.value?.label || "");

  function onMarkEnter(event, mark) {
    hoveredEl.value = event.currentTarget;
    hoveredMark.value = mark;
  }

  function onMarkLeave() {
    hoveredEl.value = null;
    hoveredMark.value = null;
  }

  const props = defineProps({
    file: { type: Object, required: true },
    mode: { type: String, default: "workspace" },
    orientation: { type: String, default: "vertical" },
  });

  const manuscriptRef = inject("manuscriptRef", ref(null));
  const annotations = inject("annotations", ref([]));
  const awareness = inject("awareness", ref(null));
  const columnSizes = inject("columnSizes", null);

  const stripRef = ref(null);
  const scrollContainer = ref(null);
  const viewportTop = ref(0);
  const viewportHeight = ref(0);

  const isCompact = computed(() => props.mode === "compact");
  const isHorizontal = computed(() => props.orientation === "horizontal");

  // Marks: full computation for workspace, sections-only for compact
  const { marks, computeMarks } = isCompact.value
    ? { marks: ref([]), computeMarks: () => {} }
    : useMinimapMarks(manuscriptRef, { annotations, awareness, file: computed(() => props.file) });

  const compactMarks = ref([]);
  if (isCompact.value) {
    watch(
      () => manuscriptRef?.value,
      () => {
        compactMarks.value = computeSectionMarks(manuscriptRef?.value);
      },
      { immediate: true }
    );
  }

  const displayMarks = computed(() => (isCompact.value ? compactMarks.value : marks.value));

  function updateViewport() {
    if (!scrollContainer.value) return;
    const el = scrollContainer.value;
    const sh = el.scrollHeight;
    if (sh === 0) return;
    viewportTop.value = el.scrollTop / sh;
    viewportHeight.value = el.clientHeight / sh;
  }

  function onScroll() {
    updateViewport();
  }

  function onStripClick(event) {
    if (isCompact.value || !scrollContainer.value) return;
    const rect = stripRef.value.getBoundingClientRect();
    const fraction = isHorizontal.value
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    const sh = scrollContainer.value.scrollHeight;
    const ch = scrollContainer.value.clientHeight;
    scrollContainer.value.scrollTo({
      top: fraction * sh - ch / 2,
      behavior: "smooth",
    });
  }

  function onMarkClick(event, mark) {
    event.stopPropagation();
    if (isCompact.value || !scrollContainer.value) return;
    const sh = scrollContainer.value.scrollHeight;
    const ch = scrollContainer.value.clientHeight;
    scrollContainer.value.scrollTo({
      top: mark.top * sh - ch / 2,
      behavior: "smooth",
    });
  }

  onMounted(() => {
    if (isCompact.value) return;
    const el = stripRef.value?.closest(".inner.right");
    if (el) {
      scrollContainer.value = el;
      el.addEventListener("scroll", onScroll, { passive: true });
      updateViewport();
    }
  });

  onUnmounted(() => {
    if (scrollContainer.value) {
      scrollContainer.value.removeEventListener("scroll", onScroll);
    }
  });

  // Recompute viewport on container resize
  if (columnSizes) {
    watch(
      () => columnSizes.inner.height,
      () => updateViewport()
    );
  }

  function markStyle(mark) {
    if (isHorizontal.value) {
      return {
        left: `${mark.top * 100}%`,
        backgroundColor: mark.color,
      };
    }
    return {
      top: `${mark.top * 100}%`,
      backgroundColor: mark.color,
    };
  }
</script>

<template>
  <div
    ref="stripRef"
    class="scrollbar-minimap"
    :class="[mode, orientation, { compact: isCompact }]"
  >
    <!-- Viewport indicator (workspace mode only) -->
    <div
      v-if="!isCompact"
      class="viewport-indicator"
      :style="{
        top: `${viewportTop * 100}%`,
        height: `${viewportHeight * 100}%`,
      }"
    />

    <!-- Marks -->
    <div
      v-for="mark in displayMarks"
      :key="mark.id"
      class="minimap-mark"
      :class="[mark.type, { 'level-1': mark.level === 1 }]"
      :style="markStyle(mark)"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    />

    <Tooltip :anchor="hoveredEl" :content="tooltipText" placement="left" />
  </div>
</template>

<style scoped>
  .scrollbar-minimap {
    position: relative;
    flex-shrink: 0;
  }

  /* Workspace mode: thin strip at right edge, outside flex flow */
  .scrollbar-minimap.workspace.vertical {
    width: 12px;
    position: sticky;
    top: 0;
    height: 100vh;
    margin-left: auto;
    flex: 0 0 0px;
    overflow: visible;
  }

  /* Compact/homepage mode: horizontal bar */
  .scrollbar-minimap.compact.horizontal {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    cursor: default;
  }

  .viewport-indicator {
    display: none;
  }

  /* Mark base styles */
  .minimap-mark {
    position: absolute;
    left: 1px;
    right: 1px;
    pointer-events: auto;
    cursor: pointer;
  }

  /* Vertical marks */
  .scrollbar-minimap.vertical .minimap-mark {
    height: 8px;
    border-radius: 2px;
  }

  .scrollbar-minimap.vertical .minimap-mark.section {
    height: 2px;
    opacity: 0.4;
  }

  .scrollbar-minimap.vertical .minimap-mark.section.level-1 {
    opacity: 0.6;
    height: 3px;
  }

  .scrollbar-minimap.vertical .minimap-mark.presence {
    width: 6px;
    height: 6px;
    left: 3px;
    border-radius: 50%;
  }

  /* Horizontal marks (compact mode) */
  .scrollbar-minimap.horizontal .minimap-mark {
    top: 0;
    height: 100%;
    width: 2px;
    border-radius: 1px;
  }

  .scrollbar-minimap.horizontal .minimap-mark.section {
    width: 1px;
    opacity: 0.5;
  }

  .scrollbar-minimap.horizontal .minimap-mark.section.level-1 {
    opacity: 0.8;
    width: 2px;
  }

  .scrollbar-minimap.workspace .minimap-mark:hover {
    opacity: 1;
    transform: scaleX(1.5);
  }
</style>
