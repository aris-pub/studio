<script setup>
  import ScrollbarMinimap from "@/views/workspace/ScrollbarMinimap.vue";

  const props = defineProps({
    file: { type: Object, required: true },
  });
</script>

<template>
  <div class="preview">
    <div class="left">
      <ScrollbarMinimap :file="file.value" mode="compact" orientation="horizontal" />
      <Abstract :file="file.value" />
    </div>
    <div class="right"></div>
  </div>
</template>

<style scoped>
  .preview {
    display: flex;
    height: 100%;
    width: 100%;
    align-items: flex-start;
    position: relative;
  }

  .left {
    display: flex;
    height: 100%;
    width: 100%;
    gap: 16px;
  }

  .right {
    display: flex;
    position: absolute;
    right: 0;
    align-items: center;
  }

  .mm-wrapper {
    position: relative;
    left: 0;
    width: 48px;
  }

  :deep(h3) {
    margin-block: 8px;
    font-weight: var(--weight-semi);
    border-bottom: var(--border-thin) solid var(--border-information);
  }
</style>
