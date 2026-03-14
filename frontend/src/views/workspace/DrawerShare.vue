<script setup>
  import { ref, inject, computed, onMounted, watch } from "vue";
  import { downloadBlob } from "@/utils/download.js";

  const PRESS_URL = import.meta.env.VITE_PRESS_URL || "https://scroll.press";

  const api = inject("api");
  const user = inject("user");
  const file = inject("file");

  const isDownloading = ref(false);
  const metadata = ref({ title: "", abstract: "", keywords: "" });
  const isLoadingMeta = ref(false);

  const fileId = computed(() => file.value?.id);
  const fileTitle = computed(() => file.value?.title || "");
  const fileTags = computed(() => (file.value?.tags || []).map((t) => t.name || t).join(", "));

  const isOwner = computed(
    () => file.value?.ownerId === user.value?.id || file.value?.role === "OWNER"
  );

  // Collaborator management
  const collaborators = ref([]);
  const inviteEmail = ref("");
  const inviteRole = ref("EDITOR");
  const inviteError = ref("");
  const isAdding = ref(false);

  const roleOptions = [
    { value: "EDITOR", label: "Editor" },
    { value: "COMMENTER", label: "Commenter" },
  ];

  const isValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.value.trim()));

  async function fetchCollaborators() {
    if (!fileId.value || !isOwner.value) return;
    try {
      const response = await api.get(`/files/${fileId.value}/permissions`);
      collaborators.value = response.data.filter((c) => c.role !== "OWNER");
    } catch {
      collaborators.value = [];
    }
  }

  watch(fileId, fetchCollaborators, { immediate: true });

  watch(inviteEmail, () => {
    inviteError.value = "";
  });

  async function onAddCollaborator() {
    if (isAdding.value) return;

    const trimmed = inviteEmail.value.trim();
    if (!trimmed) {
      inviteError.value = "Enter an email address";
      return;
    }
    if (!isValidEmail.value) {
      inviteError.value = "Enter a valid email address";
      return;
    }

    isAdding.value = true;
    inviteError.value = "";

    const email = inviteEmail.value.trim().toLowerCase();

    if (email === user.value?.email?.toLowerCase()) {
      inviteError.value = "You can't invite yourself";
      isAdding.value = false;
      return;
    }

    try {
      const lookupResp = await api.post("/users/lookup", { email });
      const targetUserId = lookupResp.data.user_id;

      await api.post(`/files/${fileId.value}/permissions`, {
        user_id: targetUserId,
        role: inviteRole.value,
      });

      inviteEmail.value = "";
      inviteRole.value = "EDITOR";
      await fetchCollaborators();
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "";
      if (status === 404) {
        inviteError.value = "No account found for this email";
      } else if (status === 400 && detail.includes("already has permission")) {
        inviteError.value = "This person already has access";
      } else if (status === 429) {
        inviteError.value = "Too many lookups. Try again later.";
      } else {
        inviteError.value = "Something went wrong. Try again.";
      }
    } finally {
      isAdding.value = false;
    }
  }

  async function onRemoveCollaborator(permissionId) {
    try {
      await api.delete(`/files/${fileId.value}/permissions/${permissionId}`);
      collaborators.value = collaborators.value.filter((c) => c.permission_id !== permissionId);
    } catch {
      // Row stays visible on error
    }
  }

  const ownerName = computed(() => user.value?.name || user.value?.email || "");

  async function fetchMetadata() {
    if (!fileId.value) return;
    isLoadingMeta.value = true;
    try {
      const response = await api.get(`/files/${fileId.value}/content/abstract?handrails=false`);
      metadata.value.abstract = response.data?.html || response.data || "";
    } catch {
      metadata.value.abstract = "";
    } finally {
      isLoadingMeta.value = false;
    }
  }

  onMounted(fetchMetadata);

  function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  async function onPublishToPress() {
    if (isDownloading.value) return;
    isDownloading.value = true;
    try {
      const title = fileTitle.value || "manuscript";
      const filename = title.replace(/[<>:"/\\|?*]/g, "_") + ".html";

      const response = await api.get(`/files/${fileId.value}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/html" });
      downloadBlob(blob, filename);

      const params = new URLSearchParams();
      if (fileTitle.value) params.set("title", fileTitle.value);
      const plainAbstract = stripHtml(metadata.value.abstract);
      if (plainAbstract) {
        params.set("abstract", plainAbstract.slice(0, 500));
      }
      if (fileTags.value) params.set("keywords", fileTags.value);
      params.set("source", "studio");

      window.open(`${PRESS_URL}/upload?${params.toString()}`, "_blank");
    } catch (error) {
      console.error("Publish to Press failed:", error);
    } finally {
      isDownloading.value = false;
    }
  }
</script>

<template>
  <Pane>
    <template #header>
      <Icon name="Users" />
      <h3>Share</h3>
    </template>

    <Section>
      <template #title>People</template>
      <template #content>
        <!-- Owner row -->
        <div class="person-row">
          <Avatar
            :user="{ id: user?.id, name: ownerName, avatar_color: user?.avatar_color }"
            size="md"
            :tooltip="false"
          />
          <span class="person-name">{{ ownerName }}</span>
          <Badge>Owner</Badge>
        </div>

        <!-- Collaborator rows -->
        <div v-for="collab in collaborators" :key="collab.permission_id" class="person-row">
          <Avatar
            :user="{
              id: collab.user_id,
              name: collab.user_name,
              avatar_color: collab.avatar_color,
            }"
            size="md"
            :tooltip="false"
          />
          <span class="person-name">{{ collab.user_name || collab.user_email }}</span>
          <Badge>{{ collab.role === "EDITOR" ? "Editor" : "Commenter" }}</Badge>
          <button
            v-if="isOwner"
            class="person-remove"
            :aria-label="`Remove ${collab.user_name}`"
            @click="onRemoveCollaborator(collab.permission_id)"
          >
            <Icon name="X" />
          </button>
        </div>

        <!-- Invite controls (owner only) -->
        <div v-if="isOwner" class="invite-group" @keydown.enter="onAddCollaborator">
          <BaseInput
            v-model="inviteEmail"
            placeholder="Add by email address"
            direction="column"
            size="md"
            :error="inviteError"
            aria-label="Collaborator email address"
          />
          <div class="invite-actions">
            <SelectBox v-model="inviteRole" :options="roleOptions" />
            <Button
              kind="primary"
              size="sm"
              text="Add"
              :disabled="isAdding"
              aria-label="Add collaborator"
              @click="onAddCollaborator"
            />
          </div>
        </div>
      </template>
    </Section>

    <Section>
      <template #title>Publish to Press</template>
      <template #content>
        <div class="row">
          <span class="label">Title</span>
          <span v-if="fileTitle" class="value">{{ fileTitle }}</span>
          <span v-else class="value value--empty">Untitled</span>
        </div>

        <div class="row">
          <span class="label">Abstract</span>
          <span v-if="isLoadingMeta" class="value value--empty">Loading...</span>
          <span v-else-if="metadata.abstract" class="value value--abstract">{{
            stripHtml(metadata.abstract)
          }}</span>
          <span v-else class="value value--empty">No abstract yet</span>
        </div>

        <div class="row">
          <span class="label">Keywords</span>
          <span v-if="fileTags" class="value">{{ fileTags }}</span>
          <span v-else class="value value--empty">No keywords</span>
        </div>

        <p class="publish-hint">
          Your manuscript will be downloaded as HTML and Scroll Press will open with metadata
          pre-filled.
        </p>

        <Button
          kind="secondary"
          size="md"
          icon="Download"
          text="Download & Open Press"
          :disabled="isDownloading"
          @click="onPublishToPress"
        />
      </template>
    </Section>
  </Pane>
</template>

<style scoped>
  /* People rows */
  .person-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 6px;
    margin: 0 -6px;
    border-radius: 6px;
  }

  .person-row:hover {
    background: var(--gray-50);
  }

  .person-name {
    flex: 1;
    font-size: 14px;
    color: var(--gray-700);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .person-remove {
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    min-width: 24px;
    min-height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    color: var(--gray-400);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .person-remove :deep(.tabler-icon) {
    width: 14px;
    height: 14px;
  }

  .person-row:hover .person-remove,
  .person-remove:focus-visible {
    opacity: 1;
  }

  .person-remove:hover {
    color: var(--red-600);
  }

  .person-remove:focus-visible {
    outline: 2px solid var(--primary-200);
    outline-offset: 2px;
  }

  @media (hover: none) {
    .person-remove {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .person-remove {
      transition: none;
    }
  }

  /* Invite controls */
  .invite-group {
    margin-top: 16px;
  }

  .invite-group :deep(.base-input-field::placeholder) {
    color: var(--gray-400);
  }

  .invite-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }

  .invite-actions :deep(.select-box) {
    height: 30px;
    font-size: 13px;
  }

  /* Metadata rows */
  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font-size: 12px;
    color: var(--text-subtle);
  }

  .value {
    font-size: 13px;
    color: var(--gray-800);
    line-height: 1.4;
  }

  .value--empty {
    color: var(--text-subtle);
    font-style: italic;
  }

  .value--abstract {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .publish-hint {
    font-size: 12px;
    color: var(--text-subtle);
    line-height: 1.4;
    margin: 0;
  }
</style>
