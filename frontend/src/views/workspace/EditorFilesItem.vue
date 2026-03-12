<script setup>
  const props = defineProps({});
  const asset = defineModel({ type: Object, required: true });
</script>

<template>
  <div class="asset">
    <span>{{ asset.filename }}</span>
    <span>{{ asset.uploaded_at }}</span>
  </div>
</template>

<style scoped>
  .asset {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    padding: 8px;
    border-bottom: var(--border-extrathin) solid var(--border-primary);
  }

  .asset:hover {
    background-color: var(--surface-hover);
  }
</style>
