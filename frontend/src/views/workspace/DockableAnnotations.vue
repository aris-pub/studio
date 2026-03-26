<script setup>
  import { ref, shallowRef, inject, isRef, watch, nextTick, onMounted, onUnmounted } from "vue";
  import Note from "@/components/annotations/Note.vue";

  const props = defineProps({
    aligned: { type: Boolean, default: false },
  });

  const annotations = inject("annotations", ref([]));
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
  const manuscriptRef = inject("manuscriptRef", ref(null));
  const searchMatchedAnnotationIds = inject("searchMatchedAnnotationIds", shallowRef(new Set()));
  const searchCurrentMarginaliaId = inject("searchCurrentMarginaliaId", ref(null));
  const searchQueryForMarginalia = inject("searchQueryForMarginalia", ref(""));

  const sortedAnnotations = ref([]);

  function sortByDomPosition(list) {
    // Separate anchored (have marks in DOM) from orphaned (no marks)
    const anchored = [];
    const orphaned = [];
    for (const ann of list) {
      const mark =
        document.querySelector(`mark[data-annotation-id="${ann.id}"]`) ||
        document.querySelector(`[data-highlight-annotation="${ann.id}"]`);
      if (mark) anchored.push({ ann, mark });
      else orphaned.push(ann);
    }

    anchored.sort((a, b) => {
      const pos = a.mark.compareDocumentPosition(b.mark);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    // Orphaned annotations go at the end, sorted by creation date
    orphaned.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    return [...anchored.map((a) => a.ann), ...orphaned];
  }

  function trySort() {
    const list = isRef(annotations) ? annotations.value : annotations;
    if (!list?.length) {
      sortedAnnotations.value = [];
      return;
    }
    sortedAnnotations.value = sortByDomPosition([...list]);
  }

  // --- Aligned positioning: compute card top offsets to match highlight marks ---

  const cardPositions = ref(new Map());
  const lastKnownMarkTop = new Map();
  const containerMinHeight = ref("auto");
  const MIN_GAP = 8;

  function getOffsetTop(el, ancestor) {
    if (!el || !ancestor) return 0;
    const elRect = el.getBoundingClientRect();
    const ancestorRect = ancestor.getBoundingClientRect();
    return elRect.top - ancestorRect.top + ancestor.scrollTop;
  }

  function computePositions() {
    if (!props.aligned) {
      cardPositions.value = new Map();
      containerMinHeight.value = "auto";
      return;
    }

    const dock = document.querySelector(".dock.main.middle");
    if (!dock) return;

    const positions = new Map();
    let lastBottom = 0;

    for (const ann of sortedAnnotations.value) {
      const mark =
        document.querySelector(`mark[data-annotation-id="${ann.id}"]`) ||
        document.querySelector(`[data-highlight-annotation="${ann.id}"]`);

      let desiredTop;
      if (mark) {
        const markTop = getOffsetTop(mark, dock);
        lastKnownMarkTop.set(ann.id, markTop);
        desiredTop = Math.max(markTop, lastBottom + MIN_GAP);
      } else if (lastKnownMarkTop.has(ann.id)) {
        desiredTop = Math.max(lastKnownMarkTop.get(ann.id), lastBottom + MIN_GAP);
      } else {
        desiredTop = lastBottom + MIN_GAP;
      }
      positions.set(ann.id, desiredTop);

      const cardEl = document.querySelector(`[data-card-id="${ann.id}"]`);
      lastBottom = desiredTop + (cardEl?.offsetHeight ?? 80);
    }

    cardPositions.value = positions;
    containerMinHeight.value = lastBottom > 0 ? `${lastBottom}px` : "auto";
  }

  function refinePositions() {
    if (!props.aligned) return;
    computePositions();
  }

  // Watch annotations and re-sort after highlights are painted.
  // The highlight renderer also watches annotations and paints on nextTick,
  // so we need a second tick to ensure marks exist in the DOM.
  // Deep watch catches both additions/removals and in-place item replacements
  // (e.g. updateAnnotation swapping an object at the same index).
  watch(
    () => (isRef(annotations) ? annotations.value : annotations),
    async () => {
      await nextTick();
      await nextTick();
      trySort();
    },
    { immediate: true, deep: true }
  );

  // Recompute positions after sort settles
  watch(sortedAnnotations, async () => {
    await nextTick();
    await nextTick();
    computePositions();
    await nextTick();
    refinePositions();
  });

  // Recompute when active card changes (expand/collapse changes heights)
  watch(activeAnnotationId, async () => {
    if (!props.aligned) return;
    await nextTick();
    await nextTick();
    refinePositions();
  });

  // Re-sort when mark elements appear in the manuscript DOM
  let observer = null;
  let sortTimer = null;
  watch(
    manuscriptRef,
    (mRef) => {
      observer?.disconnect();
      const el = mRef?.$el || mRef;
      if (!el) return;
      observer = new MutationObserver((mutations) => {
        const hasMarks = mutations.some((m) =>
          [...m.addedNodes].some(
            (n) => n.nodeType === 1 && (n.tagName === "MARK" || n.querySelector?.("mark"))
          )
        );
        if (!hasMarks) return;
        clearTimeout(sortTimer);
        sortTimer = setTimeout(trySort, 50);
      });
      observer.observe(el, { childList: true, subtree: true });
    },
    { immediate: true }
  );

  // ResizeObserver on dock container to catch layout reflow
  let resizeObserver = null;
  onMounted(() => {
    if (!props.aligned) return;
    const dock = document.querySelector(".dock.main.middle");
    if (!dock) return;
    resizeObserver = new ResizeObserver(() => {
      refinePositions();
    });
    resizeObserver.observe(dock);
  });

  onUnmounted(() => {
    observer?.disconnect();
    resizeObserver?.disconnect();
    clearTimeout(sortTimer);
  });

  // Deselect when clicking outside any card
  function onContainerClick(e) {
    if (!e.target.closest(".note")) {
      activeAnnotationId.value = null;
    }
  }

  // Deselect when clicking the manuscript/scroll area (not on a highlight or card)
  function onOutsideClick(e) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (
      e.target.closest(".note") ||
      e.target.closest(".annotations") ||
      e.target.closest("mark[data-annotation-id]") ||
      e.target.closest("[data-highlight-annotation]")
    )
      return;
    activeAnnotationId.value = null;
  }

  onMounted(() => {
    const scrollContainer = document.querySelector(".inner.right");
    scrollContainer?.addEventListener("click", onOutsideClick);
  });

  onUnmounted(() => {
    const scrollContainer = document.querySelector(".inner.right");
    scrollContainer?.removeEventListener("click", onOutsideClick);
  });
</script>

<template>
  <div
    class="annotations"
    :class="{ aligned }"
    :style="aligned ? { minHeight: containerMinHeight } : {}"
    role="region"
    aria-label="Annotations list"
    @click="onContainerClick"
  >
    <Note
      v-for="ann in sortedAnnotations"
      :key="ann.id"
      :annotation="ann"
      :search-match="searchMatchedAnnotationIds.has(ann.id)"
      :search-match-current="searchCurrentMarginaliaId === ann.id"
      :search-query="searchQueryForMarginalia"
      :data-card-id="ann.id"
      @resize="refinePositions"
      :style="
        aligned && cardPositions.get(ann.id) != null
          ? {
              position: 'absolute',
              top: cardPositions.get(ann.id) + 'px',
              width: 'calc(100% - 24px)',
            }
          : {}
      "
    />
  </div>
</template>

<style scoped>
  .annotations {
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .annotations.aligned {
    position: relative;
    padding: 0 12px;
    gap: 0;
  }
</style>
