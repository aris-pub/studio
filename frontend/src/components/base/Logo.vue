<template>
  <div :class="logoClass">
    <img :src="logomarkUrl" :alt="alt" class="logo__mark" />
    <span v-if="props.type === 'full'" class="logo__text">S</span>
  </div>
</template>

<script setup>
  import { computed } from "vue";

  const props = defineProps({
    type: {
      type: String,
      default: "small", // "small", "full", "gray"
      validator: (value) => ["small", "full", "gray"].includes(value),
    },
    alt: {
      type: String,
      default: "RSM Studio logo",
    },
    class: {
      type: String,
      default: "",
    },
  });

  // Brand assets load from one canonical BRAND_BASE_URL, not from the backend
  // origin: the API scales to zero, so the logo must not depend on it being awake.
  // Default to a commit-pinned public jsDelivr URL over the aris-pub/brand repo so
  // a logo change is a deliberate pin bump, never an unreviewed auto-swap. Override
  // with VITE_BRAND_BASE_URL (e.g. a brand.aris.pub host) at build time.
  const BRAND_BASE_URL =
    import.meta.env.VITE_BRAND_BASE_URL ||
    "https://cdn.jsdelivr.net/gh/aris-pub/brand@d64fba720fa2eaef0b8a07d648d7e1c926e818e3/logos";
  // Always use the logomark, never the combined logotype
  const logomarkUrl = `${BRAND_BASE_URL}/studio/studio-logo-64.svg`;

  const logoClass = computed(() => {
    return `logo logo--${props.type} ${props.class}`.trim();
  });
</script>

<style scoped>
  .logo {
    display: flex;
    align-items: center;
    gap: 0;
    margin-block: 16px 6px;
  }

  .logo__mark {
    display: block;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .logo__text {
    font-family: "Crimson Pro", serif;
    font-size: 40px;
    font-weight: var(--weight-semi);
    line-height: 1.2;
    color: var(--gray-800);
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
