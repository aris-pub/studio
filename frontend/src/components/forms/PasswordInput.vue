<script setup>
  import { ref } from "vue";

  defineOptions({
    name: "PasswordInput",
    inheritAttrs: false,
  });

  defineProps({
    label: { type: String, default: "Password" },
  });

  const model = defineModel({ type: String });
  const showPassword = ref(false);
</script>

<template>
  <div class="password-field">
    <InputText
      v-model="model"
      v-bind="$attrs"
      direction="column"
      :label="label"
      :type="showPassword ? 'text' : 'password'"
    />
    <button
      type="button"
      data-testid="toggle-password"
      class="toggle-password"
      @click="showPassword = !showPassword"
    >
      {{ showPassword ? "Hide" : "Show" }}
    </button>
  </div>
</template>

<style scoped>
  .password-field {
    position: relative;
  }

  .toggle-password {
    position: absolute;
    right: 12px;
    bottom: 0;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    font-size: 13px;
    color: var(--gray-600);
    cursor: pointer;
    padding: 10px 4px;
    font-family: inherit;
  }

  .toggle-password:hover {
    color: var(--gray-900);
  }
</style>
