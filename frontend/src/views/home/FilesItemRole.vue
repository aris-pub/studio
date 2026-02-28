<script setup>
  const props = defineProps({
    role: { type: String, default: null },
  });

  const labels = {
    EDITOR: "Editor",
    COMMENTER: "Viewer",
  };
</script>

<template>
  <span v-if="role && labels[role]" class="role-badge">
    {{ labels[role] }}
  </span>
</template>

<style scoped>
  .role-badge {
    font-size: 11px;
    color: var(--gray-600);
    background: var(--gray-100);
    border-radius: 8px;
    padding: 2px 6px;
    white-space: nowrap;
  }
</style>
