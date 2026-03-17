<script setup>
  import { ref, computed, inject, onMounted, onUnmounted } from "vue";
  import { toast } from "@/utils/toast.js";

  const user = inject("user");
  const api = inject("api");

  // --- Profile form ---

  const newName = ref(null);
  const newInitials = ref(null);
  const newEmail = ref(null);
  const newAffiliation = ref(null);
  const isSaving = ref(false);

  const hasUnsavedChanges = computed(() => {
    return !!(
      (newName.value && newName.value !== user.value?.name) ||
      (newInitials.value && newInitials.value !== user.value?.initials) ||
      (newEmail.value && newEmail.value !== user.value?.email) ||
      (newAffiliation.value && newAffiliation.value !== user.value?.affiliation)
    );
  });

  const onSaveProfile = async () => {
    if (isSaving.value) return;
    isSaving.value = true;
    try {
      const payload = {
        name: newName.value || user.value.name,
        initials: newInitials.value || user.value.initials,
        email: newEmail.value || user.value.email,
        affiliation: newAffiliation.value || user.value.affiliation,
      };

      const res = await api.put(`/users/${user.value.id}`, payload);
      Object.assign(user.value, res.data);
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Failed to update user", error);
      toast.error("Failed to update profile", {
        description: "Please check your connection and try again.",
      });
    } finally {
      isSaving.value = false;
    }
  };

  const showDiscardConfirm = ref(false);

  const onDiscardProfile = () => {
    if (!hasUnsavedChanges.value) return;
    showDiscardConfirm.value = true;
  };

  const confirmDiscard = () => {
    newName.value = null;
    newInitials.value = null;
    newEmail.value = null;
    newAffiliation.value = null;
    showDiscardConfirm.value = false;
    toast.info("Changes discarded");
  };

  const cancelDiscard = () => {
    showDiscardConfirm.value = false;
  };

  // --- Avatar ---

  const fileInputRef = ref(null);
  const selectedFile = ref(null);
  const localPreviewUrl = ref(null);
  const serverAvatarUrl = ref(null);
  const isUploadingAvatar = ref(false);

  const fetchAvatar = async () => {
    if (!user.value) return;
    try {
      const response = await api.get(`/users/${user.value.id}/avatar`, {
        responseType: "blob",
      });
      if (serverAvatarUrl.value) {
        URL.revokeObjectURL(serverAvatarUrl.value);
      }
      serverAvatarUrl.value = URL.createObjectURL(response.data);
    } catch {
      serverAvatarUrl.value = null;
    }
  };

  const previewUrl = computed(() =>
    localPreviewUrl.value ? localPreviewUrl.value : serverAvatarUrl.value || ""
  );

  const onUpload = () => fileInputRef.value?.click();

  const onFileSelected = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (isUploadingAvatar.value) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File size must be less than 5MB");
      return;
    }

    selectedFile.value = file;
    isUploadingAvatar.value = true;

    if (localPreviewUrl.value) URL.revokeObjectURL(localPreviewUrl.value);
    localPreviewUrl.value = URL.createObjectURL(file);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      await api.post(`/users/${user.value.id}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Avatar updated successfully");

      setTimeout(async () => {
        if (localPreviewUrl.value) {
          URL.revokeObjectURL(localPreviewUrl.value);
          localPreviewUrl.value = null;
        }
        await fetchAvatar();
      }, 500);
    } catch (error) {
      console.error("Failed to upload avatar", error);
      toast.error("Failed to upload avatar", {
        description: "Please check your connection and try again.",
      });
    } finally {
      isUploadingAvatar.value = false;
    }
  };

  onMounted(() => fetchAvatar());
  onUnmounted(() => {
    if (localPreviewUrl.value) URL.revokeObjectURL(localPreviewUrl.value);
    if (serverAvatarUrl.value) URL.revokeObjectURL(serverAvatarUrl.value);
  });

  defineExpose({
    hasUnsavedChanges,
    showDiscardConfirm,
    onDiscardProfile,
    confirmDiscard,
    cancelDiscard,
  });
</script>

<template>
  <!-- Hero Section: Profile Overview -->
  <div class="hero-section">
    <div class="profile-hero">
      <div class="avatar-container">
        <div
          class="avatar"
          :style="{
            backgroundImage: previewUrl ? `url(${previewUrl})` : 'none',
          }"
        >
          <div v-if="!previewUrl" class="avatar-placeholder">
            <Icon name="User" size="32" />
          </div>
          <Button
            kind="tertiary"
            :icon="isUploadingAvatar ? 'Loader2' : 'Camera'"
            class="avatar-upload"
            size="sm"
            aria-label="Upload profile picture"
            :disabled="isUploadingAvatar"
            @click="onUpload"
          />
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            style="display: none"
            @change="onFileSelected"
          />
        </div>
      </div>
      <div class="profile-info">
        <h1 class="user-name">{{ user?.name }}</h1>
        <p class="user-email">{{ user?.email }}</p>
        <div class="user-meta">
          <span class="member-since">
            <Icon name="Calendar" size="14" />
            Member since
            {{ user?.created_at ? new Date(user.created_at).toLocaleDateString() : "" }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Personal Information -->
  <Section variant="enhanced">
    <template #title>Personal Information</template>
    <template #content>
      <div class="form-group">
        <InputText
          v-model="newName"
          label="Full Name"
          :placeholder="user?.name"
          direction="column"
        />
        <InputText
          v-model="newInitials"
          label="Initials"
          :placeholder="user?.initials"
          direction="column"
        />
        <InputText
          v-model="newEmail"
          label="Email Address"
          :placeholder="user?.email"
          type="email"
          direction="column"
        />
        <InputText
          v-model="newAffiliation"
          label="Affiliation"
          :placeholder="user?.affiliation || 'Enter your institution or affiliation'"
          direction="column"
        />
      </div>

      <div class="form-actions">
        <Button
          kind="tertiary"
          :disabled="isSaving || !hasUnsavedChanges"
          @click="onDiscardProfile"
        >
          Reset
        </Button>
        <Button
          kind="primary"
          :disabled="isSaving || !hasUnsavedChanges"
          :icon="isSaving ? 'Loader2' : undefined"
          @click="onSaveProfile"
        >
          {{ isSaving ? "Saving..." : "Save Changes" }}
        </Button>
      </div>

      <div v-if="showDiscardConfirm" class="discard-confirm" role="alert">
        <span class="discard-message">
          <Icon name="AlertTriangle" size="16" />
          Discard unsaved changes?
        </span>
        <div class="discard-actions">
          <Button kind="tertiary" size="sm" @click="cancelDiscard">Keep Editing</Button>
          <Button kind="danger" size="sm" icon="Trash" @click="confirmDiscard">Discard</Button>
        </div>
      </div>

      <div
        v-else-if="hasUnsavedChanges"
        class="status-message warning"
        role="status"
        aria-live="polite"
      >
        <Icon name="AlertCircle" size="16" />
        <span>You have unsaved changes</span>
      </div>
    </template>
  </Section>
</template>

<style scoped>
  /* Hero Section */
  .hero-section {
    background: linear-gradient(135deg, var(--information-50) 0%, var(--information-100) 100%);
    margin: 0 0 24px 0;
    border-radius: 16px;
    padding: 32px;
    border: var(--border-thin) solid var(--information-200);
  }

  .profile-hero {
    display: flex;
    align-items: center;
    gap: 24px;
    max-width: 100%;
  }

  /* Avatar Container */
  .avatar-container {
    position: relative;
    flex-shrink: 0;
  }

  .avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background-color: var(--gray-100);
    background-size: cover;
    background-position: center;
    border: 4px solid var(--surface-primary);
    box-shadow: var(--shadow-soft);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-placeholder {
    color: var(--gray-400);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-upload {
    position: absolute;
    bottom: 8px;
    right: 8px;
    border-radius: 50% !important;
    box-shadow: var(--shadow-soft);
    background: var(--surface-primary) !important;
    border: 2px solid var(--surface-primary) !important;
  }

  .avatar-upload :deep(.tabler-icon) {
    color: var(--gray-600);
  }

  /* Profile Info */
  .profile-info {
    flex: 1;
    min-width: 0;
  }

  .user-name {
    font-size: 32px;
    font-weight: var(--weight-semi);
    color: var(--gray-900);
    margin: 0 0 4px 0;
    line-height: 1.2;
  }

  .user-email {
    font-size: 16px;
    color: var(--gray-800);
    margin: 0 0 12px 0;
  }

  .user-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .member-since {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--gray-800);
  }

  /* Form Styling */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 20px;
    border-top: var(--border-thin) solid var(--gray-200);
  }

  /* Status Messages */
  .status-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    margin-top: 16px;
  }

  .status-message.warning {
    background-color: var(--surface-warning);
    border: var(--border-thin) solid var(--border-warning);
    color: var(--warning-700);
  }

  .status-message :deep(.tabler-icon) {
    flex-shrink: 0;
  }

  .status-message.warning :deep(.tabler-icon) {
    color: var(--warning-600);
  }

  /* Discard Confirmation */
  .discard-confirm {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    margin-top: 16px;
    background-color: var(--surface-warning);
    border: var(--border-thin) solid var(--border-warning);
  }

  .discard-message {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: var(--weight-medium);
    color: var(--warning-700);
  }

  .discard-message :deep(.tabler-icon) {
    color: var(--warning-600);
    flex-shrink: 0;
  }

  .discard-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .hero-section {
      padding: 24px;
    }

    .profile-hero {
      flex-direction: column;
      text-align: center;
      gap: 16px;
    }

    .avatar {
      width: 100px;
      height: 100px;
    }

    .user-name {
      font-size: 28px;
    }

    .form-actions {
      flex-direction: column-reverse;
      gap: 12px;
    }
  }

  @media (max-width: 480px) {
    .hero-section {
      padding: 20px;
    }

    .user-name {
      font-size: 24px;
    }
  }
</style>
