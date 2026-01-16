<template>
  <img :src="logoUrl" :alt="alt" :class="logoClass" />
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

  const logoUrl = computed(() => {
    const base = api.defaults.baseURL;
    switch (props.type) {
      case "full":
        return `${base}/brand/logos/studio/logotype.svg`;
      case "gray":
        return `${base}/brand/logos/studio/logo-32px-gray.svg`;
      case "small":
      default:
        return `${base}/brand/logos/studio/logo-32px.svg`;
    }
  });

  const logoClass = computed(() => {
    return `logo logo--${props.type} ${props.class}`.trim();
  });
</script>

<style scoped>
  .logo {
    display: block;
  }

  .logo--small {
    width: 32px;
    height: 32px;
  }

  .logo--full {
    height: 32px;
    width: auto;
  }

  .logo--gray {
    width: 32px;
    height: 32px;
  }
</style>
