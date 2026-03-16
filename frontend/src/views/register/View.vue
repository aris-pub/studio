<script setup>
  import { ref, computed, inject, onMounted } from "vue";
  import { useRouter } from "vue-router";
  import { toast } from "@/utils/toast";
  import AuthLayout from "@/components/layout/AuthLayout.vue";
  import PasswordInput from "@/components/forms/PasswordInput.vue";
  import PasswordStrength from "@/components/ui/PasswordStrength.vue";

  const router = useRouter();
  const name = ref("");
  const email = ref("");
  const pwd = ref("");
  const error = ref("");
  const isLoading = ref(false);

  const api = inject("api");
  const user = inject("user");

  const derivedInitials = computed(() => {
    return name.value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .join("")
      .slice(0, 3);
  });

  onMounted(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (token && storedUser) {
      if (!user.value) user.value = storedUser;
      router.push("/");
    }
  });

  const onRegister = async () => {
    error.value = "";
    if (!name.value || !email.value || !pwd.value) {
      error.value = "Please fill in all fields.";
      return;
    }
    if (pwd.value.length < 8) {
      error.value = "Password must be at least 8 characters.";
      return;
    }

    isLoading.value = true;
    try {
      const response = await api.post("/register", {
        name: name.value,
        email: email.value,
        password: pwd.value,
        initials: derivedInitials.value,
      });

      const { access_token, refresh_token, user: registeredUser } = response.data;
      localStorage.setItem("accessToken", access_token);
      localStorage.setItem("refreshToken", refresh_token);
      localStorage.setItem("user", JSON.stringify(registeredUser));
      user.value = registeredUser;
      toast.info("Check your inbox", {
        description: `We sent a verification link to ${email.value}. The link expires in 24 hours.`,
        duration: 0,
        dismissible: true,
      });
      router.push("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        error.value = detail.map((e) => e.msg).join(". ");
      } else if (detail) {
        error.value = detail;
      } else {
        error.value = "Registration failed. Please try again.";
      }
    } finally {
      isLoading.value = false;
    }
  };
</script>

<template>
  <AuthLayout
    heading="Create your account"
    subheading="Start writing web-native research"
    :error="error"
    @submit="onRegister"
  >
    <InputText
      v-model="name"
      data-testid="name-input"
      direction="column"
      label="Display name"
      required
    />
    <InputText
      v-model="email"
      data-testid="email-input"
      direction="column"
      label="Email"
      type="email"
      required
    />
    <div>
      <PasswordInput v-model="pwd" data-testid="password-input" required />
      <PasswordStrength :password="pwd" />
    </div>

    <template #actions>
      <Button
        data-testid="register-button"
        kind="primary"
        block
        :text="isLoading ? 'Creating account...' : 'Create account'"
        :disabled="isLoading"
        @click="onRegister"
      />
    </template>

    <template #footer>
      <div class="form-legal text-caption">
        By creating an account, you agree to our
        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service<span class="sr-only">(opens in new tab)</span></a> and
        <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy<span class="sr-only">(opens in new tab)</span></a>.
      </div>
      <div class="form-footer text-caption">
        Already have an account?
        <Button
          data-testid="login-link"
          type="button"
          kind="secondary"
          size="xs"
          text="Sign in"
          @click="router.push('/login')"
        />
      </div>
    </template>
  </AuthLayout>
</template>

<style scoped>
  .form-legal {
    text-align: center;
    line-height: 1.5;
    color: var(--gray-500);
  }

  .form-legal a {
    color: var(--gray-700);
    text-decoration: underline;
  }

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
</style>
