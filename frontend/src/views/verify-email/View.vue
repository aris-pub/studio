<script setup>
  import { ref, inject, onMounted, computed, nextTick } from "vue";
  import { useRoute, useRouter } from "vue-router";

  const route = useRoute();
  const router = useRouter();
  const api = inject("api");

  // 'loading' | 'success' | 'alreadyVerified' | 'error' | 'serverError'
  const state = ref("loading");
  const primaryButtonRef = ref(null);
  const retryButtonRef = ref(null);

  const isAuthenticated = computed(() => !!localStorage.getItem("accessToken"));

  const ctaLabel = computed(() => (isAuthenticated.value ? "Open Studio" : "Sign in"));

  function navigateCta() {
    router.push(isAuthenticated.value ? "/" : "/login");
  }

  function isTokenError(status) {
    return status === 404 || status === 410;
  }

  async function verifyToken() {
    state.value = "loading";
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
      const status = err?.response?.status;
      if (status === 400) {
        state.value = "alreadyVerified";
      } else if (isTokenError(status)) {
        state.value = "error";
      } else {
        state.value = "serverError";
      }
    }

    await nextTick();
    primaryButtonRef.value?.$el?.focus();
    retryButtonRef.value?.$el?.focus();
  }

  onMounted(verifyToken);
</script>

<template>
  <main class="view">
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

        <!-- Expired / invalid token (404 / 410) -->
        <template v-else-if="state === 'error'">
          <div data-testid="state-error" class="state-content" role="alert" aria-live="assertive">
            <div
              class="state-icon"
              style="background-color: var(--error-100); color: var(--error-600)"
            >
              <Icon name="CircleX" />
            </div>
            <h2 class="text-h5">Link expired</h2>
            <p v-if="isAuthenticated">
              This link may have expired or already been used. You can request a new one from your
              account settings.
            </p>
            <p v-else>
              This link may have expired or already been used. Please sign in to request a new
              verification email.
            </p>
          </div>
          <div class="actions">
            <Button
              ref="primaryButtonRef"
              data-testid="cta-primary"
              kind="primary"
              block
              :text="isAuthenticated ? 'Go to account settings' : 'Sign in'"
              @click="router.push(isAuthenticated ? '/account' : '/login')"
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

        <!-- Server / network error (5xx, timeout, CORS, etc.) -->
        <template v-else-if="state === 'serverError'">
          <div
            data-testid="state-server-error"
            class="state-content"
            role="alert"
            aria-live="assertive"
          >
            <div
              class="state-icon"
              style="background-color: var(--warning-100); color: var(--warning-600)"
            >
              <Icon name="AlertTriangle" />
            </div>
            <h2 class="text-h5">Something went wrong</h2>
            <p>We couldn't reach the server. Please try again in a moment.</p>
          </div>
          <div class="actions">
            <Button
              ref="retryButtonRef"
              data-testid="cta-retry"
              kind="primary"
              block
              text="Try again"
              @click="verifyToken"
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
  </main>
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
