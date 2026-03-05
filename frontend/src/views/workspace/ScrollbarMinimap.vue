<script setup>
  import { ref, computed, inject, watch, onMounted, onUnmounted } from "vue";
  import { useMinimapMarks, computeSectionMarks } from "@/composables/useMinimapMarks.js";
  import { IconMessageFilled } from "@tabler/icons-vue";
  import Tooltip from "@/components/base/Tooltip.vue";

  const hoveredMark = ref(null);
  const hoveredEl = ref(null);

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
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
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

  const allMarks = computed(() => (isCompact.value ? compactMarks.value : marks.value));
  const sectionMarks = computed(() => allMarks.value.filter((m) => m.type === "section"));
  const annotationMarks = computed(() => allMarks.value.filter((m) => m.type === "annotation"));
  const searchMarks = computed(() => allMarks.value.filter((m) => m.type === "search"));
  const presenceMarks = computed(() => allMarks.value.filter((m) => m.type === "presence"));

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
    if (mark.type === "annotation") {
      const id = parseInt(mark.id.replace("ann-", ""), 10);
      if (!isNaN(id)) activeAnnotationId.value = id;
    }
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

    <!-- Section lines — full-width for level-1, shorter for sub-sections -->
    <div
      v-for="mark in sectionMarks"
      :key="mark.id"
      class="mm-section"
      :class="{ 'level-1': mark.level === 1 }"
      :style="{ top: `${mark.top * 100}%` }"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    />

    <!-- Annotation bubbles -->
    <div
      v-for="mark in annotationMarks"
      :key="mark.id"
      class="mm-annotation"
      :style="{ top: `${mark.top * 100}%`, '--ann-color': mark.color }"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    >
      <IconMessageFilled :size="20" />
    </div>

    <!-- Search dashes -->
    <div
      v-for="mark in searchMarks"
      :key="mark.id"
      class="mm-search"
      :style="{ top: `${mark.top * 100}%` }"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    />

    <!-- Presence dots -->
    <div
      v-for="mark in presenceMarks"
      :key="mark.id"
      class="mm-presence"
      :style="{
        top: `clamp(6px, ${mark.top * 100}%, calc(100% - 6px))`,
        backgroundColor: mark.avatarColor || mark.color,
      }"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    />

    <!-- Tooltip: avatar + name for presence, plain text for others -->
    <Tooltip :anchor="hoveredEl" placement="left">
      <div v-if="hoveredMark?.type === 'presence'" class="presence-tooltip">
        <Avatar
          :user="{
            id: hoveredMark.userId,
            name: hoveredMark.label,
            avatar_color: hoveredMark.avatarColor || hoveredMark.color,
          }"
          size="md"
          :tooltip="false"
        />
        <span>{{ hoveredMark.label }}</span>
      </div>
      <template v-else>{{ hoveredMark?.label || "" }}</template>
    </Tooltip>
  </div>
</template>

<style scoped>
  .scrollbar-minimap {
    position: relative;
    pointer-events: none;
  }

  /* Workspace mode: strip at right edge */
  .scrollbar-minimap.workspace.vertical {
    width: 24px;
    position: sticky;
    top: 0;
    height: calc(100vh - 32px);
    flex: 0 0 24px;
    margin-left: 8px;
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

  /* ── Section lines ── */
  .mm-section {
    position: absolute;
    left: 6px;
    right: 6px;
    height: 3px;
    border-radius: 2px;
    background-color: var(--gray-800);
    opacity: 0.7;
    pointer-events: auto;
    cursor: pointer;
  }

  .mm-section.level-1 {
    left: 2px;
    right: 2px;
    height: 4px;
  }

  /* ── Annotation bubble icons ── */
  .mm-annotation {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--ann-color);
    pointer-events: auto;
    cursor: pointer;
    transition: transform 0.15s ease;
    line-height: 0;
  }

  .mm-annotation:hover {
    transform: translate(-50%, -50%) scale(1.15);
  }

  /* ── Search dashes ── */
  .mm-search {
    position: absolute;
    left: 25%;
    right: 25%;
    height: 2px;
    border-radius: 1px;
    background-color: var(--orange-700);
    pointer-events: auto;
    cursor: pointer;
  }

  /* ── Presence dots ── */
  .mm-presence {
    position: absolute;
    left: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: auto;
    cursor: pointer;
    z-index: 1;
    transition: top 300ms ease-out;
    box-shadow: 0 0 0 2px var(--surface-page, #fff);
  }

  .mm-presence:hover {
    transform: translate(-50%, -50%) scale(1.2);
  }

  /* ── Presence tooltip ── */
  .presence-tooltip {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  /* ── Horizontal marks (compact mode) ── */
  .scrollbar-minimap.horizontal .mm-section {
    top: 0;
    height: 100%;
    width: 1px;
    left: auto;
    right: auto;
    border-radius: 1px;
  }

  .scrollbar-minimap.horizontal .mm-section.level-1 {
    width: 2px;
    opacity: 0.8;
  }

  .scrollbar-minimap.workspace .mm-section:hover {
    opacity: 1;
  }
</style>
