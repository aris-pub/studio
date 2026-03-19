<script setup>
  import { ref, shallowRef, inject, provide, useTemplateRef } from "vue";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import EditorTopbar from "./EditorTopbar.vue";
  import EditorToolbar from "./EditorToolbar.vue";
  import EditorStatusBar from "./EditorStatusBar.vue";
  import EditorCodeMirror from "./EditorCodeMirror.vue";
  import EditorFiles from "./EditorFiles.vue";
  import { IconLock } from "@tabler/icons-vue";

  const props = defineProps({});
  const file = defineModel({ type: Object, required: true });

  // Editor topbar state
  const tabIndex = ref(0);

  const api = inject("api");
  const mobileMode = inject("mobileMode");

  // Compile: render the current Y.js source
  const compile = async () => {
    let source = "";
    if (window.__ytext) {
      source = window.__ytext.toString();
    }

    const response = await api.post("render/private", {
      source,
      file_id: file.value.id,
    });
    file.value.html = response.data;
  };

  // CodeMirror view — provided by Canvas.vue, written by EditorCodeMirror
  const cmView = inject("cmView", shallowRef(null));
  const cursorPos = ref(0);
  provide("cmView", cmView);
  provide("cursorPos", cursorPos);

  // Collab/LSP state from EditorCodeMirror (shared with status bar)
  const collabIsConnected = ref(false);
  const collabIsSynced = ref(false);
  const lspClient = shallowRef(null);
  const documentUri = ref("");
  provide("collabIsConnected", collabIsConnected);
  provide("collabIsSynced", collabIsSynced);
  provide("lspClient", lspClient);
  provide("documentUri", documentUri);

  // Provide compile to child components (EditorCodeMirror uses it)
  provide("compile", compile);

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
      await compile();
    } catch (error) {
      console.error("Error uploading asset:", error);
    }
  };

  // Compilation trigger
  const onCompile = () => compile();

  // Keys — Cmd+S triggers compile (Y.js handles persistence)
  const onSaveShortcut = () => compile();
  useKeyboardShortcuts({
    s: onSaveShortcut,
  });
</script>

<template>
  <div class="editor">
    <EditorTopbar v-model="tabIndex" @compile="onCompile" @upload="onUpload" />
    <div class="content">
      <EditorToolbar v-if="tabIndex === 0 && !mobileMode" />
      <div v-if="mobileMode && tabIndex === 0" class="mobile-readonly-banner">
        <IconLock :size="14" aria-hidden="true" />
        Read-only on mobile
      </div>
      <EditorCodeMirror v-if="tabIndex === 0" v-model="file" />
      <EditorFiles v-if="tabIndex === 1" v-model="file" />
      <EditorStatusBar v-if="tabIndex === 0 && !mobileMode" />
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
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 0 8px 8px 8px;
  }

  .mobile-readonly-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: var(--toolbar-height);
    padding: 0 12px;
    font-size: 13px;
    font-weight: var(--weight-medium, 500);
    color: var(--information-800, #075487);
    background-color: var(--surface-hint, #bae3fd);
    border-bottom: var(--border-extrathin) solid var(--information-300, #7dcdfc);
  }
</style>
