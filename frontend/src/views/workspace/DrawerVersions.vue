<script setup>
  import { ref, inject, onMounted, computed } from "vue";
  import { IconFileText, IconPlus, IconEye } from "@tabler/icons-vue";
  import VersionPreviewModal from "./VersionPreviewModal.vue";

  const props = defineProps({
    file: { type: Object, required: true },
  });

  const api = inject("api");
  const user = inject("user");

  const versions = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const selectedVersion = ref(null);
  const showPreviewModal = ref(false);
  const showSaveModal = ref(false);

  // Check if current user is file owner
  const isOwner = computed(() => {
    return user.value && props.file?.owner_id === user.value.id;
  });

  // Fetch versions for current file
  async function fetchVersions() {
    if (!props.file?.id) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await api.get(`/files/${props.file.id}/versions`);
      versions.value = response.data;
    } catch (err) {
      console.error("Failed to fetch versions:", err);
      error.value = "Failed to load versions";
    } finally {
      isLoading.value = false;
    }
  }

  // Open preview modal for selected version
  function previewVersion(version) {
    selectedVersion.value = version;
    showPreviewModal.value = true;
  }

  // Close preview modal
  function closePreviewModal() {
    showPreviewModal.value = false;
    selectedVersion.value = null;
  }

  // Refresh versions after restore
  async function handleVersionRestored() {
    closePreviewModal();
    await fetchVersions();
  }

  // Open save version modal
  function openSaveVersionModal() {
    showSaveModal.value = true;
  }

  // Format date for display
  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }

  // Load versions on mount and when file changes
  onMounted(() => {
    fetchVersions();
  });
</script>

<template>
  <Pane>
    <template #header>
      <IconFileText />
      <h3>Versions</h3>
    </template>

    <!-- Save Version Button -->
    <div class="save-version-container">
      <button
        class="btn-save-version"
        data-testid="save-version-button"
        @click="openSaveVersionModal"
      >
        <IconPlus />
        Save Version
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading">Loading versions...</div>

    <!-- Error State -->
    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="versions.length === 0" class="empty-state">
      <p>No versions yet</p>
      <p class="empty-hint">Save your first version to create a checkpoint</p>
    </div>

    <!-- Version List -->
    <ul v-else class="version-list">
      <li
        v-for="version in versions"
        :key="version.id"
        class="version-item"
        :data-testid="'version-item'"
        :data-version-id="version.id"
      >
        <div class="version-info">
          <div class="version-header">
            <span class="version-number">v{{ version.version_number }}</span>
            <span v-if="version.version_name" class="version-name">
              {{ version.version_name }}
            </span>
          </div>
          <div class="version-meta">
            <span class="version-date">{{ formatDate(version.created_at) }}</span>
          </div>
        </div>

        <button
          class="btn-preview"
          :data-testid="'preview-version-' + version.id"
          title="Preview version"
          @click="previewVersion(version)"
        >
          <IconEye />
        </button>
      </li>
    </ul>

    <!-- Version Preview Modal -->
    <VersionPreviewModal
      v-if="showPreviewModal && selectedVersion"
      :version="selectedVersion"
      :file-id="file.id"
      :is-owner="isOwner"
      @close="closePreviewModal"
      @restored="handleVersionRestored"
    />

    <!-- Save Version Modal (TODO: Task #7) -->
    <!-- <SaveVersionModal
      v-if="showSaveModal"
      :file-id="file.id"
      @close="showSaveModal = false"
      @saved="fetchVersions"
    /> -->
  </Pane>
</template>

<style scoped>
  .save-version-container {
    padding: 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .btn-save-version {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-save-version:hover {
    background: var(--color-primary-hover);
  }

  .loading,
  .error {
    padding: 16px;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .error {
    color: var(--color-error);
  }

  .empty-state {
    padding: 32px 16px;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .empty-state p {
    margin: 0;
  }

  .empty-hint {
    font-size: 13px;
    margin-top: 8px;
    color: var(--color-text-tertiary);
  }

  .version-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .version-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    transition: background 0.2s;
  }

  .version-item:hover {
    background: var(--color-bg-secondary);
  }

  .version-info {
    flex: 1;
    min-width: 0;
  }

  .version-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }

  .version-number {
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 14px;
  }

  .version-name {
    color: var(--color-text-secondary);
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .version-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .btn-preview {
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
    color: var(--color-text-secondary);
    transition: all 0.2s;
  }

  .btn-preview:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }
</style>
