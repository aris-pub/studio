<script setup>
  defineOptions({ name: "AuthLayout" });

  defineProps({
    heading: { type: String, required: true },
    subheading: { type: String, default: "" },
    error: { type: String, default: "" },
  });

  defineEmits(["submit"]);
</script>

<template>
  <div class="view">
    <div class="brand-panel">
      <Logo type="full" />
      <p class="brand-tagline">
        Scientific publishing.<br />
        <strong>Web-native. Human-first.</strong>
      </p>
    </div>
    <main class="form-panel">
      <div class="mobile-logo">
        <Logo type="full" />
      </div>
      <form class="form-card" @submit.prevent="$emit('submit')">
        <h1 class="form-heading">{{ heading }}</h1>
        <p v-if="subheading" class="form-subheading text-caption">{{ subheading }}</p>

        <div class="fields">
          <slot />
        </div>

        <div class="actions">
          <div
            v-if="error"
            data-testid="auth-error"
            class="error-alert"
            role="alert"
            aria-live="assertive"
          >
            {{ error }}
          </div>
          <slot name="actions" />
          <slot name="footer" />
        </div>
      </form>
    </main>
  </div>
</template>

<style scoped>
  .view {
    display: flex;
    height: 100%;
    width: 100%;
  }

  .brand-panel {
    width: 45%;
    background: linear-gradient(160deg, var(--information-50) 0%, var(--primary-200) 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .brand-tagline {
    font-size: 18px;
    color: var(--gray-800);
    text-align: center;
    line-height: 1.5;
    max-width: 240px;
  }

  .form-panel {
    flex: 1;
    background: var(--gray-75);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  .form-card {
    background: var(--white);
    border: 1px solid var(--gray-200);
    border-radius: 16px;
    padding: 36px 28px 28px;
    width: 100%;
    max-width: 380px;
    box-shadow: var(--shadow-soft);
  }

  .form-heading {
    font-family: "Montserrat", sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--gray-950);
    margin: 0 0 4px;
  }

  .form-subheading {
    color: var(--gray-600);
    margin: 0 0 24px;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 24px;
  }

  .error-alert {
    background-color: var(--error-50);
    border: 1px solid var(--error-200);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--error-600);
  }

  .input-text :deep(label) {
    padding-left: 8px;
  }

  .mobile-logo {
    display: none;
  }

  @media (max-width: 768px) {
    .brand-panel {
      display: none;
    }

    .form-panel {
      flex-direction: column;
      padding: 24px 20px;
    }

    .mobile-logo {
      display: block;
      margin-bottom: 24px;
    }
  }
</style>
