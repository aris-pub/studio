<script setup>
  import { ref, inject, computed, onMounted, nextTick } from "vue";
  import { useRouter, RouterLink } from "vue-router";
  import { createFileStore } from "@/store/FileStore.js";
  import AuthLayout from "@/components/layout/AuthLayout.vue";
  import PasswordInput from "@/components/forms/PasswordInput.vue";

  const router = useRouter();
  const email = ref("");
  const password = ref("");
  const isLoading = ref(false);
  const error = ref("");
  const api = inject("api");
  const user = inject("user");
  const fileStore = inject("fileStore");

  const loadingAnnouncement = computed(() => (isLoading.value ? "Logging in\u2026" : ""));

  const isDev = inject("isDev");
  const loginButton = ref(null);
  const emailPlaceholder = computed(() =>
    isDev ? import.meta.env.VITE_DEV_LOGIN_EMAIL || "" : ""
  );
  const passwordPlaceholder = computed(() =>
    isDev ? import.meta.env.VITE_DEV_LOGIN_PASSWORD || "" : ""
  );

  onMounted(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (token && storedUser) {
      if (!user.value) user.value = storedUser;
      router.push("/");
      return;
    }

    if (isDev) {
      email.value = emailPlaceholder.value;
      password.value = passwordPlaceholder.value;
      nextTick(() => {
        const btn = loginButton.value;
        (btn?.$el ?? btn)?.focus();
      });
    }
  });

  const onLogin = async () => {
    error.value = "";
    if (!email.value || !password.value) {
      error.value = "Please fill in all fields.";
      return;
    }

    isLoading.value = true;
    try {
      const response = await api.post("/login", {
        email: email.value,
        password: password.value,
      });
      localStorage.setItem("accessToken", response.data.access_token);
      localStorage.setItem("refreshToken", response.data.refresh_token);

      const userData = await api.get("/me");
      user.value = userData.data;
      localStorage.setItem("user", JSON.stringify(userData.data));
      fileStore.value = createFileStore(api, user.value);
      await fileStore.value.loadFiles();
      await fileStore.value.loadTags();

      router.push("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        error.value = detail.map((e) => e.msg).join(". ");
      } else if (detail) {
        error.value = detail;
      } else {
        error.value = err.message || "Login failed";
      }
    } finally {
      isLoading.value = false;
    }
  };
</script>

<template>
  <AuthLayout
    heading="Sign in"
    subheading="Welcome back to RSM Studio"
    :error="error"
    @submit="onLogin"
  >
    <InputText
      v-model="email"
      data-testid="email-input"
      direction="column"
      label="Email"
      type="email"
      autocomplete="email"
      required
    />
    <PasswordInput
      v-model="password"
      data-testid="password-input"
      autocomplete="current-password"
      required
    />

    <template #actions>
      <span data-testid="login-status" class="sr-only" role="status" aria-live="polite">{{
        loadingAnnouncement
      }}</span>
      <Button
        ref="loginButton"
        data-testid="login-button"
        type="submit"
        kind="primary"
        block
        :text="isLoading ? 'Logging in...' : 'Sign in'"
        :disabled="isLoading"
      />
    </template>

    <template #footer>
      <div class="form-footer text-caption">
        New to Studio?
        <RouterLink
          data-testid="register-link"
          to="/register"
          class="register-link"
        >Create an account</RouterLink>
      </div>
    </template>
  </AuthLayout>
</template>

<style scoped>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .form-footer {
    text-align: center;
    color: var(--gray-600);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .register-link {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
  }

  .register-link:hover {
    text-decoration: underline;
  }
</style>
