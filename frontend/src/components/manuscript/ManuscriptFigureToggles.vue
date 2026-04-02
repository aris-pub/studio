<script setup>
  import { inject, ref } from "vue";
  import FigureToggle from "./FigureToggle.vue";

  const figureToggleSlots = inject("figureToggleSlots", ref([]));
</script>

<template>
  <Teleport v-for="(el, i) in figureToggleSlots" :key="i" :to="el" defer>
    <FigureToggle />
  </Teleport>
</template>
