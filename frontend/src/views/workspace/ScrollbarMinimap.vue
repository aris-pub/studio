<script setup>
  import { ref, computed, inject, isRef, watch, nextTick, onMounted, onUnmounted } from "vue";
  import {
    useMinimapMarks,
    computeSectionMarks,
    FEEDBACK_COLORS,
  } from "@/composables/useMinimapMarks.js";
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
  const reactions = inject("reactions", ref([]));
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
  const awareness = inject("awareness", ref(null));
  const columnSizes = inject("columnSizes", null);

  const stripRef = ref(null);
  const scrollContainer = ref(null);
  const viewportTop = ref(0);
  const viewportHeight = ref(0);

  const isCompact = computed(() => props.mode === "compact");
  const isHorizontal = computed(() => props.orientation === "horizontal");

  const posStyle = (fraction) =>
    isHorizontal.value ? { left: `${fraction * 100}%` } : { top: `${fraction * 100}%` };

  // Marks: full computation for workspace, sections-only for compact
  const { marks, computeMarks } = isCompact.value
    ? { marks: ref([]), computeMarks: () => {} }
    : useMinimapMarks(manuscriptRef, { annotations, awareness, file: computed(() => props.file) });

  const compactMarks = ref([]);
  if (isCompact.value) {
    function computeCompactMarks() {
      const manuscriptEl = manuscriptRef?.value;
      const sectionMarks = computeSectionMarks(manuscriptEl);
      if (!manuscriptEl) {
        compactMarks.value = sectionMarks;
        return;
      }

      // Also compute annotation marks by finding their anchor node in the DOM
      const el = manuscriptEl.$el || manuscriptEl;
      const container = el.closest(".inner.right") || el;
      const annList = annotations && isRef(annotations) ? annotations.value : annotations;
      const annMarks = [];
      if (Array.isArray(annList) && container) {
        const scrollHeight = container.scrollHeight || 1;
        const containerRect = container.getBoundingClientRect();
        for (const ann of annList) {
          if (!ann.anchor_data?.node_id) continue;
          const block = el.querySelector(`[data-nodeid="${ann.anchor_data.node_id}"]`);
          if (!block) continue;
          const blockRect = block.getBoundingClientRect();
          const top = (blockRect.top - containerRect.top + container.scrollTop) / scrollHeight;
          const colorName = ann.color || "purple";
          annMarks.push({
            top: Math.max(0, Math.min(1, top)),
            color: `var(--${colorName}-600)`,
            type: "annotation",
            id: `ann-${ann.id}`,
          });
        }
      }

      // Feedback (reaction) marks by finding their node in the hidden DOM
      const rxnList = reactions && isRef(reactions) ? reactions.value : reactions;
      const fbMarks = [];
      if (Array.isArray(rxnList) && container) {
        const scrollHeight = container.scrollHeight || 1;
        const containerRect = container.getBoundingClientRect();
        for (const rxn of rxnList) {
          if (!rxn.node_id) continue;
          const block = el.querySelector(`[data-nodeid="${rxn.node_id}"]`);
          if (!block) continue;
          const blockRect = block.getBoundingClientRect();
          const top = (blockRect.top - containerRect.top + container.scrollTop) / scrollHeight;
          fbMarks.push({
            top: Math.max(0, Math.min(1, top)),
            color: FEEDBACK_COLORS[rxn.reaction_type] || "var(--gray-500)",
            type: "feedback",
            id: `feedback-${rxn.node_id}`,
            label: rxn.reaction_type?.charAt(0).toUpperCase() + rxn.reaction_type?.slice(1),
          });
        }
      }

      compactMarks.value = [...sectionMarks, ...annMarks, ...fbMarks];
    }

    watch(() => manuscriptRef?.value, async () => {
      await nextTick();
      computeCompactMarks();
    }, { immediate: true });
    if (annotations) {
      watch(annotations, computeCompactMarks, { deep: true });
    }
    if (reactions) {
      watch(reactions, computeCompactMarks, { deep: true });
    }
  }

  const allMarks = computed(() => (isCompact.value ? compactMarks.value : marks.value));
  const sectionMarks = computed(() => allMarks.value.filter((m) => m.type === "section"));
  const annotationMarks = computed(() => allMarks.value.filter((m) => m.type === "annotation"));
  const searchMarks = computed(() => allMarks.value.filter((m) => m.type === "search"));
  const presenceMarks = computed(() => allMarks.value.filter((m) => m.type === "presence"));
  const feedbackMarks = computed(() => allMarks.value.filter((m) => m.type === "feedback"));
  const figureMarks = computed(() => allMarks.value.filter((m) => m.type === "figure"));

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

  const isDragging = ref(false);

  function scrollToFraction(event) {
    const rect = stripRef.value.getBoundingClientRect();
    const fraction = isHorizontal.value
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    const clamped = Math.max(0, Math.min(1, fraction));
    const sh = scrollContainer.value.scrollHeight;
    const ch = scrollContainer.value.clientHeight;
    scrollContainer.value.scrollTop = clamped * sh - ch / 2;
  }

  function onStripPointerDown(event) {
    if (isCompact.value || !scrollContainer.value) return;
    if (
      event.target !== stripRef.value &&
      event.target.classList.contains("viewport-indicator") === false
    )
      return;
    isDragging.value = true;
    stripRef.value.setPointerCapture(event.pointerId);
    scrollToFraction(event);
  }

  function onStripPointerMove(event) {
    if (!isDragging.value) return;
    scrollToFraction(event);
  }

  function onStripPointerUp() {
    isDragging.value = false;
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
    :class="[mode, orientation, { compact: isCompact, dragging: isDragging }]"
    @pointerdown="onStripPointerDown"
    @pointermove="onStripPointerMove"
    @pointerup="onStripPointerUp"
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
      :style="posStyle(mark.top)"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    />

    <!-- Figure marks — short blue dashes -->
    <div
      v-for="mark in figureMarks"
      :key="mark.id"
      class="mm-figure"
      :style="posStyle(mark.top)"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    />

    <!-- Annotation bubbles -->
    <div
      v-for="mark in annotationMarks"
      :key="mark.id"
      class="mm-annotation"
      :style="posStyle(mark.top)"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    >
      <IconMessageFilled :size="isCompact ? 10 : 20" />
    </div>

    <!-- Feedback dots -->
    <div
      v-for="mark in feedbackMarks"
      :key="mark.id"
      class="mm-feedback"
      :style="{ ...posStyle(mark.top), '--fb-color': mark.color }"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    />

    <!-- Search dashes -->
    <div
      v-for="mark in searchMarks"
      :key="mark.id"
      class="mm-search"
      :style="posStyle(mark.top)"
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
        [isHorizontal ? 'left' : 'top']: `clamp(6px, ${mark.top * 100}%, calc(100% - 6px))`,
        backgroundColor: mark.avatarColor || mark.color,
      }"
      @mouseenter="onMarkEnter($event, mark)"
      @mouseleave="onMarkLeave"
      @click="onMarkClick($event, mark)"
    />

    <!-- Tooltip: avatar + name for presence, plain text for others -->
    <Tooltip :anchor="hoveredEl" :placement="isCompact ? 'top' : 'left'">
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
    pointer-events: auto;
    cursor: default;
  }

  .scrollbar-minimap.dragging {
    cursor: grabbing;
  }

  /* Workspace mode: strip at right edge */
  .scrollbar-minimap.workspace.vertical {
    width: 20px;
    position: sticky;
    top: 0;
    height: calc(100vh - 32px);
    flex: 0 0 20px;
    margin-left: 0;
    overflow: visible;
    z-index: 3;
  }

  /* Compact/homepage mode: horizontal bar */
  .scrollbar-minimap.compact.horizontal {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    cursor: default;
  }

  .viewport-indicator {
    position: absolute;
    left: 6px;
    right: 6px;
    background: var(--gray-600);
    opacity: 0.25;
    border-radius: 4px;
    pointer-events: none;
  }

  /* ── Section lines ── */
  .mm-section {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    height: 16px;
    transform: translateY(-50%);
    pointer-events: auto;
    cursor: pointer;

    &::after {
      content: "";
      display: block;
      width: 100%;
      margin-inline: 6px;
      height: 3px;
      border-radius: 2px;
      background-color: var(--gray-500);
      transition:
        margin-inline 0.15s ease,
        background-color 0.15s ease;
    }
  }

  .mm-section.level-1::after {
    margin-inline: 2px;
    height: 4px;
  }

  .mm-section:hover::after {
    margin-inline: 2px;
    background-color: var(--gray-700);
  }

  /* ── Figure marks ── */
  .mm-figure {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    height: 16px;
    transform: translateY(-50%);
    pointer-events: auto;
    cursor: pointer;

    &::after {
      content: "";
      display: block;
      width: 60%;
      margin-left: auto;
      margin-right: auto;
      height: 3px;
      border-radius: 2px;
      background-color: var(--blue-400);
      transition:
        width 0.15s ease,
        background-color 0.15s ease;
    }
  }

  .mm-figure:hover::after {
    width: 100%;
    margin-inline: 2px;
    background-color: var(--blue-500);
  }

  /* ── Annotation bubble icons ── */
  .mm-annotation {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--gray-500);
    z-index: 1;
    pointer-events: auto;
    cursor: pointer;
    transition: transform 0.15s ease;
    line-height: 0;

    & :deep(svg) {
      color: var(--gray-500);
    }
    & :deep(svg *) {
      stroke: none;
    }
  }

  .mm-annotation:hover {
    transform: translate(-50%, -50%) scale(1.2);
    color: var(--gray-700);

    & :deep(svg) {
      color: var(--gray-700);
    }
  }

  /* ── Feedback dots ── */
  .mm-feedback {
    position: absolute;
    left: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--fb-color);
    pointer-events: auto;
    cursor: pointer;
    z-index: 1;
    transition: transform 0.15s ease;
  }

  .mm-feedback:hover {
    transform: translate(-50%, -50%) scale(1.3);
  }

  /* ── Search dashes ── */
  .mm-search {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    height: 16px;
    transform: translateY(-50%);
    pointer-events: auto;
    cursor: pointer;

    &::after {
      content: "";
      display: block;
      width: 100%;
      margin-inline: 4px;
      height: 2px;
      border-radius: 1px;
      background-color: var(--orange-300);
      transition:
        margin-inline 0.15s ease,
        height 0.15s ease,
        background-color 0.15s ease;
    }
  }

  .mm-search:hover::after {
    margin-inline: 2px;
    height: 3px;
    background-color: var(--orange-400);
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
    width: 12px;
    right: auto;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    align-items: center;

    &::after {
      width: 1px;
      height: 60%;
      margin-inline: 0;
      border-radius: 0.5px;
      background-color: var(--gray-400);
      transition: background-color 0.2s ease;
    }
  }

  .scrollbar-minimap.horizontal .mm-section.level-1::after {
    width: 2px;
    height: 100%;
    margin-inline: 0;
    background-color: var(--gray-500);
  }

  .scrollbar-minimap.horizontal .mm-figure {
    top: 0;
    height: 100%;
    width: 8px;
    right: auto;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    align-items: center;

    &::after {
      width: 1px;
      height: 50%;
      margin: 0;
      background-color: var(--blue-400);
    }
  }

  .scrollbar-minimap.horizontal .mm-annotation,
  .scrollbar-minimap.horizontal .mm-feedback {
    top: 50%;
    transform: translate(-50%, -50%);
  }

  /* Compact mode: scale icons to fit the bar, neutral by default */
  .scrollbar-minimap.compact .mm-annotation {
    color: var(--gray-400);
    transition: color 0.2s ease;

    & :deep(svg) {
      color: inherit;
    }
  }

  /* No pointer/click interaction in compact mode */
  .scrollbar-minimap.compact .mm-section,
  .scrollbar-minimap.compact .mm-annotation {
    cursor: default;
    pointer-events: none;
  }
</style>
