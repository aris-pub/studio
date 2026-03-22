<script setup>
  import { watch, useTemplateRef } from "vue";
  import { File } from "@/models/File.js";

  defineOptions({
    name: "FileTitle",
  });

  const props = defineProps({
    file: { type: Object, required: true },
  });
  const currentTitle = defineModel({ type: String, default: "" });
  watch(
    () => props.file.title,
    () => (currentTitle.value = props.file.title),
    { immediate: true }
  );

  const saveTitle = () => {
    if (currentTitle.value === props.file.title) return;
    File.update(props.file, { title: currentTitle.value });
  };

  const editableRef = useTemplateRef("editable-ref");
  defineExpose({
    startEditing: () => editableRef.value?.startEditing(),
    cancelEditing: () => editableRef.value?.cancelEditing(),
  });
</script>

<template>
  <EditableText
    ref="editable-ref"
    v-model="currentTitle"
    class="file-title"
    :edit-on-click="false"
    @save="saveTitle"
  />
</template>

<style scoped>
  .file-title {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    line-height: 1;
  }
</style>
