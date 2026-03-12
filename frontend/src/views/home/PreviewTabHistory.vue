<script setup></script>

<template>
  <div class="empty-tab">
    <Icon name="History" class="empty-icon" />
    <span>Coming soon</span>
  </div>
</template>

<style scoped>
  .empty-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 16px;
    color: var(--text-subtle);
    font-size: 13px;
  }

  .empty-icon {
    opacity: 0.4;
  }
</style>
