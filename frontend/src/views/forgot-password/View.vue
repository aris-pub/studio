<script setup>
  import { ref, inject } from "vue";
  import AuthLayout from "@/components/layout/AuthLayout.vue";

  const api = inject("api");
  const email = ref("");
  const isLoading = ref(false);
  const error = ref("");
  const submitted = ref(false);

  const onSubmit = async () => {
    isLoading.value = true;
    error.value = "";
    try {
      await api.post("/forgot-password", { email: email.value });
      submitted.value = true;
    } catch (err) {
      error.value = err.response?.data?.detail || "Something went wrong. Please try again.";
    } finally {
      isLoading.value = false;
    }
  };
</script>

<template>
  <AuthLayout
    heading="Reset password"
    subheading="Enter your email and we'll send you a reset link"
    :error="error"
    @submit="onSubmit"
  >
    <InputText
      v-if="!submitted"
      v-model="email"
      data-testid="email-input"
      direction="column"
      label="Email"
      type="email"
      required
    />
    <div v-else class="confirmation">
      <div class="confirmation-icon">
        <Icon name="mail-check" :size="40" />
      </div>
      <p class="confirmation-text">
        If an account exists for <strong>{{ email }}</strong
        >, we've sent a password reset link.
      </p>
      <p class="confirmation-hint text-caption">Check your inbox and spam folder.</p>
    </div>

    <template #actions>
      <Button
        v-if="!submitted"
        data-testid="submit-button"
        kind="primary"
        block
        :text="isLoading ? 'Sending...' : 'Send reset link'"
        :disabled="isLoading"
        @click="onSubmit"
      />
      <Button kind="secondary" block text="Back to sign in" @click="$router.push('/login')" />
    </template>
  </AuthLayout>
</template>

<style scoped>
  .confirmation {
    text-align: center;
    padding: 8px 0;
  }

  .confirmation-icon {
    color: var(--primary-500);
    margin-bottom: 16px;
  }

  .confirmation-text {
    font-size: 15px;
    color: var(--gray-800);
    margin: 0 0 8px;
    line-height: 1.5;
  }

  .confirmation-hint {
    color: var(--gray-500);
    margin: 0;
  }
</style>
