<script setup>
  import { ref, computed, inject, isRef } from "vue";
  import Note from "@/components/annotations/Note.vue";

  const annotations = inject("annotations", ref([]));

  const sortedAnnotations = computed(() => {
    const list = isRef(annotations) ? annotations.value : annotations;
    if (!list?.length) return [];
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
  });
</script>

<template>
  <div class="annotations">
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
