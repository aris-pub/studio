<script setup>
  import { ref, computed, inject, isRef } from "vue";
  import Note from "@/components/annotations/Note.vue";

  const annotations = inject("annotations", ref([]));

  const sortedAnnotations = computed(() => {
    const list = isRef(annotations) ? annotations.value : annotations;
    if (!list?.length) return [];
    return [...list].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
  });
</script>

<template>
  <div class="annotations">
    <Note v-for="ann in sortedAnnotations" :key="ann.id" :annotation="ann" />
  </div>
</template>

<style scoped>
  .annotations {
    padding-block: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
