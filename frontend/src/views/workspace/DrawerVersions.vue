<script setup>
  import { ref, inject, onMounted, computed, nextTick } from "vue";
  import { IconFileText, IconEye } from "@tabler/icons-vue";
  import Button from "@/components/base/Button.vue";
  import EditableText from "@/components/forms/EditableText.vue";
  import Toast from "@/components/ui/Toast.vue";
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
  const editingVersionId = ref(null);
  const editingName = ref("");
  const isSaving = ref(false);
  const activeToast = ref(null);

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

  // Toast helpers
  function showToast(config) {
    activeToast.value = { ...config, id: Date.now() };
  }

  function hideToast() {
    activeToast.value = null;
  }

  // Save new version with inline naming
  async function saveVersion() {
    if (isSaving.value) return; // Prevent double-click

    isSaving.value = true;
    error.value = null;

    try {
      const response = await api.post(`/files/${props.file.id}/versions/named`, {
        version_name: null,
      });

      const newVersion = response.data;
      versions.value.unshift(newVersion);

      // Enter edit mode for new version
      editingVersionId.value = newVersion.id;
      editingName.value = "";

      // Scroll to top and auto-focus input
      await nextTick();
      const versionList = document.querySelector(".version-list");
      versionList?.scrollTo({ top: 0, behavior: "smooth" });

      await nextTick();
      const input = document.querySelector(
        `[data-version-id="${newVersion.id}"] input`
      );
      input?.focus();
    } catch (err) {
      console.error("Failed to save version:", err);
      showToast({
        type: "error",
        message: "Failed to save version",
        description: "Please try again",
      });
    } finally {
      isSaving.value = false;
    }
  }

  // Start editing version name
  function startEditing(version) {
    editingVersionId.value = version.id;
    editingName.value = version.version_name || "";
  }

  // Handle version name save
  async function handleSaveName(version) {
    const originalName = version.version_name;

    // Optimistic update
    version.version_name = editingName.value || null;
    editingVersionId.value = null;

    try {
      await api.patch(`/files/${props.file.id}/versions/${version.id}`, {
        version_name: editingName.value || null,
      });
    } catch (err) {
      console.error("Failed to save version name:", err);
      // Rollback on failure
      version.version_name = originalName;
      // Auto-retry after 2 seconds
      setTimeout(() => {
        editingVersionId.value = version.id;
        editingName.value = editingName.value || "";
      }, 2000);
    }
  }

  // Cancel editing
  function handleCancelEdit() {
    editingVersionId.value = null;
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
      <Button
        kind="primary"
        size="md"
        icon="Plus"
        text="Save Version"
        :disabled="isSaving"
        data-testid="save-version-button"
        @click="saveVersion"
      />
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
    <TransitionGroup v-else name="version-list" tag="ul" class="version-list">
      <li
        v-for="version in versions"
        :key="version.id"
        class="version-item"
        :class="{ editing: editingVersionId === version.id }"
        :data-testid="'version-item'"
        :data-version-id="version.id"
      >
        <div class="version-info">
          <div class="version-header">
            <span class="version-number">v{{ version.version_number }}</span>

            <!-- Edit mode: inline input -->
            <EditableText
              v-if="editingVersionId === version.id"
              v-model="editingName"
              placeholder="Name this version..."
              :edit-on-click="false"
              :clear-on-start="false"
              text-class="version-name"
              @save="handleSaveName(version)"
              @cancel="handleCancelEdit"
            />

            <!-- Display mode: show name or empty state -->
            <span
              v-else-if="version.version_name"
              class="version-name"
              @click="startEditing(version)"
            >
              {{ version.version_name }}
            </span>
            <span
              v-else
              class="version-name-empty"
              @click="startEditing(version)"
            >
              (no name)
            </span>
          </div>
          <div class="version-meta">
            <span class="version-date">{{ formatDate(version.created_at) }}</span>
          </div>
        </div>

        <button
          class="btn-preview"
          :class="{ dimmed: editingVersionId === version.id }"
          :data-testid="'preview-version-' + version.id"
          title="Preview version"
          @click="previewVersion(version)"
        >
          <IconEye />
        </button>
      </li>
    </TransitionGroup>

    <!-- Version Preview Modal -->
    <VersionPreviewModal
      v-if="showPreviewModal && selectedVersion"
      :version="selectedVersion"
      :file-id="file.id"
      :is-owner="isOwner"
      @close="closePreviewModal"
      @restored="handleVersionRestored"
    />

    <!-- Toast Notifications -->
    <Toast
      v-if="activeToast"
      :type="activeToast.type"
      :message="activeToast.message"
      :description="activeToast.description"
      @dismiss="hideToast"
    />
  </Pane>
</template>

<style scoped>
  .save-version-container {
    padding: 16px;
    border-bottom: 1px solid var(--color-border);
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
    flex-shrink: 0;
  }

  .version-name {
    color: var(--color-text-secondary);
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .version-name:hover {
    color: var(--color-text-primary);
  }

  .version-name-empty {
    color: var(--color-text-tertiary);
    font-size: 14px;
    font-style: italic;
    cursor: pointer;
  }

  .version-name-empty:hover {
    color: var(--color-text-secondary);
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

  .btn-preview.dimmed {
    opacity: 0.4;
  }

  /* Transition animations */
  .version-list-enter-active {
    transition: all 0.3s ease-out;
  }

  .version-list-enter-from {
    opacity: 0;
    transform: translateY(-16px);
  }

  .version-list-move {
    transition: transform 0.3s ease;
  }
</style>
