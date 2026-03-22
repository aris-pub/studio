<script setup>
  import { ref, inject, computed } from "vue";
  import { useRouter } from "vue-router";
  import { File } from "@/models/File.js";
  import { downloadBlob } from "@/utils/download.js";
  import ConfirmationModal from "@/components/ConfirmationModal.vue";

  const api = inject("api");
  const user = inject("user");
  const file = inject("file");
  const fileStore = inject("fileStore");
  const cmView = inject("cmView", ref(null));
  const router = useRouter();

  function getCurrentSource() {
    if (cmView.value) return cmView.value.state.doc.toString();
    return file.value?.source || "";
  }

  const isDownloading = ref(false);
  const isDownloadingPdf = ref(false);
  const isDuplicating = ref(false);
  const showDeleteModal = ref(false);

  const fileId = computed(() => file.value?.id);
  const fileTitle = computed(() => file.value?.title || "");

  const deleteMessage = computed(() => {
    const name = file.value?.title || "this file";
    return `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  });

  async function onDownload() {
    if (isDownloading.value || !fileId.value) return;
    isDownloading.value = true;
    try {
      // Flush Y.js content to DB before export (non-competing path)
      await api.post(`/files/${fileId.value}/collab/flush`).catch(() => {});

      const title = fileTitle.value || "manuscript";
      const filename = title.replace(/[<>:"/\\|?*]/g, "_") + ".html";
      const response = await api.post(
        `/files/${fileId.value}/download`,
        {},
        { responseType: "blob" },
      );
      const blob = new Blob([response.data], { type: "text/html" });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      isDownloading.value = false;
    }
  }

  async function onDownloadPdf() {
    if (isDownloadingPdf.value || !fileId.value) return;
    isDownloadingPdf.value = true;
    try {
      // Flush Y.js content to DB before export (non-competing path)
      await api.post(`/files/${fileId.value}/collab/flush`).catch(() => {});

      const title = fileTitle.value || "manuscript";
      const filename = title.replace(/[<>:"/\\|?*]/g, "_") + ".pdf";
      const response = await api.post(
        `/files/${fileId.value}/download/pdf`,
        {},
        { responseType: "blob", timeout: 120000 },
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error("PDF download failed:", error);
    } finally {
      isDownloadingPdf.value = false;
    }
  }

  async function onDuplicate() {
    if (isDuplicating.value || !file.value) return;
    isDuplicating.value = true;
    try {
      const fileData = {
        ...File.toJSON(file.value),
        id: null,
        owner_id: user.value.id,
        title: (file.value.title || "Untitled") + " (Copy)",
      };
      await fileStore.value.createFile(fileData);
    } catch (error) {
      console.error("Duplicate failed:", error);
    } finally {
      isDuplicating.value = false;
    }
  }

  function onDelete() {
    if (!file.value) return;
    showDeleteModal.value = true;
  }

  async function handleDeleteConfirm() {
    if (!showDeleteModal.value) return;
    try {
      const success = await fileStore.value.deleteFile(file.value);
      if (success) {
        showDeleteModal.value = false;
        router.push("/");
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  }

  function handleDeleteClose() {
    showDeleteModal.value = false;
  }
</script>

<template>
  <Pane>
    <template #header>
      <Icon name="File" />
      <h3>File</h3>
    </template>

    <Section>
      <template #title>Export</template>
      <template #content>
        <button class="action-row" :disabled="isDownloading" @click="onDownload">
          <Icon name="FileTypeHtml" />
          <span class="action-label">Download HTML</span>
          <Icon name="ChevronRight" class="action-chevron" />
        </button>
        <button class="action-row" :disabled="isDownloadingPdf" @click="onDownloadPdf">
          <Icon :name="isDownloadingPdf ? 'Loader2' : 'FileTypePdf'" :class="{ spinning: isDownloadingPdf }" />
          <span class="action-label">{{ isDownloadingPdf ? "Generating PDF…" : "Download PDF" }}</span>
          <Icon v-if="!isDownloadingPdf" name="ChevronRight" class="action-chevron" />
        </button>
      </template>
    </Section>

    <Section>
      <template #content>
        <button class="action-row" :disabled="isDuplicating" @click="onDuplicate">
          <Icon name="Copy" />
          <span class="action-label">Duplicate</span>
          <Icon name="ChevronRight" class="action-chevron" />
        </button>
      </template>
    </Section>

    <Section theme="danger">
      <template #content>
        <button class="action-row action-row--danger" @click="onDelete">
          <Icon name="Trash" />
          <span class="action-label">Delete</span>
          <Icon name="ChevronRight" class="action-chevron" />
        </button>
      </template>
    </Section>
  </Pane>

  <ConfirmationModal
    :show="showDeleteModal"
    title="Delete File?"
    :message="deleteMessage"
    confirm-text="Delete"
    cancel-text="Cancel"
    :file-data="file"
    @confirm="handleDeleteConfirm"
    @cancel="handleDeleteClose"
    @close="handleDeleteClose"
  />
</template>

<style scoped>
  /* Action rows — modeled on DrawerVersions .version-item */
  .action-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    color: var(--gray-700);
    transition: background-color 0.15s ease;
  }

  .action-row:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .action-row:focus-visible {
    outline: var(--border-med) solid var(--border-action);
    outline-offset: var(--border-extrathin);
  }

  .action-row:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-row :deep(.tabler-icon) {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .action-label {
    flex: 1;
    text-align: left;
  }

  .action-chevron {
    color: var(--text-subtle);
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .action-row--danger {
    color: var(--error-600, #dc2626);
  }

  .action-row--danger:hover:not(:disabled) {
    background: var(--error-50, #fef2f2);
  }
</style>
