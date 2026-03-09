<script setup>
  import Avatar from "@/components/base/Avatar.vue";

  const props = defineProps({
    file: { type: Object, required: true },
  });

  const maxVisible = 3;
</script>

<template>
  <div class="collaborators">
    <template v-if="file.collaborators?.length">
      <Avatar
        v-for="(collab, i) in file.collaborators.slice(0, maxVisible)"
        :key="collab.id"
        :user="collab"
        :style="i > 0 ? { marginLeft: '-8px' } : {}"
      />
      <span v-if="file.collaborators.length > maxVisible" class="overflow-pill">
        +{{ file.collaborators.length - maxVisible }}
      </span>
    </template>
  </div>
</template>

<style scoped>
  .collaborators {
    display: flex;
    align-items: center;
  }

  .overflow-pill {
    margin-left: 4px;
    font-size: 11px;
    color: var(--gray-600);
    background: var(--gray-100);
    border-radius: 8px;
    padding: 1px 5px;
    white-space: nowrap;
    line-height: 1;
  }
</style>
