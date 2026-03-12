<script setup></script>

<template>
  <Pane>
    <template #header>
      <Icon name="Activity" />
      <h3>Activity</h3>
    </template>
    <div class="empty-state">
      <Icon name="Activity" class="empty-icon" />
      <span>Coming soon</span>
    </div>
  </Pane>
</template>

<style scoped>
  .empty-state {
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
