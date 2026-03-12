<script setup>
  import { ref, computed, inject, useTemplateRef } from "vue";
  import { useRouter } from "vue-router";

  const emit = defineEmits(["close"]);
  const close = () => emit("close");

  const fileUpload = useTemplateRef("fileUpload");
  const triggerFileUpload = () => fileUpload.value?.click();

  const api = inject("api");
  const user = inject("user");
  const fileStore = inject("fileStore");
  const router = useRouter();

  const selectedFile = ref(null);
  const uploading = ref(false);
  const error = ref("");

  const ACCEPTED_EXTENSIONS = ".rsm,.md,.tex,.latex,.docx";

  const FORMAT_LABELS = {
    ".md": "Markdown",
    ".tex": "LaTeX",
    ".latex": "LaTeX",
    ".docx": "Word (DOCX)",
    ".rsm": "RSM",
  };

  const detectedFormat = computed(() => {
    if (!selectedFile.value) return null;
    const name = selectedFile.value.name;
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    return FORMAT_LABELS[ext] || null;
  });

  const isImportFormat = computed(() => {
    return detectedFormat.value && detectedFormat.value !== "RSM";
  });

  const formatHint = computed(() => {
    if (!detectedFormat.value) return "";
    if (isImportFormat.value) return `${detectedFormat.value} → RSM`;
    return "RSM (native)";
  });

  const onFileChange = () => {
    error.value = "";
    if (fileUpload.value?.files?.length > 0) {
      selectedFile.value = fileUpload.value.files[0];
    } else {
      selectedFile.value = null;
    }
  };

  const upload = async () => {
    if (!selectedFile.value) return;

    uploading.value = true;
    error.value = "";

    try {
      let fileId;

      if (isImportFormat.value) {
        const formData = new FormData();
        formData.append("file", selectedFile.value);
        const response = await api.post("/files/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        });
        fileId = response.data.id;
      } else {
        const text = await selectedFile.value.text();
        const response = await api.post("/files/", {
          source: text,
          owner_id: user.value.id,
          title: "",
          abstract: "",
        });
        fileId = response.data.id;
      }

      await fileStore.value.loadFiles();
      close();
      router.push(`/file/${fileId}`);
    } catch (err) {
      error.value = err.response?.data?.detail || "Upload failed. Please try again.";
    } finally {
      uploading.value = false;
    }
  };
</script>

<template>
  <Modal @close="close">
    <template #header>
      <span class="text-h5">Upload File</span>
    </template>
    <span>Select a file from your computer</span>
    <span class="text-caption supported-formats"> Supported: .rsm, .md, .tex, .latex, .docx </span>
    <input
      ref="fileUpload"
      data-testid="file-upload-input"
      type="file"
      :accept="ACCEPTED_EXTENSIONS"
      hidden
      @change="onFileChange"
    />
    <Button
      id="file-upload-cta"
      data-testid="file-upload-choose-button"
      kind="secondary"
      :text="selectedFile ? selectedFile.name : 'Choose file'"
      icon="Upload"
      class="btn-md"
      :disabled="uploading"
      @click="triggerFileUpload"
    />
    <span v-if="formatHint" class="format-hint text-caption" data-testid="format-hint">
      {{ formatHint }}
    </span>
    <span v-if="error" class="error-message text-caption" data-testid="upload-error">
      {{ error }}
    </span>
    <div class="cta">
      <Button
        kind="tertiary"
        text="cancel"
        data-testid="file-upload-cancel"
        class="btn-md"
        :disabled="uploading"
        @click="close"
      />
      <Button
        kind="primary"
        :text="uploading ? 'Importing…' : 'Upload'"
        :disabled="!selectedFile || uploading"
        data-testid="file-upload-submit"
        class="btn-md"
        @click="upload"
      />
    </div>
  </Modal>
</template>

<style scoped>
  #file-upload-cta {
    margin: 0 auto;
    width: 50%;
    display: flex;
    justify-content: center;
    margin-block: 8px;
  }

  .supported-formats {
    color: var(--text-subtle);
    display: block;
    margin-top: 4px;
  }

  .format-hint {
    display: block;
    text-align: center;
    color: var(--text-subtle);
  }

  .error-message {
    display: block;
    text-align: center;
    color: var(--text-error);
  }

  .cta {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
