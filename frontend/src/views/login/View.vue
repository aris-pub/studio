<script setup>
  import { ref, inject, computed, onMounted, nextTick } from "vue";
  import { useRouter } from "vue-router";
  import { createFileStore } from "@/store/FileStore.js";

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
  <div class="view" @keydown.enter="onLogin">
    <div class="right">
      <div class="wrapper">
        <div class="top">
          <div class="text-input">
            <label class="text-label">Email</label>
            <input v-model="email" data-testid="email-input" type="email" required />
          </div>
          <div class="text-input">
            <label class="text-label">Password</label>
            <input v-model="password" data-testid="password-input" type="password" required />
            <div class="footer text-caption"><p>Forgot password?</p></div>
          </div>
        </div>
        <div class="bottom">
          <div v-if="error" data-testid="login-error" class="error-message">{{ error }}</div>
          <div v-if="isLoading" data-testid="login-loading" class="loading-indicator">
            Logging in...
          </div>
          <Button
            ref="loginButton"
            data-testid="login-button"
            kind="primary"
            block
            :text="isLoading ? 'Logging in...' : 'Login'"
            :disabled="isLoading"
            @click="onLogin"
          />
          <Button
            data-testid="register-link"
            kind="secondary"
            block
            text="Register"
            @click="router.push('/register')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .view {
    --transition-duration: 0.3s;

    display: flex;
    flex-grow: 2;
    height: 100%;
    width: 100%;
  }

  .left {
    background-color: var(--information-50);
    height: 100%;
    width: 50%;
  }

  .right {
    background-color: var(--surface-primary);
    height: 100%;
    /* width: 50%; */
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
    padding: 16px;

    & > * {
      width: 100%;
    }
  }

  @media (max-width: 640px) {
    .right .wrapper {
      width: 90%;
      padding: 20px;
      gap: 24px;
    }
  }

  .right .wrapper .top {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .right .bottom {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  @media (max-width: 640px) {
    .right .bottom {
      gap: 20px;
    }
  }

  .text-input {
    display: flex;
    flex-direction: column;
  }

  .text-input label {
    padding-left: 8px;
  }

  .text-input input {
    height: 36px;
    background-color: transparent;
    border-radius: 12px;
    border: var(--border-thin) solid var(--border-primary);
    padding-inline: 8px;
  }

  .text-input input:focus-visible {
    background-color: var(--white);
    border-color: var(--border-action);
  }

  .text-input .footer {
    margin-top: 4px;
    padding-left: 8px;
  }
</style>
