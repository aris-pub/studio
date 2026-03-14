<script setup>
  import { ref, inject } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import AuthLayout from "@/components/layout/AuthLayout.vue";
  import PasswordInput from "@/components/forms/PasswordInput.vue";
  import PasswordStrength from "@/components/ui/PasswordStrength.vue";

  const api = inject("api");
  const route = useRoute();
  const router = useRouter();

  const password = ref("");
  const isLoading = ref(false);
  const error = ref("");
  const success = ref(false);

  const onSubmit = async () => {
    if (password.value.length < 8) {
      error.value = "Password must be at least 8 characters.";
      return;
    }

    isLoading.value = true;
    error.value = "";
    try {
      await api.post("/reset-password", {
        token: route.params.token,
        new_password: password.value,
      });
      success.value = true;
    } catch (err) {
      error.value = err.response?.data?.detail || "Something went wrong. Please try again.";
    } finally {
      isLoading.value = false;
    }
  };
</script>

<template>
  <AuthLayout
    heading="Set new password"
    subheading="Choose a strong password for your account"
    :error="error"
    @submit="onSubmit"
  >
    <div v-if="!success">
      <PasswordInput v-model="password" data-testid="password-input" required />
      <PasswordStrength :password="password" />
    </div>
    <div v-else class="confirmation">
      <div class="confirmation-icon">
        <Icon name="circle-check" :size="40" />
      </div>
      <p class="confirmation-text">Your password has been reset.</p>
    </div>

    <template #actions>
      <Button
        v-if="!success"
        data-testid="submit-button"
        kind="primary"
        block
        :text="isLoading ? 'Resetting...' : 'Reset password'"
        :disabled="isLoading"
        @click="onSubmit"
      />
      <Button v-else kind="primary" block text="Sign in" @click="router.push('/login')" />
    </template>
  </AuthLayout>
</template>

<style scoped>
  .confirmation {
    text-align: center;
    padding: 8px 0;
  }

  .confirmation-icon {
    color: var(--success-500);
    margin-bottom: 16px;
  }

  .confirmation-text {
    font-size: 15px;
    color: var(--gray-800);
    margin: 0;
    line-height: 1.5;
  }
</style>
