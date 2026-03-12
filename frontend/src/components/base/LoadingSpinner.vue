<template>
  <div class="loading-container" :class="{ compact }">
    <div class="spinner-wrapper">
      <div class="spinner" :class="size"></div>
      <div v-if="!compact && message" class="loading-message">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup>
  defineProps({
    /**
     * Loading message to display below spinner
     */
    message: { type: String, default: "Loading..." },

    /**
     * Size of the spinner
     * @values 'small', 'medium', 'large'
     */
    size: { type: String, default: "medium" },

    /**
     * Compact mode - no message, smaller container
     */
    compact: { type: Boolean, default: false },
  });
</script>

<style scoped>
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    min-height: 120px;
  }

  .loading-container.compact {
    padding: 16px;
    min-height: 60px;
  }

  .spinner-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .spinner {
    border: 3px solid var(--border-primary);
    border-top: 3px solid var(--border-action);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 20px;
    height: 20px;
    border-width: 2px;
  }

  .spinner.medium {
    width: 32px;
    height: 32px;
  }

  .spinner.large {
    width: 48px;
    height: 48px;
    border-width: 4px;
  }

  .loading-message {
    color: var(--text-subtle);
    font-size: 14px;
    text-align: center;
    max-width: 200px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Optional: fade-in animation for smoother appearance */
  .loading-container {
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
