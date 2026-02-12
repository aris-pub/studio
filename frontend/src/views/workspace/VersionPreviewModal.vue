<script setup>
  import { ref, inject, onMounted } from "vue";
  import { IconX } from "@tabler/icons-vue";
  import Button from "@/components/base/Button.vue";
  import { useVersionRestore } from "@/composables/useVersionRestore";

  const props = defineProps({
    version: { type: Object, required: true },
    fileId: { type: Number, required: true },
    isOwner: { type: Boolean, required: true },
  });

  const emit = defineEmits(["close", "restored"]);

  const api = inject("api");

  const versionContent = ref("");
  const isLoadingContent = ref(false);
  const contentError = ref(null);
  const isRestoring = ref(false);
  const showConfirmation = ref(false);

  // Only initialize restore functionality if user is owner and Y.js is available
  let restoreVersion = null;
  if (props.isOwner) {
    try {
      const versionRestore = useVersionRestore(props.fileId);
      restoreVersion = versionRestore.restoreVersion;
    } catch (err) {
      console.warn("Y.js not available for version restore:", err);
      // Restore functionality will be disabled
    }
  }

  // Fetch version content for preview
  async function fetchVersionContent() {
    isLoadingContent.value = true;
    contentError.value = null;

    try {
      const response = await api.get(`/files/${props.fileId}/versions/${props.version.id}/preview`);
      versionContent.value = response.data.rsm_content;
    } catch (err) {
      console.error("Failed to fetch version content:", err);
      contentError.value = "Failed to load version content";
    } finally {
      isLoadingContent.value = false;
    }
  }

  // Handle restore button click
  function handleRestoreClick() {
    showConfirmation.value = true;
  }

  // Confirm and execute restore
  async function confirmRestore() {
    if (!restoreVersion) {
      alert("Restore functionality is not available. Y.js editor must be active.");
      return;
    }

    isRestoring.value = true;

    try {
      const success = await restoreVersion(props.version.id);

      if (success) {
        // Show success message and emit restored event
        emit("restored");
        // Toast notification will be handled by parent
      }
    } catch (err) {
      console.error("Failed to restore version:", err);
      alert("Failed to restore version. Please try again.");
    } finally {
      isRestoring.value = false;
    }
  }

  // Cancel restore
  function cancelRestore() {
    showConfirmation.value = false;
  }

  // Close modal
  function close() {
    if (!isRestoring.value) {
      emit("close");
    }
  }

  // Handle backdrop click
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  // Handle ESC key
  function handleKeydown(event) {
    if (event.key === "Escape" && !isRestoring.value) {
      close();
    }
  }

  onMounted(() => {
    fetchVersionContent();
    window.addEventListener("keydown", handleKeydown);
  });

  // Cleanup
  import { onBeforeUnmount } from "vue";
  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
</script>

<template>
  <div class="modal-backdrop" data-testid="version-preview-modal" @click="handleBackdropClick">
    <div class="modal-container">
      <!-- Header -->
      <div class="modal-header">
        <div class="version-info">
          <h2 class="version-title">
            Version {{ version.version_number }}
            <span v-if="version.version_name" class="version-name">
              - {{ version.version_name }}
            </span>
          </h2>
          <div class="version-meta">
            <span class="version-date">
              {{
                new Date(version.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              }}
            </span>
          </div>
        </div>
        <button
          class="btn-close"
          data-testid="close-preview-modal"
          :disabled="isRestoring"
          title="Close (ESC)"
          @click="close"
        >
          <IconX />
        </button>
      </div>

      <!-- Content -->
      <div class="modal-content">
        <!-- Loading State -->
        <div v-if="isLoadingContent" class="loading-state">
          <div class="spinner"></div>
          <p>Loading version...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="contentError" class="error-state">
          <p>{{ contentError }}</p>
          <Button kind="primary" size="sm" text="Retry" @click="fetchVersionContent" />
        </div>

        <!-- Version Content -->
        <div v-else class="version-content">
          <pre class="rsm-source">{{ versionContent }}</pre>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <!-- Confirmation State -->
        <div v-if="showConfirmation" class="confirmation">
          <p class="confirmation-message">
            ⚠️ Restore this version? This will replace the current content.
          </p>
          <div class="confirmation-actions">
            <Button
              kind="secondary"
              size="md"
              text="Cancel"
              data-testid="cancel-restore-button"
              :disabled="isRestoring"
              @click="cancelRestore"
            />
            <Button
              kind="primary"
              size="md"
              :text="isRestoring ? 'Restoring...' : 'Restore'"
              data-testid="confirm-restore-button"
              :disabled="isRestoring"
              @click="confirmRestore"
            />
          </div>
        </div>

        <!-- Default State -->
        <div v-else class="actions">
          <Button kind="secondary" size="md" text="Close" :disabled="isRestoring" @click="close" />
          <Button
            v-if="isOwner"
            kind="primary"
            size="md"
            :text="`Restore v${version.version_number}`"
            data-testid="restore-version-button"
            :disabled="isRestoring"
            title="Restore this version (Owner only)"
            @click="handleRestoreClick"
          />
          <div v-else class="owner-only-note">Only the file owner can restore versions</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .modal-container {
    background: var(--white);
    border-radius: 8px;
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-primary);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-primary);
    flex-shrink: 0;
  }

  .version-info {
    flex: 1;
    min-width: 0;
  }

  .version-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .version-name {
    font-weight: 400;
    color: var(--text-secondary);
  }

  .version-meta {
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-tertiary);
  }

  .btn-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s;
  }

  .btn-close:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .btn-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    min-height: 400px;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-primary);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state button {
    padding: 8px 16px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .version-content {
    position: relative;
  }

  .read-only-indicator {
    position: sticky;
    top: 0;
    background: var(--surface-hover);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    border: 1px solid var(--border-primary);
    z-index: 10;
  }

  .rsm-source {
    margin: 0;
    padding: 16px;
    background: var(--surface-hover);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-primary);
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--border-primary);
    flex-shrink: 0;
  }

  .confirmation {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .confirmation-message {
    margin: 0;
    font-size: 14px;
    color: var(--text-primary);
  }

  .confirmation-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .owner-only-note {
    font-size: 13px;
    color: var(--text-tertiary);
    font-style: italic;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--surface-hover);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-disabled);
  }

  .btn-danger {
    background: var(--color-error);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--color-error-hover);
  }

  .btn-primary:disabled,
  .btn-secondary:disabled,
  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
