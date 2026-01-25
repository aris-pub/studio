<template>
  <button
    class="theme-toggle"
    data-testid="dark-mode-toggle"
    :aria-label="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
    :disabled="!isHydrated"
    @click="toggleDarkMode"
  >
    <div class="toggle-icon-container">
      <!-- Sun Icon (Light Mode) -->
      <svg
        class="toggle-icon sun-icon"
        :class="{ visible: !isDarkMode && isHydrated }"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" />
        <path
          d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        />
      </svg>

      <!-- Moon Icon (Dark Mode) -->
      <svg
        class="toggle-icon moon-icon"
        :class="{ visible: isDarkMode && isHydrated }"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>

      <!-- Loading placeholder (SSR/before hydration) -->
      <div v-if="!isHydrated" class="toggle-loading" aria-hidden="true">
        <div class="loading-placeholder"></div>
      </div>
    </div>
  </button>
</template>

<script setup>
  import { useDarkMode } from "~/composables/useDarkMode";

  const { isDarkMode, isHydrated, toggleDarkMode } = useDarkMode();
</script>

<style scoped>
  .theme-toggle {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 8px;
    background: var(--surface-page);
    color: var(--text-body);
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      transform 0.1s ease;
    outline: none;
  }

  .theme-toggle:hover {
    background: var(--surface-hover);
    border-color: var(--border-action);
    transform: translateY(-1px);
  }

  .theme-toggle:focus-visible {
    outline: var(--border-med) solid var(--border-action);
    outline-offset: var(--border-extrathin);
  }

  .theme-toggle:active {
    transform: translateY(0);
  }

  .theme-toggle:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .toggle-icon-container {
    position: relative;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
    color: var(--text-body);
  }

  .toggle-icon.visible {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  .sun-icon {
    color: var(--text-body);
  }

  .moon-icon {
    color: var(--text-body);
  }

  .toggle-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .loading-placeholder {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--border-primary);
    opacity: 0.5;
  }

  /* Dark theme overrides */
  :global(.dark-theme) .sun-icon {
    color: var(--text-body);
  }

  :global(.dark-theme) .moon-icon {
    color: var(--text-body);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .theme-toggle {
      width: 44px;
      height: 44px;
    }

    .toggle-icon-container {
      width: 22px;
      height: 22px;
    }

    .toggle-icon {
      width: 22px;
      height: 22px;
    }
  }

  /* Animation for theme switching */
  .theme-toggle:not(:disabled):active .toggle-icon {
    transform: translate(-50%, -50%) scale(0.9);
  }

  /* Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    .toggle-icon {
      transition: opacity 0.1s ease;
    }

    .theme-toggle {
      transition:
        background-color 0.1s ease,
        border-color 0.1s ease;
    }
  }
</style>
