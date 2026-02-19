<script setup>
  import { ref, inject, onMounted } from "vue";
  import { useRouter } from "vue-router";
  import { toast } from "@/utils/toast";

  const router = useRouter();
  const name = ref("");
  const email = ref("");
  const pwd = ref("");
  const pwdAgain = ref("");
  const error = ref("");

  const api = inject("api");
  const user = inject("user");

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
    if (!name.value || !email.value || !pwd.value || !pwdAgain.value) {
      error.value = "Please fill in all fields.";
      return;
    }
    if (pwd.value !== pwdAgain.value) {
      error.value = "Passwords do not match.";
      return;
    }

    try {
      const response = await api.post("/register", {
        name: name.value,
        email: email.value,
        password: pwd.value,
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
      if (err.response?.data?.message) {
        error.value = err.response.data.message;
      } else {
        error.value = "Registration failed. Please try again.";
      }
    }
  };
</script>

<template>
  <div class="view">
    <!-- <div class="left">
         <div class="logo"></div>
         <div class="tagline">
         <p>Scientific publishing.</p>
         <p>Web-native. Human-first</p>
         </div>
         </div> -->
    <div class="right">
      <div class="wrapper">
        <div class="top">
          <InputText v-model="name" data-testid="name-input" direction="column" label="Full name" />
          <InputText v-model="email" data-testid="email-input" direction="column" label="Email" />
          <InputText
            v-model="pwd"
            data-testid="password-input"
            direction="column"
            label="Password"
            type="password"
          />
          <InputText
            v-model="pwdAgain"
            data-testid="confirm-password-input"
            direction="column"
            label="Confirm password"
            type="password"
          />
        </div>
        <div class="bottom">
          <div v-if="error" data-testid="registration-error" class="error-message">{{ error }}</div>
          <Button
            data-testid="register-button"
            kind="primary"
            text="Register"
            @click="onRegister"
          />
          <div class="footer text-caption">
            <p>
              Already registered?
              <span
                data-testid="login-link"
                style="cursor: pointer; text-decoration: underline"
                @click="router.push('/login')"
              >
                Login here.
              </span>
            </p>
          </div>
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

    & > * {
      width: 100%;
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

  .right .bottom button {
    width: 100%;

    & :deep(.btn-text) {
      margin: 0 auto;
    }
  }

  .input-text :deep(label) {
    padding-left: 8px;
  }

  .input-text :deep(input) {
    width: 100%;
  }
</style>
