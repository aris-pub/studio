<script setup>
  /**
   * Tab - Individual tab button component
   *
   * A single tab button that can be clicked to activate. Usually used within a Tabs component.
   * Supports keyboard navigation and follows accessibility best practices.
   *
   * @displayName Tab
   * @example
   * // Basic usage
   * <Tab v-model="isActive" label="Dashboard" icon="Home" />
   *
   * @example
   * // Icon only tab
   * <Tab v-model="isActive" icon="Settings" />
   */

  const props = defineProps({
    /**
     * The text label displayed in the tab
     */
    label: { type: String, default: "" },
    /**
     * Icon name to display in the tab (from Tabler icons)
     * @values "Home", "Settings", "User", "File", "Search"
     */
    icon: { type: String, default: "" },
  });

  /**
   * Whether this tab is currently active
   */
  const active = defineModel({ type: Boolean, default: false });
</script>

<template>
  <button
    type="button"
    role="tab"
    :aria-selected="active"
    class="tab-wrapper"
    :class="{ active }"
    tabindex="0"
    @click="active = true"
    @keydown.enter.prevent="active = true"
    @keydown.space.prevent="active = true"
  >
    <Icon :name="icon" class="tab-icon" />
    <span class="tab-label text-caption">{{ label }}</span>
  </button>
</template>

<style>
  /* reset default button styles */
  .tab-wrapper {
    background: transparent;
    border: none;
    font: inherit;
    padding: 0;
    margin: 0;
    cursor: pointer;
    --transition-duration: 0.3s;

    height: calc(48px - var(--border-extrathin));
    width: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 auto;
    color: var(--gray-800);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;

    border-bottom: var(--border-thin) solid transparent;
    transition:
      background-color var(--transition-duration) ease,
      box-shadow var(--transition-duration) ease,
      border-bottom-color var(--transition-duration) ease;

    & .tabler-icon {
      color: var(--gray-800);
    }
    &:focus-visible {
      outline: var(--border-med) solid var(--border-action);
      outline-offset: var(--border-extrathin);
    }
  }

  .tab-wrapper:not(.active):hover {
    color: var(--almost-black);
    & .tabler-icon {
      color: var(--almost-black);
    }
    cursor: pointer;
    box-shadow: var(--shadow-soft);
  }

  .tab-wrapper.active {
    color: var(--almost-black);
    background-color: var(--information-100);
    box-shadow: var(--shadow-strong);
    border-bottom-color: var(--border-action);
    & .tabler-icon {
      color: var(--almost-black);
    }
  }

  .tab-wrapper .tabler-icon {
    margin-top: 6px;
    margin-bottom: 2px;
    stroke-width: 2px;
  }

  .tab-label {
    font-weight: var(--weight-medium) !important;
  }
</style>
