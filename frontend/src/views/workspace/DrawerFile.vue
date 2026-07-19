<script setup>
  import { ref, inject, computed } from "vue";
  import { useRouter } from "vue-router";
  import { captureException } from "@sentry/vue";
  import { File } from "@/models/File.js";
  import { downloadBlob } from "@/utils/download.js";
  import { toast } from "@/utils/toast.js";
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

  // Push the live Y.js content to the DB so a subsequent export reflects the
  // user's latest edits. Returns true if the export may proceed, false if the
  // flush failed (in which case the caller must abort rather than export stale
  // content). std-eisqeg: never swallow this failure silently.
  async function flushBeforeExport() {
    try {
      await api.post(`/files/${fileId.value}/collab/flush`);
      return true;
    } catch (error) {
      captureException(error);
      toast.error(
        "Couldn't sync your latest changes, so the export was cancelled to avoid " +
          "downloading an out-of-date file. Please try again."
      );
      return false;
    }
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
      // Flush Y.js content to the DB so the export reflects the user's latest
      // edits. If the flush fails the DB may still hold stale content, so we
      // must NOT silently export it (std-eisqeg): cancel the export and warn
      // the user rather than handing them an out-of-date file.
      if (!(await flushBeforeExport())) return;

      const title = fileTitle.value || "manuscript";
      const filename = title.replace(/[<>:"/\\|?*]/g, "_") + ".html";
      const response = await api.post(
        `/files/${fileId.value}/download`,
        {},
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "text/html" });
      downloadBlob(blob, filename);
    } catch (error) {
      captureException(error);
      toast.error("Download failed. Please try again.");
      console.error("Download failed:", error);
    } finally {
      isDownloading.value = false;
    }
  }

  async function onDownloadPdf() {
    if (isDownloadingPdf.value || !fileId.value) return;
    isDownloadingPdf.value = true;
    try {
      // See onDownload: a failed pre-export flush must not silently yield a
      // stale PDF (std-eisqeg).
      if (!(await flushBeforeExport())) return;

      const title = fileTitle.value || "manuscript";
      const filename = title.replace(/[<>:"/\\|?*]/g, "_") + ".pdf";
      const response = await api.post(
        `/files/${fileId.value}/download/pdf`,
        {},
        { responseType: "blob", timeout: 120000 }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      downloadBlob(blob, filename);
    } catch (error) {
      captureException(error);
      toast.error("PDF download failed. Please try again.");
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
          <Icon
            :name="isDownloadingPdf ? 'Loader2' : 'FileTypePdf'"
            :class="{ spinning: isDownloadingPdf }"
          />
          <span class="action-label">{{
            isDownloadingPdf ? "Generating PDF…" : "Download PDF"
          }}</span>
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
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .action-row--danger {
    color: var(--error-600, #dc2626);
  }

  .action-row--danger:hover:not(:disabled) {
    background: var(--error-50, #fef2f2);
  }
</style>
