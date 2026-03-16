<script setup>
  import { ref, inject } from "vue";
  import { toast } from "@/utils/toast.js";

  const user = inject("user");
  const api = inject("api");

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
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
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
</script>

<template>
  <Section variant="enhanced" class="danger-zone">
    <template #title>Danger Zone</template>
    <template #content>
      <div class="danger-action">
        <div class="action-content">
          <p>
            Permanently delete your account and all associated data. This action cannot be undone.
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
</template>

<style scoped>
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

  @media (max-width: 768px) {
    .confirm-actions {
      flex-direction: column;
      gap: 8px;
    }
  }
</style>
