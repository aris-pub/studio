<script setup>
  /**
   * Separator - A simple horizontal line component for visual separation.
   *
   * This component renders a thin horizontal line, commonly used to divide sections
   * of content, menu items, or form elements, enhancing readability and UI organization.
   *
   * @displayName Separator
   * @example
   * // Basic usage to separate text blocks
   * <p>First section of content.</p>
   * <Separator />
   * <p>Second section of content.</p>
   *
   * @example
   * // Within a menu or list to group items
   * <div>
   *   <button>Option 1</button>
   *   <button>Option 2</n   *   <Separator />
   *   <button>Option 3</button>
   * </div>
   */
</script>

<template>
  <div class="sep"></div>
</template>

<style scoped>
  .sep {
    border-bottom: var(--border-thin) solid var(--gray-200);
  }
</style>
