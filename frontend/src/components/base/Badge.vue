<script setup>
  defineOptions({
    name: "Badge",
  });

  defineProps({
    variant: {
      type: String,
      default: "neutral",
      validator: (v) => ["neutral", "info", "success", "warning", "danger"].includes(v),
    },
    size: {
      type: String,
      default: "sm",
      validator: (v) => ["xs", "sm"].includes(v),
    },
  });
</script>

<template>
  <span class="badge" :class="[variant, `badge-${size}`]">
    <slot />
  </span>
</template>

<style scoped>
  .badge {
    display: inline-flex;
    align-items: center;
    border-radius: 9999px;
    font-weight: var(--weight-medium);
    line-height: 1;
    white-space: nowrap;
    border: none;
    user-select: none;
  }

  .badge-sm {
    font-size: 12px;
    padding: 3px 8px;
  }

  .badge-xs {
    font-size: 10px;
    padding: 1px 5px;
  }

  /* ── Variants ── */
  .neutral {
    background: var(--gray-100);
    color: var(--gray-800);
  }

  .info {
    background: var(--blue-100);
    color: var(--blue-800);
  }

  .success {
    background: var(--green-100);
    color: var(--green-800);
  }

  .warning {
    background: var(--orange-100);
    color: var(--orange-800);
  }

  .danger {
    background: var(--red-100);
    color: var(--red-800);
  }
</style>
