<script setup>
  /**
   * Magic-link invitation landing (std-nbpwwn). Reads the token's metadata, shows
   * a prefilled signup (email locked to the invited address), and on submit calls
   * consume, which creates the account, grants access, and signs the user in.
   *
   * The token is kept out of the address bar and the Referer header: a no-referrer
   * meta is added for this page and the token is stripped from the URL after read.
   */
  import { ref, computed, inject, onMounted, onBeforeUnmount } from "vue";
  import { useRoute, useRouter } from "vue-router";

  import { saveSession } from "@/auth/session.js";
  import { createFileStore } from "@/store/FileStore.js";
  import AuthLayout from "@/components/layout/AuthLayout.vue";
  import PasswordInput from "@/components/forms/PasswordInput.vue";
  import PasswordStrength from "@/components/ui/PasswordStrength.vue";

  const route = useRoute();
  const router = useRouter();
  const api = inject("api");
  const user = inject("user");
  const fileStore = inject("fileStore");

  const token = route.params.token;
  // loading | ready | expired | used | invalid | serverError
  const state = ref("loading");
  const meta = ref(null);
  const name = ref("");
  const pwd = ref("");
  const error = ref("");
  const isSubmitting = ref(false);

  let referrerMeta = null;

  const roleLabel = computed(() => (meta.value?.role === "EDITOR" ? "an editor" : "a commenter"));
  const subheading = computed(
    () =>
      `${meta.value?.inviter_name || "Someone"} invited you to "${meta.value?.file_title}" as ${roleLabel.value}`
  );

  function stateForStatus(status) {
    if (status === 410) return "expired";
    if (status === 409) return "used";
    if (status === 404) return "invalid";
    return "serverError";
  }

  async function load() {
    state.value = "loading";
    try {
      const resp = await api.get(`/invitations/${token}`);
      meta.value = resp.data;
      state.value = "ready";
    } catch (err) {
      state.value = stateForStatus(err?.response?.status);
    }
  }

  async function onAccept() {
    error.value = "";
    isSubmitting.value = true;
    try {
      const resp = await api.post(`/invitations/${token}/consume`, {
        name: name.value,
        password: pwd.value,
      });
      const data = resp.data;
      saveSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
      });
      user.value = data.user;
      fileStore.value = createFileStore(api, user.value);
      router.push(`/file/${data.file_id}`);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) state.value = "used";
      else if (status === 410) state.value = "expired";
      else if (status === 422)
        error.value = "Enter your name and a password of at least 8 characters.";
      else error.value = "Something went wrong. Please try again.";
    } finally {
      isSubmitting.value = false;
    }
  }

  onMounted(() => {
    referrerMeta = document.createElement("meta");
    referrerMeta.name = "referrer";
    referrerMeta.content = "no-referrer";
    document.head.appendChild(referrerMeta);
    try {
      window.history.replaceState({}, "", "/invitations/");
    } catch {
      // history may be unavailable in some embedded contexts; ignore
    }
    load();
  });

  onBeforeUnmount(() => {
    if (referrerMeta && referrerMeta.parentNode) referrerMeta.parentNode.removeChild(referrerMeta);
  });
</script>

<template>
  <AuthLayout
    v-if="state === 'ready'"
    heading="You've been invited"
    :subheading="subheading"
    :error="error"
    @submit="onAccept"
  >
    <InputText
      :model-value="meta.invited_email"
      data-testid="invited-email"
      direction="column"
      label="Email"
      type="email"
      disabled
    />
    <InputText
      v-model="name"
      data-testid="name-input"
      direction="column"
      label="Display name"
      autocomplete="name"
      required
    />
    <div>
      <PasswordInput
        v-model="pwd"
        data-testid="password-input"
        autocomplete="new-password"
        required
      />
      <PasswordStrength :password="pwd" />
    </div>

    <template #actions>
      <Button
        data-testid="accept-button"
        type="submit"
        kind="primary"
        block
        :text="isSubmitting ? 'Setting up...' : 'Accept invitation'"
        :disabled="isSubmitting"
      />
    </template>
  </AuthLayout>

  <main v-else class="view">
    <div class="right">
      <div class="wrapper">
        <div
          v-if="state === 'loading'"
          data-testid="state-loading"
          class="state-content"
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner size="medium" :compact="true" />
          <h2 class="text-h5">Loading your invitation...</h2>
        </div>

        <template v-else>
          <div
            class="state-content"
            :data-testid="`state-${state}`"
            role="alert"
            aria-live="assertive"
          >
            <div
              class="state-icon"
              style="background-color: var(--error-100); color: var(--error-600)"
            >
              <Icon name="CircleX" />
            </div>
            <h2 v-if="state === 'expired'" class="text-h5">This invitation has expired</h2>
            <h2 v-else-if="state === 'used'" class="text-h5">This invitation was already used</h2>
            <h2 v-else-if="state === 'invalid'" class="text-h5">Invitation not found</h2>
            <h2 v-else class="text-h5">Something went wrong</h2>
            <p v-if="state === 'serverError'">We couldn't reach the server. Please try again.</p>
            <p v-else>Ask the person who invited you to send a new link.</p>
          </div>
          <div class="actions">
            <Button
              v-if="state === 'serverError'"
              data-testid="cta-retry"
              kind="primary"
              block
              text="Try again"
              @click="load"
            />
            <Button
              data-testid="cta-signin"
              :kind="state === 'serverError' ? 'secondary' : 'primary'"
              block
              text="Go to sign in"
              @click="router.push('/login')"
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
