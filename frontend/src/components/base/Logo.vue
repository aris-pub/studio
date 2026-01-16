<template>
  <div :class="logoClass">
    <img :src="logomarkUrl" :alt="alt" class="logo__mark" />
    <span v-if="props.type === 'full'" class="logo__text">Studio</span>
  </div>
</template>

<script setup>
  import { computed, inject } from "vue";

  const props = defineProps({
    type: {
      type: String,
      default: "small", // "small", "full", "gray"
      validator: (value) => ["small", "full", "gray"].includes(value),
    },
    alt: {
      type: String,
      default: "Aris logo",
    },
    class: {
      type: String,
      default: "",
    },
  });

  const api = inject("api");

  const logomarkUrl = computed(() => {
    const base = api.defaults.baseURL;
    // Always use the logomark, never the combined logotype
    return `${base}/brand/logos/studio/studio-logo-64.svg`;
  });

  const logoClass = computed(() => {
    return `logo logo--${props.type} ${props.class}`.trim();
  });
</script>

<style scoped>
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-block: 20px;
  }

  .logo__mark {
    display: block;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .logo__text {
    font-family: "Montserrat", sans-serif;
    font-size: 32px;
    font-weight: var(--weight-regular);
    color: var(--text-default);
    white-space: nowrap;
  }

  .logo--small {
    /* Just the logomark, no text */
  }

  .logo--full {
    /* Logomark + text with gap */
  }

  .logo--gray .logo__mark {
    /* Could add grayscale filter if needed */
  }
</style>
