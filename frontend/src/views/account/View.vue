<script setup>
  import { ref, computed, inject, onMounted, onUnmounted, watch } from "vue";
  import { toast } from "@/utils/toast.js";
  import PasswordStrength from "@/components/ui/PasswordStrength.vue";

  const user = inject("user");
  const api = inject("api");
  const refreshUser = inject("refreshUser");

  // --- Profile ---

  const newName = ref(null);
  const newInitials = ref(null);
  const newEmail = ref(null);
  const newAffiliation = ref(null);
  const isSaving = ref(false);

  const hasUnsavedProfileChanges = computed(() => {
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

  const onDiscardProfile = () => {
    if (!hasUnsavedProfileChanges.value) return;

    if (confirm("Are you sure you want to discard your unsaved changes?")) {
      newName.value = null;
      newInitials.value = null;
      newEmail.value = null;
      newAffiliation.value = null;
      toast.info("Changes discarded");
    }
  };

  // Profile picture upload
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

  // --- Security ---

  const isSendingVerification = ref(false);
  const verificationSent = ref(false);

  const currentPassword = ref("");
  const newPassword = ref("");
  const confirmPassword = ref("");
  const isChangingPassword = ref(false);

  const hasUnsavedPasswordChanges = computed(() => {
    return !!(currentPassword.value || newPassword.value || confirmPassword.value);
  });

  const onChangePassword = async () => {
    if (isChangingPassword.value) return;

    if (!user.value) {
      toast.error("User not found");
      return;
    }

    if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword.value !== confirmPassword.value) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.value.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }

    isChangingPassword.value = true;

    try {
      await api.post(`/users/${user.value.id}/change-password`, {
        current_password: currentPassword.value,
        new_password: newPassword.value,
      });

      currentPassword.value = "";
      newPassword.value = "";
      confirmPassword.value = "";

      toast.success("Password changed successfully");
    } catch (error) {
      console.error("Password change failed:", error);

      if (error.response?.status === 401) {
        toast.error("Current password is incorrect");
      } else {
        toast.error("Failed to change password", {
          description: "Please check your connection and try again.",
        });
      }
    } finally {
      isChangingPassword.value = false;
    }
  };

  const onDiscardPassword = () => {
    if (!hasUnsavedPasswordChanges.value) return;

    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";

    toast.info("Changes discarded");
  };

  const onSendVerificationEmail = async () => {
    if (isSendingVerification.value) return;

    if (!user.value) {
      toast.error("User not found");
      return;
    }

    isSendingVerification.value = true;
    verificationSent.value = false;

    try {
      await api.post(`/users/${user.value.id}/send-verification`);
      verificationSent.value = true;
      toast.success("Verification email sent successfully", {
        description: "Please check your email and click the verification link.",
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);

      if (error.response?.status === 400) {
        toast.error("Email is already verified");
      } else {
        toast.error("Failed to send verification email", {
          description: "Please check your connection and try again.",
        });
      }
    } finally {
      isSendingVerification.value = false;
    }
  };

  // --- Privacy / Data Management ---

  const isExporting = ref(false);

  const onExportData = async () => {
    if (isExporting.value) return;
    isExporting.value = true;

    try {
      const response = await api.get(`/users/${user.value.id}/export`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${user.value.name}-data-export.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Data export downloaded successfully");
    } catch (error) {
      console.error("Failed to export data", error);
      toast.error("Failed to export data", {
        description: "Please try again later.",
      });
    } finally {
      isExporting.value = false;
    }
  };

  const showDeleteConfirm = ref(false);
  const deleteConfirmText = ref("");
  const isDeletingAccount = ref(false);

  const onDeleteAccount = async () => {
    if (isDeletingAccount.value) return;

    if (deleteConfirmText.value !== "DELETE") {
      toast.error('Please type "DELETE" to confirm account deletion');
      return;
    }

    isDeletingAccount.value = true;

    try {
      await api.delete(`/users/${user.value.id}`);
      toast.success("Account deleted successfully");
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to delete account", error);
      toast.error("Failed to delete account", {
        description: "Please try again later.",
      });
    } finally {
      isDeletingAccount.value = false;
    }
  };

  // --- Unified beforeunload ---

  const hasAnyUnsavedChanges = computed(
    () => hasUnsavedProfileChanges.value || hasUnsavedPasswordChanges.value
  );

  const handleBeforeUnload = (e) => {
    if (hasAnyUnsavedChanges.value) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  };

  watch(hasAnyUnsavedChanges, (hasChanges) => {
    if (hasChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  });

  // --- Lifecycle ---

  onMounted(() => fetchAvatar());
  onUnmounted(() => {
    if (localPreviewUrl.value) URL.revokeObjectURL(localPreviewUrl.value);
    if (serverAvatarUrl.value) URL.revokeObjectURL(serverAvatarUrl.value);
    window.removeEventListener("beforeunload", handleBeforeUnload);
  });
</script>

<template>
  <BaseLayout :fab="false">
    <Pane>
      <template #header>
        <Icon name="User" />
        <span class="title">Account</span>
      </template>

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
              :disabled="isSaving || !hasUnsavedProfileChanges"
              @click="onDiscardProfile"
            >
              Reset
            </Button>
            <Button
              kind="primary"
              :disabled="isSaving || !hasUnsavedProfileChanges"
              :icon="isSaving ? 'Loader2' : undefined"
              @click="onSaveProfile"
            >
              {{ isSaving ? "Saving..." : "Save Changes" }}
            </Button>
          </div>

          <div v-if="hasUnsavedProfileChanges" class="status-message warning">
            <Icon name="AlertCircle" size="16" />
            <span>You have unsaved changes</span>
          </div>
        </template>
      </Section>

      <!-- Account Status -->
      <Section variant="enhanced">
        <template #title>Account Status</template>
        <template #content>
          <p>Your account security status and verification</p>
          <div class="status-item">
            <div :class="['status-indicator', user?.email_verified ? 'verified' : 'warning']">
              <Icon :name="user?.email_verified ? 'Check' : 'AlertCircle'" size="16" />
            </div>
            <div class="status-content">
              <h3>{{ user?.email_verified ? "Email Verified" : "Email Not Verified" }}</h3>
              <p>{{ user?.email || "No email" }}</p>
              <div v-if="!user?.email_verified" class="verification-actions">
                <Button
                  kind="secondary"
                  size="sm"
                  :disabled="isSendingVerification || verificationSent"
                  :icon="
                    verificationSent ? 'CheckCircle' : isSendingVerification ? 'Loader2' : 'Mail'
                  "
                  :text="
                    verificationSent
                      ? 'Verification email sent'
                      : isSendingVerification
                        ? 'Sending...'
                        : 'Send Verification Email'
                  "
                  @click="onSendVerificationEmail"
                />
              </div>
            </div>
          </div>
        </template>
      </Section>

      <!-- Password -->
      <Section variant="enhanced">
        <template #title>Password</template>
        <template #content>
          <p>Change your account password</p>

          <div class="form-group">
            <InputText
              v-model="currentPassword"
              label="Current Password"
              type="password"
              :disabled="isChangingPassword"
              direction="column"
            />
            <div class="password-field">
              <InputText
                v-model="newPassword"
                label="New Password"
                type="password"
                :disabled="isChangingPassword"
                direction="column"
              />
              <PasswordStrength :password="newPassword" />
            </div>
            <InputText
              v-model="confirmPassword"
              label="Confirm New Password"
              type="password"
              :disabled="isChangingPassword"
              direction="column"
            />
          </div>

          <div class="form-actions">
            <Button
              kind="tertiary"
              :disabled="isChangingPassword || !hasUnsavedPasswordChanges"
              text="Cancel"
              @click="onDiscardPassword"
            />
            <Button
              kind="secondary"
              :disabled="isChangingPassword || !hasUnsavedPasswordChanges"
              :icon="isChangingPassword ? 'Loader2' : undefined"
              :text="isChangingPassword ? 'Updating...' : 'Update Password'"
              @click="onChangePassword"
            />
          </div>

          <div v-if="hasUnsavedPasswordChanges" class="status-message warning">
            <Icon name="AlertCircle" size="16" />
            <span>You have unsaved password changes</span>
          </div>
        </template>
      </Section>

      <!-- Data Management -->
      <Section variant="enhanced">
        <template #title>Data Management</template>
        <template #content>
          <div class="data-action">
            <div class="action-content">
              <h3>Export Your Data</h3>
              <p>Download a copy of all your account data, research, and settings</p>
            </div>
            <Button
              kind="tertiary"
              :icon="isExporting ? 'Loader2' : 'Download'"
              :disabled="isExporting"
              @click="onExportData"
            >
              {{ isExporting ? "Exporting..." : "Export Data" }}
            </Button>
          </div>
        </template>
      </Section>

      <!-- Danger Zone -->
      <Section variant="enhanced" class="danger-zone">
        <template #title>Danger Zone</template>
        <template #content>
          <div class="danger-action">
            <div class="action-content">
              <p>
                Permanently delete your account and all associated data. This action cannot be
                undone.
              </p>
            </div>

            <div v-if="!showDeleteConfirm" class="action-button">
              <Button kind="danger" icon="Trash" @click="showDeleteConfirm = true">
                Delete Account
              </Button>
            </div>

            <div v-else class="delete-confirm">
              <div class="confirm-input">
                <InputText
                  v-model="deleteConfirmText"
                  label="Type 'DELETE' to confirm"
                  placeholder="DELETE"
                  direction="column"
                />
              </div>
              <div class="confirm-actions">
                <Button
                  kind="tertiary"
                  @click="
                    showDeleteConfirm = false;
                    deleteConfirmText = '';
                  "
                >
                  Cancel
                </Button>
                <Button
                  kind="danger"
                  :icon="isDeletingAccount ? 'Loader2' : 'Trash'"
                  :disabled="isDeletingAccount || deleteConfirmText !== 'DELETE'"
                  @click="onDeleteAccount"
                >
                  {{ isDeletingAccount ? "Deleting..." : "Delete Forever" }}
                </Button>
              </div>
            </div>
          </div>
        </template>
      </Section>
    </Pane>
  </BaseLayout>
</template>

<style scoped>
  /* Header Title */
  .title {
    margin-left: 8px;
    font-weight: var(--weight-medium);
  }

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
    color: var(--gray-600);
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
    color: var(--gray-500);
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

  .password-field {
    position: relative;
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

  /* Account Status */
  .status-item {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .status-indicator {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .status-indicator.verified {
    background-color: var(--success-100);
    color: var(--success-600);
  }

  .status-indicator.warning {
    background-color: var(--warning-100);
    color: var(--warning-600);
  }

  .status-content {
    flex: 1;
    min-width: 0;
  }

  .status-content h3 {
    font-size: 14px;
    font-weight: var(--weight-medium);
    color: var(--gray-900);
    margin: 0 0 2px 0;
  }

  .status-content p {
    font-size: 13px;
    color: var(--gray-600);
    margin: 0;
  }

  .verification-actions {
    margin-top: 12px;
  }

  /* Data Management */
  .data-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .action-content {
    flex: 1;
    min-width: 0;
  }

  .action-content h3 {
    font-size: 14px;
    font-weight: var(--weight-medium);
    color: var(--gray-900);
    margin: 0 0 4px 0;
  }

  .action-content p {
    font-size: 13px;
    color: var(--gray-600);
    margin: 0;
  }

  /* Danger Zone */
  .danger-action {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .danger-action .action-content {
    flex: 1;
  }

  .danger-action .action-content p {
    color: var(--red-600);
    margin: 0;
  }

  .action-button {
    flex-shrink: 0;
  }

  .danger-zone {
    border-color: var(--red-200) !important;
  }

  .danger-zone :deep(.title) {
    color: var(--red-700) !important;
    border-bottom-color: var(--red-200) !important;
  }



  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background-color: var(--red-50);
    border: var(--border-thin) solid var(--red-200);
    border-radius: 8px;
  }

  .confirm-input {
    max-width: 200px;
  }

  .confirm-actions {
    display: flex;
    gap: 12px;
  }


  /* Loading states */
  :deep(.tabler-icon-loader-2) {
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

    .data-action {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .confirm-actions {
      flex-direction: column;
      gap: 8px;
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
