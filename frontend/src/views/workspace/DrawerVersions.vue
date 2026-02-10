<script setup>
  import { inject, useTemplateRef, onMounted } from "vue";

  const props = defineProps({
    file: { type: Object, default: () => {} },
  });
  const api = inject("api");

  const versions = [(0, "title 0"), (1, "title 1"), (2, "title 2")]
</script>

<template>
  <Pane>
    <template #header>
      <IconFileText />
      <h3>Version History</h3>
    </template>
    <ul>
    <template v-for="(idx, title) in versions">
      <li>{{ title }}</li>
    </template>
    </ul>
  </Pane>
</template>

<style scoped>
  .settings {
    height: 100%;
  }
</style>
