<script setup>
  import { ref, inject, onMounted, computed, nextTick, watch } from "vue";
  import { IconFileText, IconHistory } from "@tabler/icons-vue";
  import Button from "@/components/base/Button.vue";
  import EditableText from "@/components/forms/EditableText.vue";
  import Toast from "@/components/ui/Toast.vue";
  import VersionPreviewModal from "./VersionPreviewModal.vue";
  import ContextMenu from "@/components/navigation/ContextMenu.vue";
  import ContextMenuItem from "@/components/navigation/ContextMenuItem.vue";
  import ConfirmationModal from "@/components/ConfirmationModal.vue";

  const api = inject("api");
  const user = inject("user");
  const file = inject("file");

  const versions = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const selectedVersion = ref(null);
  const showPreviewModal = ref(false);
  const isSaving = ref(false);
  const activeToast = ref(null);
  const showDeleteModal = ref(false);
  const versionToDelete = ref(null);
  const editableRefs = ref({});

  // Get current file ID
  const fileId = computed(() => file.value?.id);

  // Check if current user is file owner
  const isOwner = computed(() => {
    return user.value && file.value?.owner_id === user.value.id;
  });

  // Check if modal should be shown
  const shouldShowModal = computed(() => {
    return !!(showPreviewModal.value && selectedVersion.value && fileId.value);
  });

  // Fetch versions for current file
  async function fetchVersions() {
    if (!fileId.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await api.get(`/files/${fileId.value}/versions`);
      versions.value = response.data;
    } catch (err) {
      console.error("Failed to fetch versions:", err);
      error.value = "Failed to load versions";
    } finally {
      isLoading.value = false;
    }
  }

  // Open preview modal for selected version
  async function previewVersion(version) {
    // Defensive: if modal is somehow already open, close it first
    if (showPreviewModal.value) {
      showPreviewModal.value = false;
      selectedVersion.value = null;
      await nextTick();
    }

    // Set selected version first, then show modal
    selectedVersion.value = version;
    await nextTick();
    showPreviewModal.value = true;
  }

  // Close preview modal
  async function closePreviewModal() {
    showPreviewModal.value = false;
    await nextTick();
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
      const response = await api.post(`/files/${fileId.value}/versions/named`, {
        version_name: null,
      });

      const newVersion = response.data;
      versions.value.unshift(newVersion);

      // Scroll to top and auto-focus new version
      await nextTick();
      const versionList = document.querySelector(".version-list");
      versionList?.scrollTo({ top: 0, behavior: "smooth" });

      // Wait for DOM update and activate edit mode
      await nextTick();
      const editableRef = editableRefs.value[newVersion.id];
      if (editableRef?.startEditing) {
        editableRef.startEditing();
      }
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

  // Handle version name save
  async function handleSaveName(version) {
    const originalName = version.version_name;

    try {
      await api.put(`/files/${fileId.value}/versions/${version.id}`, {
        version_name: version.version_name || null,
      });
    } catch (err) {
      console.error("Failed to save version name:", err);
      // Rollback on failure
      version.version_name = originalName;
      showToast({
        type: "error",
        message: "Failed to save version name",
        description: err.response?.data?.detail || "Please try again",
      });
    }
  }

  // Trigger rename for a version
  function handleRename(version) {
    const editableRef = editableRefs.value[version.id];
    if (editableRef?.startEditing) {
      editableRef.startEditing();
    }
  }

  // Delete a version
  function handleDelete(version) {
    versionToDelete.value = version;
    showDeleteModal.value = true;
  }

  async function confirmDelete() {
    const version = versionToDelete.value;
    showDeleteModal.value = false;
    versionToDelete.value = null;
    if (!version) return;

    try {
      await api.delete(`/files/${fileId.value}/versions/${version.id}`);
      versions.value = versions.value.filter((v) => v.id !== version.id);
      showToast({
        type: "success",
        message: "Version deleted",
        description: `Version ${version.version_number} has been removed`,
      });
    } catch (err) {
      console.error("Failed to delete version:", err);
      showToast({
        type: "error",
        message: "Failed to delete version",
        description: err.response?.data?.detail || "Please try again",
      });
    }
  }

  function cancelDelete() {
    showDeleteModal.value = false;
    versionToDelete.value = null;
  }

  const deleteMessage = computed(() => {
    const v = versionToDelete.value;
    if (!v) return "";
    const name = v.version_name ? ` "${v.version_name}"` : "";
    return `Delete version ${v.version_number}${name}? This cannot be undone.`;
  });

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

  // Watch for file changes and refetch versions
  watch(fileId, (newFileId, oldFileId) => {
    if (newFileId && newFileId !== oldFileId) {
      fetchVersions();
    }
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
    <Section>
      <template #content>
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
            :class="{ 'version-item--auto': version.checkpoint_type === 'auto' }"
            :data-testid="'version-item'"
            :data-version-id="version.id"
            :data-checkpoint-type="version.checkpoint_type"
            @click="previewVersion(version)"
          >
            <div class="version-info">
              <div class="version-header">
                <IconHistory
                  v-if="version.checkpoint_type === 'auto'"
                  class="version-type-icon version-type-icon--auto"
                  :size="14"
                />
                <EditableText
                  :ref="(el) => (editableRefs[version.id] = el)"
                  v-model="version.version_name"
                  :placeholder="
                    version.checkpoint_type === 'auto' ? 'Auto-checkpoint' : 'Unnamed version'
                  "
                  text-class="version-name"
                  :edit-on-click="false"
                  @save="handleSaveName(version)"
                />
              </div>
              <div class="version-meta">
                <span class="version-date">{{ formatDate(version.created_at) }}</span>
                <Badge size="sm" variant="info">v{{ version.version_number }}</Badge>
              </div>
            </div>

            <ContextMenu placement="bottom-end">
              <ContextMenuItem icon="Edit" caption="Rename" @click="handleRename(version)" />
              <ContextMenuItem
                icon="TrashX"
                caption="Delete"
                class="danger"
                @click="handleDelete(version)"
              />
            </ContextMenu>
          </li>
        </TransitionGroup>
      </template>
    </Section>

    <!-- Version Preview Modal -->
    <Teleport to="body">
      <VersionPreviewModal
        v-if="showPreviewModal && selectedVersion"
        :version="selectedVersion"
        :file-id="fileId"
        :is-owner="isOwner"
        @close="closePreviewModal"
        @restored="handleVersionRestored"
      />
    </Teleport>

    <!-- Toast Notifications -->
    <Toast
      v-if="activeToast"
      :type="activeToast.type"
      :message="activeToast.message"
      :description="activeToast.description"
      @dismiss="hideToast"
    />

    <ConfirmationModal
      :show="showDeleteModal"
      title="Delete Version?"
      :message="deleteMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
      @close="cancelDelete"
    />
  </Pane>
</template>

<style scoped>
  .save-version-container {
    padding-bottom: 16px;
  }

  .loading,
  .error {
    padding: 16px;
    text-align: center;
    color: var(--text-subtle);
  }

  .error {
    color: var(--text-error);
  }

  .empty-state {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-subtle);
  }

  .empty-state p {
    margin: 0;
  }

  .empty-hint {
    font-size: 13px;
    margin-top: 8px;
    color: var(--text-subtle);
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
    transition: all 0.2s ease;
    cursor: pointer;
    border-radius: 8px;
    margin-bottom: 4px;
  }

  .version-item:hover {
    background: var(--gray-100);
  }

  .version-info {
    flex: 1;
    min-width: 0;
    margin-right: 8px;
  }

  .version-header {
    margin-bottom: 6px;
  }

  .version-name {
    color: var(--text-body);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .version-name-empty {
    color: var(--text-subtle);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.5;
    font-style: italic;
  }

  .version-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-subtle);
  }

  .version-item :deep(.context-menu-trigger) {
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .version-item:hover :deep(.context-menu-trigger),
  .version-item :deep(.context-menu-trigger:has(> .active)),
  .version-item :deep(.context-menu-trigger.active) {
    opacity: 1;
  }

  .version-item--auto {
    opacity: 0.75;
  }

  .version-item--auto:hover {
    opacity: 1;
  }

  .version-type-icon--auto {
    color: var(--text-subtle);
    flex-shrink: 0;
    margin-right: 4px;
  }

  .version-header {
    display: flex;
    align-items: center;
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
