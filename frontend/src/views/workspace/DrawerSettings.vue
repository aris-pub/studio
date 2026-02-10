<script setup>
  import { inject, useTemplateRef, onMounted } from "vue";
  import { File } from "@/models/File.js";

  const props = defineProps({
    file: { type: Object, default: () => {} },
  });
  const fileSettings = inject("fileSettings");

  const fileSettingsRef = useTemplateRef("file-settings-ref");
  onMounted(() => {
    fileSettingsRef.value.startReceivingUserInput();
  });

  const api = inject("api");
  const onSave = async (settingsObj) => {
    try {
      await File.updateSettings(props.file, settingsObj, api);
    } catch (error) {
      console.error("Failed trying to updated file settings");
      console.error(error);
    }
  };
</script>

<template>
  <Pane>
    <template #header>
      <IconFileText />
      <h3>Document Display</h3>
    </template>
    <FileSettings ref="file-settings-ref" v-model="fileSettings" :header="false" @save="onSave" />
  </Pane>
</template>

<style scoped>
  .settings {
    height: 100%;
  }
</style>
