<script setup>
  /**
   * IconTherefore - A custom SVG icon component for the "therefore" symbol.
   *
   * This component renders a static SVG graphic representing the mathematical "therefore" symbol (∴).
   * It's designed to be used as a standalone icon or integrated within other components that require this specific symbol.
   *
   * @displayName IconTherefore
   * @example
   * // Basic usage
   * <IconTherefore />
   *
   * @example
   * // With custom CSS classes for sizing and coloring
   * <IconTherefore class="w-8 h-8 text-blue-500" />
   *
   * @example
   * // Used within another component (e.g., a button or a list item)
   * <button>
   *   <IconTherefore class="mr-2" />
   *   Reasoning
   * </button>
   */
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="$attrs.class"
    :style="$attrs.style"
    role="img"
    aria-label="Therefore symbol"
  >
    <rect x="10.25" y="4.75" width="3.5" height="3.5" rx="1" ry="1" fill="currentColor" />
    <rect x="5.25" y="14.75" width="3.5" height="3.5" rx="1" ry="1" fill="currentColor" />
    <rect x="14.75" y="14.75" width="3.5" height="3.5" rx="1" ry="1" fill="currentColor" />
  </svg>
</template>
