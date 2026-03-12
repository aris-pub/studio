<script setup>
  /**
   * HSeparator - A simple horizontal separator component.
   *
   * This component renders a thin vertical line, typically used to visually separate
   * elements in a horizontal layout, such as items in a toolbar or navigation menu.
   *
   * @displayName HSeparator
   * @example
   * // Basic usage within a flex container
   * <div style="display: flex; align-items: center;">
   *   <span>Item 1</span>
   *   <HSeparator />
   *   <span>Item 2</span>
   *   <HSeparator />
   *   <span>Item 3</span>
   * </div>
   */
</script>

<template>
  <div class="h-sep"></div>
</template>

<style scoped>
  .h-sep {
    border-right: var(--border-thin) solid var(--gray-200);
  }
</style>
