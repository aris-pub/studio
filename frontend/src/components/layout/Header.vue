<script setup>
  /**
   * Header - A generic header component for panels or sections.
   *
   * This component provides a styled container for header content, typically used within
   * `Pane` components or other sections of the UI. It uses a default slot to render
   * any content passed into it.
   *
   * @displayName Header
   * @example
   * // Basic usage with a title
   * <Header><h2>Section Title</h2></Header>
   *
   * @example
   * // With a title and a button
   * <Header>
   *   <h2>My Panel</h2>
   *   <Button icon="Settings" />
   * </Header>
   *
   * @example
   * // Used within a Pane component
   * <Pane>
   *   <template #header>
   *     <Header><h3>Pane Header</h3></Header>
   *   </template>
   *   <!-- ... pane content ... -->
   * </Pane>
   */
  import {} from "vue";
</script>

<template>
  <div class="pane-header">
    <slot />
  </div>
</template>

<style>
  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: var(--border-extrathin) solid var(--border-primary);
    background-color: var(--surface-hover);
    height: 48px;
    border-radius: 8px;
    padding-inline: 8px;
  }
</style>
