<script setup>
  import { ref, inject, computed, onMounted } from "vue";
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

  const ownerName = computed(() => user.value?.name || user.value?.email || "");
  const ownerInitials = computed(() => {
    const name = ownerName.value;
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

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
        <div class="person-row">
          <span class="person-avatar" aria-hidden="true">{{ ownerInitials }}</span>
          <span class="person-name">{{ ownerName }}</span>
          <span class="person-role">Owner</span>
        </div>

        <div class="invite-group">
          <input
            type="email"
            class="invite-input"
            placeholder="Invite collaborators (coming soon)"
            disabled
          />
          <p class="invite-hint">Requires the notification system, currently under development.</p>
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
  /* People rows — modeled on DrawerVersions .version-item */
  .person-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }

  .person-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--purple-100, #f3e8ff);
    color: var(--purple-700, #7629c7);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
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

  .person-role {
    font-size: 12px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  /* Invite field */
  .invite-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .invite-input {
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 8px;
    background: var(--surface-page);
    color: var(--color-text-tertiary);
    cursor: not-allowed;
    box-sizing: border-box;
  }

  .invite-input::placeholder {
    color: var(--color-text-tertiary);
  }

  .invite-hint {
    font-size: 12px;
    color: var(--color-text-tertiary);
    line-height: 1.4;
    margin: 0;
  }

  /* Metadata rows — same .row / .label pattern as FileSettings */
  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .value {
    font-size: 13px;
    color: var(--gray-800);
    line-height: 1.4;
  }

  .value--empty {
    color: var(--color-text-tertiary);
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
    color: var(--color-text-tertiary);
    line-height: 1.4;
    margin: 0;
  }
</style>
