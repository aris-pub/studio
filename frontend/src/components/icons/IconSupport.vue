<script setup>
  /**
   * IconSupport - A custom SVG icon component representing support or help.
   *
   * This component renders a static SVG graphic that visually represents support, often
   * depicted as a heart or a similar caring symbol. It's designed to be used as a standalone icon
   * or integrated within other components that require a support-related symbol.
   *
   * @displayName IconSupport
   * @example
   * // Basic usage
   * <IconSupport />
   *
   * @example
   * // With custom sizing and color
   * <IconSupport class="w-8 h-8 text-red-500" />
   *
   * @example
   * // Used in a help or support section
   * <button>
   *   <IconSupport class="mr-2" />
   *   Get Support
   * </button>
   */
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor">
    <path
      d="M10 3.22l-.61-.6a5.5 5.5 0 0 0-7.666.105 5.5 5.5 0 0 0-.114 7.665L10 18.78l8.39-8.4a5.5 5.5 0 0 0-.114-7.665 5.5 5.5 0 0 0-7.666-.105l-.61.61z"
    />
  </svg>
</template>
