<script setup>
  import { computed } from "vue";
  import { useRoute } from "vue-router";

  const route = useRoute();

  const contextSubItems = computed(() => [
    {
      icon: "FileText",
      text: "File Display",
      active: route?.path === "/settings/document",
      route: "/settings/document",
    },
    {
      icon: "Settings2",
      text: "Preferences",
      active: route?.path === "/settings/preferences",
      route: "/settings/preferences",
    },
  ]);
</script>

<template>
  <BaseLayout :context-sub-items="contextSubItems" :fab="false">
    <RouterView />
  </BaseLayout>
</template>
