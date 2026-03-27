<script setup>
  import { ref, computed, inject, watch, nextTick, onMounted, onUnmounted } from "vue";
  import { useMinimapMarks, FEEDBACK_COLORS } from "@/composables/useMinimapMarks.js";
  import Tooltip from "@/components/base/Tooltip.vue";

  const hoveredMark = ref(null);
  const hoveredEl = ref(null);

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

  const { marks, computeMarks } = useMinimapMarks(manuscriptRef, {
    annotations,
    awareness,
    reactions,
    file: computed(() => props.file),
  });

  const allMarks = computed(() => marks.value);
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

  // Proximity-based hover: find the nearest mark to the cursor
  const PROXIMITY_THRESHOLD = 12; // pixels

  function onGutterPointerMove(event) {
    if (isDragging.value || isCompact.value) return;
    const rect = stripRef.value.getBoundingClientRect();
    const stripHeight = rect.height;
    const stripWidth = rect.width;
    const cursorFraction = (event.clientY - rect.top) / stripHeight;
    const cursorX = (event.clientX - rect.left) / stripWidth; // 0=left, 1=right

    let nearest = null;
    let nearestDist = Infinity;

    for (const mark of allMarks.value) {
      const yDist = Math.abs(mark.top - cursorFraction) * stripHeight;
      if (yDist >= PROXIMITY_THRESHOLD) continue;

      // Horizontal affinity: prefer marks on the cursor's side of the strip
      let xPenalty = 0;
      if (mark.type === "annotation" && cursorX > 0.6) xPenalty = 4;
      else if (mark.type === "feedback" && cursorX < 0.4) xPenalty = 4;

      const dist = yDist + xPenalty;
      if (dist < nearestDist) {
        nearest = mark;
        nearestDist = dist;
      }
    }

    if (nearest !== hoveredMark.value) {
      hoveredMark.value = nearest;
      // Position the tooltip anchor at the mark's position
      if (nearest) {
        const markY = rect.top + nearest.top * stripHeight;
        const noop = () => {};
        hoveredEl.value = {
          getBoundingClientRect: () => ({
            top: markY - 4, bottom: markY + 4, left: rect.left, right: rect.right,
            width: rect.width, height: 8, x: rect.left, y: markY - 4,
          }),
          addEventListener: noop,
          removeEventListener: noop,
          matches: () => true,
        };
      } else {
        hoveredEl.value = null;
      }
    }
  }

  function onGutterPointerLeave() {
    hoveredMark.value = null;
    hoveredEl.value = null;
  }

  function onStripPointerDown(event) {
    if (isCompact.value || !scrollContainer.value) return;

    // If a mark is hovered, navigate to it
    if (hoveredMark.value) {
      const mark = hoveredMark.value;
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
      return;
    }

    // Otherwise, scroll to clicked position
    isDragging.value = true;
    stripRef.value.setPointerCapture(event.pointerId);
    scrollToFraction(event);
  }

  function onStripPointerMove(event) {
    onGutterPointerMove(event);
    if (isDragging.value) scrollToFraction(event);
  }

  function onStripPointerUp() {
    isDragging.value = false;
  }

  const emit = defineEmits(["mark-click"]);

  // Compact mode click handler (emits for parent)
  function onCompactMarkClick(event, mark) {
    event.stopPropagation();
    if (isCompact.value) {
      emit("mark-click", mark);
    }
  }

  // Check if a mark is the currently hovered one
  function isHovered(mark) {
    return hoveredMark.value?.id === mark.id;
  }

  // Check if a mark is very close to the hovered mark (within 8px vertically)
  const OVERLAP_THRESHOLD = 8;
  function isNearHovered(mark) {
    if (!hoveredMark.value || hoveredMark.value.id === mark.id) return false;
    const stripEl = stripRef.value;
    if (!stripEl) return false;
    const stripHeight = stripEl.getBoundingClientRect().height;
    const dist = Math.abs(mark.top - hoveredMark.value.top) * stripHeight;
    return dist < OVERLAP_THRESHOLD;
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
    :class="[mode, orientation, { compact: isCompact, dragging: isDragging, 'has-hovered': hoveredMark }]"
    @pointerdown="onStripPointerDown"
    @pointermove="onStripPointerMove"
    @pointerup="onStripPointerUp"
    @pointerleave="onGutterPointerLeave"
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
      :class="{ 'level-1': mark.level === 1, hovered: isHovered(mark), 'near-hovered': isNearHovered(mark) }"
      :style="posStyle(mark.top)"
    />

    <!-- Figure marks — short blue dashes -->
    <div
      v-for="mark in figureMarks"
      :key="mark.id"
      class="mm-figure"
      :class="{ hovered: isHovered(mark), 'near-hovered': isNearHovered(mark) }"
      :style="posStyle(mark.top)"
    />

    <!-- Annotation ticks — left-aligned short colored marks -->
    <div
      v-for="mark in annotationMarks"
      :key="mark.id"
      class="mm-annotation"
      :class="{ hovered: isHovered(mark), 'near-hovered': isNearHovered(mark) }"
      :style="{ ...posStyle(mark.top), '--ann-color': mark.color }"
    />

    <!-- Feedback ticks — right-aligned short colored marks -->
    <div
      v-for="mark in feedbackMarks"
      :key="mark.id"
      class="mm-feedback"
      :class="{ hovered: isHovered(mark), 'near-hovered': isNearHovered(mark) }"
      :style="{ ...posStyle(mark.top), '--fb-color': mark.color }"
    />

    <!-- Search dashes -->
    <div
      v-for="mark in searchMarks"
      :key="mark.id"
      class="mm-search"
      :class="{ hovered: isHovered(mark), 'near-hovered': isNearHovered(mark) }"
      :style="posStyle(mark.top)"
    />

    <!-- Presence dots — stay interactive (sparse, never crowd) -->
    <div
      v-for="mark in presenceMarks"
      :key="mark.id"
      class="mm-presence"
      :class="{ hovered: isHovered(mark), 'near-hovered': isNearHovered(mark) }"
      :style="{
        [isHorizontal ? 'left' : 'top']: `clamp(6px, ${mark.top * 100}%, calc(100% - 6px))`,
        backgroundColor: mark.avatarColor || mark.color,
      }"
    />

    <!-- Tooltip -->
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

  /* All marks shrink to 75% + 30% opacity by default, grow to 100% + full opacity on strip hover */
  .scrollbar-minimap .mm-section::after,
  .scrollbar-minimap .mm-figure::after,
  .scrollbar-minimap .mm-search::after {
    transform: scaleX(0.75);
    transform-origin: center;
    opacity: 0.3;
    transition: transform 0.25s ease, opacity 0.25s ease, width 0.15s ease, box-shadow 0.15s ease, margin-inline 0.15s ease, background-color 0.15s ease, height 0.15s ease;
  }

  .scrollbar-minimap .mm-annotation::after {
    transform: scaleX(0.75);
    transform-origin: left;
    opacity: 0.3;
    transition: transform 0.25s ease, opacity 0.25s ease, width 0.15s ease, box-shadow 0.15s ease;
  }

  .scrollbar-minimap .mm-feedback::after {
    transform: scaleX(0.75);
    transform-origin: right;
    opacity: 0.3;
    transition: transform 0.25s ease, opacity 0.25s ease, width 0.15s ease, box-shadow 0.15s ease;
  }

  .scrollbar-minimap .mm-presence {
    transform: translate(-50%, -50%) scale(0.75);
    opacity: 0.3;
    transition: transform 0.25s ease, opacity 0.25s ease, top 300ms ease-out;
  }

  .scrollbar-minimap:hover .mm-section::after,
  .scrollbar-minimap:hover .mm-figure::after,
  .scrollbar-minimap:hover .mm-search::after,
  .scrollbar-minimap:hover .mm-annotation::after,
  .scrollbar-minimap:hover .mm-feedback::after {
    transform: scaleX(1);
    opacity: 1;
  }

  .scrollbar-minimap:hover .mm-presence {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }

  /* When a mark is hovered, dim all others */
  .scrollbar-minimap.has-hovered .mm-section::after,
  .scrollbar-minimap.has-hovered .mm-figure::after,
  .scrollbar-minimap.has-hovered .mm-search::after,
  .scrollbar-minimap.has-hovered .mm-annotation::after,
  .scrollbar-minimap.has-hovered .mm-feedback::after {
    opacity: 0.35;
  }

  .scrollbar-minimap.has-hovered .mm-presence {
    opacity: 0.35;
  }

  /* The hovered mark itself stays full opacity */
  .scrollbar-minimap.has-hovered .mm-section.hovered::after,
  .scrollbar-minimap.has-hovered .mm-figure.hovered::after,
  .scrollbar-minimap.has-hovered .mm-search.hovered::after,
  .scrollbar-minimap.has-hovered .mm-annotation.hovered::after,
  .scrollbar-minimap.has-hovered .mm-feedback.hovered::after {
    opacity: 1;
  }

  .scrollbar-minimap.has-hovered .mm-presence.hovered {
    opacity: 1;
  }

  /* Marks very close to the hovered one dim further */
  .scrollbar-minimap.has-hovered .mm-section.near-hovered::after,
  .scrollbar-minimap.has-hovered .mm-figure.near-hovered::after,
  .scrollbar-minimap.has-hovered .mm-search.near-hovered::after,
  .scrollbar-minimap.has-hovered .mm-annotation.near-hovered::after,
  .scrollbar-minimap.has-hovered .mm-feedback.near-hovered::after {
    opacity: 0.1;
  }

  .scrollbar-minimap.has-hovered .mm-presence.near-hovered {
    opacity: 0.1;
  }

  /* Workspace mode: strip at right edge */
  .scrollbar-minimap.workspace.vertical {
    width: 24px;
    position: sticky;
    top: 0;
    height: calc(100vh - 32px);
    flex: 0 0 24px;
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
    left: 8px;
    right: 8px;
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
    pointer-events: none;

    &::after {
      content: "";
      display: block;
      width: 100%;
      margin-inline: 4px;
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

  .mm-section.hovered {
    z-index: 10;
  }

  .mm-section.hovered::after {
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
    pointer-events: none;

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

  .mm-figure.hovered {
    z-index: 10;
  }

  .mm-figure.hovered::after {
    width: 100%;
    margin-inline: 2px;
    background-color: var(--blue-500);
  }

  /* ── Annotation ticks — left-aligned ── */
  .mm-annotation {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    height: 12px;
    transform: translateY(-50%);
    pointer-events: none;

    &::after {
      content: "";
      display: block;
      width: 50%;
      margin-left: 3px;
      margin-right: auto;
      height: 3px;
      border-radius: 1px;
      background-color: var(--ann-color, var(--purple-500));
      transition:
        width 0.15s ease,
        box-shadow 0.15s ease;
    }
  }

  .mm-annotation.hovered {
    z-index: 10;
  }

  .mm-annotation.hovered::after {
    width: 70%;
  }

  /* ── Feedback ticks — right-aligned ── */
  .mm-feedback {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    height: 12px;
    transform: translateY(-50%);
    pointer-events: none;

    &::after {
      content: "";
      display: block;
      width: 50%;
      margin-left: auto;
      margin-right: 3px;
      height: 3px;
      border-radius: 1px;
      background-color: var(--fb-color);
      transition:
        width 0.15s ease,
        box-shadow 0.15s ease;
    }
  }

  .mm-feedback.hovered {
    z-index: 10;
  }

  .mm-feedback.hovered::after {
    width: 70%;
  }

  /* ── Search dashes ── */
  .mm-search {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    height: 12px;
    transform: translateY(-50%);
    pointer-events: none;

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

  .mm-search.hovered {
    z-index: 10;
  }

  .mm-search.hovered::after {
    margin-inline: 2px;
    height: 3px;
    background-color: var(--orange-400);
  }

  /* ── Presence dots — stay interactive ── */
  .mm-presence {
    position: absolute;
    left: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 1;
    transition: top 300ms ease-out, transform 0.15s ease;
    box-shadow: 0 0 0 2px var(--surface-page, #fff);
  }

  .mm-presence.hovered {
    z-index: 10;
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
    width: 24px;
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

  /* Compact mode: annotation/feedback ticks become centered vertical ticks */
  .scrollbar-minimap.horizontal .mm-annotation,
  .scrollbar-minimap.horizontal .mm-feedback {
    top: 0;
    height: 100%;
    width: 8px;
    right: auto;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    align-items: center;

    &::after {
      width: 2px;
      height: 100%;
      margin: 0;
      border-radius: 1px;
    }
  }

  .scrollbar-minimap.compact .mm-section,
  .scrollbar-minimap.compact .mm-annotation,
  .scrollbar-minimap.compact .mm-figure {
    cursor: pointer;
  }
</style>
