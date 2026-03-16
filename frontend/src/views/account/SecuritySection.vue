<script setup>
  import { ref, computed, inject } from "vue";
  import { toast } from "@/utils/toast.js";
  import PasswordInput from "@/components/forms/PasswordInput.vue";
  import PasswordStrength from "@/components/ui/PasswordStrength.vue";

  const user = inject("user");
  const api = inject("api");

  // --- Verification ---

  const isSendingVerification = ref(false);
  const verificationSent = ref(false);

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

  // --- Password ---

  const currentPassword = ref("");
  const newPassword = ref("");
  const confirmPassword = ref("");
  const isChangingPassword = ref(false);

  const hasUnsavedChanges = computed(() => {
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
    if (!hasUnsavedChanges.value) return;

    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";

    toast.info("Changes discarded");
  };

  defineExpose({ hasUnsavedChanges });
</script>

<template>
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
              :icon="verificationSent ? 'CheckCircle' : isSendingVerification ? 'Loader2' : 'Mail'"
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
        <PasswordInput
          v-model="currentPassword"
          label="Current Password"
          autocomplete="current-password"
          :disabled="isChangingPassword"
        />
        <div class="new-password-group">
          <PasswordInput
            v-model="newPassword"
            label="New Password"
            autocomplete="new-password"
            :disabled="isChangingPassword"
          />
          <PasswordStrength :password="newPassword" />
        </div>
        <PasswordInput
          v-model="confirmPassword"
          label="Confirm New Password"
          autocomplete="new-password"
          :disabled="isChangingPassword"
        />
      </div>

      <div class="form-actions">
        <Button
          kind="tertiary"
          :disabled="isChangingPassword || !hasUnsavedChanges"
          text="Cancel"
          @click="onDiscardPassword"
        />
        <Button
          kind="secondary"
          :disabled="isChangingPassword || !hasUnsavedChanges"
          :icon="isChangingPassword ? 'Loader2' : undefined"
          :text="isChangingPassword ? 'Updating...' : 'Update Password'"
          @click="onChangePassword"
        />
      </div>

      <div v-if="hasUnsavedChanges" class="status-message warning" role="status" aria-live="polite">
        <Icon name="AlertCircle" size="16" />
        <span>You have unsaved password changes</span>
      </div>
    </template>
  </Section>
</template>

<style scoped>
  /* Status */
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

  /* Form */
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

  .new-password-group {
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
</style>
