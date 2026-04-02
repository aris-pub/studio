<script setup>
  import { inject, ref } from "vue";
  import FeedbackIcon from "./FeedbackIcon.vue";

  const hrInfoSlots = inject("hrInfoSlots", ref([]));
</script>

<template>
  <Teleport v-for="(el, i) in hrInfoSlots" :key="i" :to="el" defer>
    <FeedbackIcon />
  </Teleport>
</template>
