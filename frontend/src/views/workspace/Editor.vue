<script setup>
  import { ref, inject, useTemplateRef, provide, onMounted, onBeforeUnmount } from "vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import { useEditSession } from "@/composables/useEditSession.js";
  import EditorTopbar from "./EditorTopbar.vue";
  import EditorSource from "./EditorSource.vue";
  import EditorCodeMirror from "./EditorCodeMirror.vue";
  import EditorFiles from "./EditorFiles.vue";

  const props = defineProps({});
  const file = defineModel({ type: Object, required: true });

  // Feature flag for real-time collaboration (CodeMirror + Y.js)
  const USE_CODEMIRROR = ref(true);

  // Editor topbar state
  const tabIndex = ref(0);

  // EditSession for content management and syncing
  const api = inject("api");
  const user = inject("user");

  const editSession = useEditSession(file.value.id, {
    implementation: "http",
    api,
    user,
    debounceTime: 2000,
    autoSaveInterval: 30000,
    onCompile: async () => {
      const response = await api.post("render/private", {
        source: editSession.content.value,
        file_id: file.value.id,
      });
      file.value.html = response.data;
    },
  });

  // Provide editSession to child components
  provide("editSession", editSession);

  // Start session on mount, stop on unmount
  onMounted(() => editSession.start());
  onBeforeUnmount(() => editSession.stop());

  // Expose status and manualSave for UI
  const saveStatus = editSession.status;
  const manualSave = editSession.manualSave;

  // File asset upload
  const isTextMimeType = (mimeType) => {
    return (
      mimeType.startsWith("text/") ||
      mimeType === "application/javascript" ||
      mimeType === "application/json" ||
      mimeType === "application/xml" ||
      mimeType === "text/html" ||
      mimeType === "text/css" ||
      mimeType === "text/plain"
    );
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove the data:mime/type;base64, prefix
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const fileToText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const onUpload = async (asset) => {
    console.log("upload", asset);

    try {
      const isText = isTextMimeType(asset.type);
      let content;
      let contentEncoding;

      if (isText) {
        content = await fileToText(asset);
        contentEncoding = "plain";
      } else {
        content = await fileToBase64(asset);
        contentEncoding = "base64";
      }

      const payload = {
        filename: asset.name,
        mime_type: asset.type,
        content: content,
        content_encoding: contentEncoding,
        file_id: file.value.id,
      };

      const response = await api.post("/assets", payload);
      const result = response.data;
      console.log("File uploaded successfully:", result);
    } catch (error) {
      console.error("Error uploading asset:", error);
    }
  };

  // Compilation trigger
  const onCompile = () => editSession.compile();

  // Keys
  const editorSourceRef = useTemplateRef("editor-source-ref");
  const onEscape = () =>
    editorSourceRef.value === document.activeElement && editorSourceRef.value.blur();
  const onSaveShortcut = () => manualSave();
  useKeyboardShortcuts({
    escape: onEscape,
    s: onSaveShortcut,
  });
</script>

<template>
  <div class="editor">
    <EditorTopbar v-model="tabIndex" @compile="onCompile" @upload="onUpload" />
    <div class="content">
      <!-- CodeMirror editor with Y.js real-time collaboration -->
      <EditorCodeMirror v-if="USE_CODEMIRROR && tabIndex === 0" v-model="file" />
      <!-- Original textarea editor (fallback) -->
      <EditorSource v-else-if="tabIndex === 0" ref="editor-source-ref" />
      <EditorFiles v-if="tabIndex === 1" v-model="file" />
    </div>
  </div>
</template>

<style scoped>
  .editor {
    --toolbar-height: 40px;
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--surface-page);
    z-index: 1;
  }

  .content {
    height: calc(100% - 16px);
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 0 8px 8px 8px;
  }
</style>
