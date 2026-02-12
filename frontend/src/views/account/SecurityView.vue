<script setup>
  import { ref, computed, inject, onUnmounted, watch } from "vue";
  import { toast } from "@/utils/toast.js";
  import PasswordStrength from "@/components/ui/PasswordStrength.vue";

  const user = inject("user");
  const api = inject("api");
  const refreshUser = inject("refreshUser");

  // Email verification functionality
  const isSendingVerification = ref(false);
  const verificationSent = ref(false);

  // Password change functionality
  const currentPassword = ref("");
  const newPassword = ref("");
  const confirmPassword = ref("");
  const isChangingPassword = ref(false);

  // Dirty state tracking
  const hasUnsavedPasswordChanges = computed(() => {
    return !!(currentPassword.value || newPassword.value || confirmPassword.value);
  });

  const onChangePassword = async () => {
    console.log("[SecurityView] onChangePassword called", {
      isChangingPassword: isChangingPassword.value,
      user: user.value,
      currentPassword: currentPassword.value ? "***" : "empty",
      newPassword: newPassword.value ? "***" : "empty",
      confirmPassword: confirmPassword.value ? "***" : "empty",
    });

    if (isChangingPassword.value) {
      console.log("[SecurityView] Already changing password, returning");
      return;
    }

    // Check if user exists
    if (!user.value) {
      console.error("[SecurityView] User not found:", user.value);
      toast.error("User not found");
      return;
    }

    console.log("[SecurityView] User found:", {
      id: user.value.id,
      email: user.value.email,
      email_verified: user.value.email_verified,
    });

    // Basic validation
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
    console.log("[SecurityView] Starting password change API call");

    try {
      const apiCall = api.post(`/users/${user.value.id}/change-password`, {
        current_password: currentPassword.value,
        new_password: newPassword.value,
      });

      console.log("[SecurityView] API call initiated for user:", user.value.id);
      const response = await apiCall;
      console.log("[SecurityView] Password change successful:", response.status);

      // Clear password fields
      currentPassword.value = "";
      newPassword.value = "";
      confirmPassword.value = "";

      toast.success("Password changed successfully");
    } catch (error) {
      console.error("[SecurityView] Password change failed:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        },
      });

      if (error.response?.status === 401) {
        console.log("[SecurityView] 401 error - incorrect password or auth failure");
        toast.error("Current password is incorrect");
      } else {
        console.log("[SecurityView] Non-401 error:", error.response?.status);
        toast.error("Failed to change password", {
          description: "Please check your connection and try again.",
        });
      }
    } finally {
      console.log("[SecurityView] Password change completed, resetting isChangingPassword");
      isChangingPassword.value = false;
    }
  };

  const onDiscard = () => {
    console.log("[SecurityView] onDiscard called", {
      hasUnsavedPasswordChanges: hasUnsavedPasswordChanges.value,
      currentPassword: currentPassword.value ? "***" : "empty",
      newPassword: newPassword.value ? "***" : "empty",
      confirmPassword: confirmPassword.value ? "***" : "empty",
    });

    if (!hasUnsavedPasswordChanges.value) {
      console.log("[SecurityView] No unsaved changes, returning");
      return;
    }

    console.log("[SecurityView] Discarding changes, resetting fields");
    // Reset password fields
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";

    console.log("[SecurityView] Fields reset, values now:", {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value,
      hasUnsavedPasswordChanges: hasUnsavedPasswordChanges.value,
    });

    toast.info("Changes discarded");
  };

  // Warn before leaving with unsaved changes
  const handleBeforeUnload = (e) => {
    if (hasUnsavedPasswordChanges.value) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  };

  // Watch for unsaved changes and add/remove beforeunload listener
  watch(hasUnsavedPasswordChanges, (hasChanges) => {
    if (hasChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  });

  const onSendVerificationEmail = async () => {
    console.log("[SecurityView] onSendVerificationEmail called", {
      isSendingVerification: isSendingVerification.value,
      user: user.value,
      email_verified: user.value?.email_verified,
    });

    if (isSendingVerification.value) {
      console.log("[SecurityView] Already sending verification, returning");
      return;
    }

    // Check if user exists
    if (!user.value) {
      console.error("[SecurityView] User not found for email verification:", user.value);
      toast.error("User not found");
      return;
    }

    console.log("[SecurityView] Sending verification email for user:", user.value.id);

    isSendingVerification.value = true;
    verificationSent.value = false;

    try {
      console.log("[SecurityView] Calling send-verification API");
      const response = await api.post(`/users/${user.value.id}/send-verification`);
      console.log("[SecurityView] Verification email sent successfully:", response.status);
      verificationSent.value = true;
      toast.success("Verification email sent successfully", {
        description: "Please check your email and click the verification link.",
      });
    } catch (error) {
      console.error("[SecurityView] Failed to send verification email:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });

      if (error.response?.status === 400) {
        console.log("[SecurityView] Email already verified");
        toast.error("Email is already verified");
      } else {
        console.log("[SecurityView] Verification email error:", error.response?.status);
        toast.error("Failed to send verification email", {
          description: "Please check your connection and try again.",
        });
      }
    } finally {
      console.log("[SecurityView] Verification email process completed");
      isSendingVerification.value = false;
    }
  };

  // Lifecycle
  onUnmounted(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  });
</script>

<template>
  <Pane>
    <template #header>
      <Icon name="Shield" />
      <span class="title">Security</span>
    </template>

    <!-- Account Status -->
    <Section>
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

    <!-- Password Management -->
    <Section>
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
            @click="onDiscard"
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
  </Pane>
</template>

<style scoped>
  /* Header Title */
  .title {
    margin-left: 8px;
    font-weight: var(--weight-medium);
  }

  /* Security Layout Container */
  .security-layout {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Status Grid */
  .status-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: var(--border-thin) solid var(--gray-200);
    border-radius: 12px;
    background: var(--gray-50);
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

  .verification-sent {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--success-600);
    font-size: 13px;
    font-weight: var(--weight-medium);
  }

  .link {
    color: var(--primary-600);
    text-decoration: none;
  }

  .link:hover {
    text-decoration: underline;
  }

  /* Form Styling */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .password-field {
    position: relative;
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
    .content-section {
      padding: 20px;
    }

    .form-actions {
      flex-direction: column-reverse;
      gap: 12px;
    }

    .status-item {
      padding: 12px;
    }

    .session-item {
      padding: 12px;
    }
  }

  @media (max-width: 480px) {
    .content-section {
      padding: 16px;
    }
  }
</style>
