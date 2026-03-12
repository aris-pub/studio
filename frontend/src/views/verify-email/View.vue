<script setup>
  import { ref, inject, onMounted, computed, nextTick } from "vue";
  import { useRoute, useRouter } from "vue-router";

  const route = useRoute();
  const router = useRouter();
  const api = inject("api");

  // 'loading' | 'success' | 'alreadyVerified' | 'error'
  const state = ref("loading");
  const primaryButtonRef = ref(null);

  const isAuthenticated = computed(() => !!localStorage.getItem("accessToken"));

  const ctaLabel = computed(() => (isAuthenticated.value ? "Open Studio" : "Sign in"));

  function navigateCta() {
    router.push(isAuthenticated.value ? "/" : "/login");
  }

  onMounted(async () => {
    try {
      await api.post(`/users/verify-email/${route.params.token}`);

      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          user.email_verified = true;
          localStorage.setItem("user", JSON.stringify(user));
        } catch {
          // malformed localStorage entry — leave it alone
        }
      }

      state.value = "success";
    } catch (err) {
      state.value = err?.response?.status === 400 ? "alreadyVerified" : "error";
    }

    await nextTick();
    primaryButtonRef.value?.$el?.focus();
  });
</script>

<template>
  <div class="view">
    <div class="right">
      <div class="wrapper">
        <!-- Loading -->
        <div
          v-if="state === 'loading'"
          data-testid="state-loading"
          class="state-content"
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner size="medium" :compact="true" />
          <h2 class="text-h5">Verifying your email...</h2>
          <p>Please wait a moment.</p>
        </div>

        <!-- Success -->
        <template v-else-if="state === 'success'">
          <div data-testid="state-success" class="state-content" role="status" aria-live="polite">
            <div
              class="state-icon"
              style="background-color: var(--success-100); color: var(--success-600)"
            >
              <Icon name="CircleCheck" />
            </div>
            <h2 class="text-h5">Email verified</h2>
            <p>Your email address has been confirmed.</p>
          </div>
          <div class="actions">
            <Button
              ref="primaryButtonRef"
              data-testid="cta-primary"
              kind="primary"
              block
              :text="ctaLabel"
              @click="navigateCta"
            />
          </div>
        </template>

        <!-- Already verified (400) -->
        <template v-else-if="state === 'alreadyVerified'">
          <div
            data-testid="state-already-verified"
            class="state-content"
            role="status"
            aria-live="polite"
          >
            <div
              class="state-icon"
              style="background-color: var(--information-100); color: var(--information-600)"
            >
              <Icon name="CircleCheck" />
            </div>
            <h2 class="text-h5">Already verified</h2>
            <p>This email address has already been confirmed. No action needed.</p>
          </div>
          <div class="actions">
            <Button
              ref="primaryButtonRef"
              data-testid="cta-primary"
              kind="primary"
              block
              :text="ctaLabel"
              @click="navigateCta"
            />
          </div>
        </template>

        <!-- Expired / invalid (404 or other) -->
        <template v-else>
          <div data-testid="state-error" class="state-content" role="alert" aria-live="assertive">
            <div
              class="state-icon"
              style="background-color: var(--error-100); color: var(--error-600)"
            >
              <Icon name="CircleX" />
            </div>
            <h2 class="text-h5">Link expired</h2>
            <p>
              This link may have expired or already been used. You can request a new one from your
              account settings.
            </p>
          </div>
          <div class="actions">
            <Button
              ref="primaryButtonRef"
              data-testid="cta-primary"
              kind="primary"
              block
              text="Go to account settings"
              @click="router.push('/account')"
            />
            <Button
              data-testid="cta-secondary"
              kind="secondary"
              block
              text="Go to home"
              @click="router.push('/')"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .view {
    display: flex;
    flex-grow: 2;
    height: 100%;
    width: 100%;
  }

  .right {
    background-color: var(--surface-primary);
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .right .wrapper {
    width: 60%;
    min-width: 192px;
    max-width: 384px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;

    & > * {
      width: 100%;
    }
  }

  .state-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .state-content p {
    color: var(--gray-600);
    max-width: 30ch;
  }

  .state-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .state-icon :deep(.tabler-icon) {
    width: 24px;
    height: 24px;
    margin: 0;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
