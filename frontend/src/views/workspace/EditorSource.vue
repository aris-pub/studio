<script setup>
  import { inject, useTemplateRef } from "vue";
  import Toolbar from "./EditorToolbar.vue";
  import StatusBar from "./EditorStatusBar.vue";

  const props = defineProps({});
  const textareaRef = useTemplateRef("editor-ref");
  const fileSettings = inject("fileSettings");
  const editSession = inject("editSession");

  // Toolbar functions
  const onInsert = (text) => {
    if (!textareaRef.value) return;
    console.log("insert", text);
    const textarea = textareaRef.value;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    editSession.content.value = textarea.value;

    const cursor = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = cursor;
    textarea.focus();
  };

  // Expose
  defineExpose({
    value: () => textareaRef.value.value,
  });
</script>

<template>
  <div class="text-mono">
    <Toolbar @insert="onInsert" />

    <textarea
      ref="editor-ref"
      class="editor"
      :value="editSession.content.value"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      @input="(e) => (editSession.content.value = e.target.value)"
    />
    <StatusBar :save-status="editSession.status.value" />
  </div>
</template>

<style scoped>
  .text-mono {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  button.primary.cta {
    padding-inline: 8px;
  }

  textarea.editor {
    height: calc(100% - 48px - 32px);
    font-family: "Source Code Pro", monospace;
    box-shadow: inset var(--shadow-strong);
    flex: 1;
    width: 100%;
    font-size: 14px;
    padding: 8px;
    border: none;
    resize: none;
    cursor: text;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    background-color: transparent;
    color: var(--text-primary);
  }

  textarea.editor:focus {
    outline: none;
  }
</style>
