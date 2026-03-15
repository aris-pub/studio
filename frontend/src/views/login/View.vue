<script setup>
  import { ref, inject, computed, onMounted, nextTick } from "vue";
  import { useRouter } from "vue-router";
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
    isLoading.value = true;
    error.value = "";
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
      error.value = err.response?.data?.detail || err.message || "Login failed";
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
      required
    />
    <PasswordInput v-model="password" data-testid="password-input" required />

    <template #actions>
      <Button
        ref="loginButton"
        data-testid="login-button"
        kind="primary"
        block
        :text="isLoading ? 'Logging in...' : 'Sign in'"
        :disabled="isLoading"
        @click="onLogin"
      />
    </template>

    <template #footer>
      <div class="form-footer text-caption">
        New to Studio?
        <Button
          data-testid="register-link"
          type="button"
          kind="secondary"
          size="xs"
          text="Create an account"
          @click="router.push('/register')"
        />
      </div>
    </template>
  </AuthLayout>
</template>

<style scoped>
  .form-footer {
    text-align: center;
    color: var(--gray-600);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
</style>
