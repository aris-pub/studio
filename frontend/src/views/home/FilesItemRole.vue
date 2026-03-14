<script setup>
  const props = defineProps({
    role: { type: String, default: null },
  });

  const labels = {
    EDITOR: "Editor",
    COMMENTER: "Commenter",
  };
</script>

<template>
  <Badge v-if="role && labels[role]">
    {{ labels[role] }}
  </Badge>
</template>
