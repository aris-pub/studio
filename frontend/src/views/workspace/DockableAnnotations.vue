<script setup>
  import { ref, inject, isRef, watch, nextTick, onMounted, onUnmounted } from "vue";
  import Note from "@/components/annotations/Note.vue";

  const annotations = inject("annotations", ref([]));
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
  const manuscriptRef = inject("manuscriptRef", ref(null));

  const sortedAnnotations = ref([]);

  function sortByDomPosition(list) {
    return [...list].sort((a, b) => {
      const markA =
        document.querySelector(`mark[data-annotation-id="${a.id}"]`) ||
        document.querySelector(`[data-highlight-annotation="${a.id}"]`);
      const markB =
        document.querySelector(`mark[data-annotation-id="${b.id}"]`) ||
        document.querySelector(`[data-highlight-annotation="${b.id}"]`);
      if (!markA || !markB) return 0;
      const pos = markA.compareDocumentPosition(markB);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }

  function trySort() {
    const list = isRef(annotations) ? annotations.value : annotations;
    if (!list?.length) { sortedAnnotations.value = []; return; }
    sortedAnnotations.value = sortByDomPosition([...list]);
  }

  // Watch annotations and re-sort after highlights are painted.
  // The highlight renderer also watches annotations and paints on nextTick,
  // so we need a second tick to ensure marks exist in the DOM.
  watch(
    () => {
      const list = isRef(annotations) ? annotations.value : annotations;
      return list?.length ?? 0;
    },
    async () => {
      await nextTick();
      await nextTick();
      trySort();
    },
    { immediate: true }
  );

  // Re-sort when mark elements appear in the manuscript DOM
  let observer = null;
  let sortTimer = null;
  watch(manuscriptRef, (mRef) => {
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
  }, { immediate: true });

  onUnmounted(() => {
    observer?.disconnect();
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
    ) return;
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
  <div class="annotations" @click="onContainerClick">
    <Note v-for="ann in sortedAnnotations" :key="ann.id" :annotation="ann" />
  </div>
</template>

<style scoped>
  .annotations {
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
