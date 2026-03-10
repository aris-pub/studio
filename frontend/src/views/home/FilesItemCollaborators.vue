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
      <Badge v-if="file.collaborators.length > maxVisible" size="xs" class="overflow-pill">
        +{{ file.collaborators.length - maxVisible }}
      </Badge>
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
  }
</style>
