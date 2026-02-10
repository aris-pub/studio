<script setup>
  /**
   * Pane - A versatile container component for organizing UI content.
   *
   * This component provides a styled panel or section with optional header and main content areas.
   * It automatically wraps header content with a `Header` component unless `customHeader` is true.
   * The pane adapts its styling based on `mobileMode` for responsive layouts.
   *
   * @displayName Pane
   * @example
   * // Basic usage with a simple title
   * <Pane>
   *   <template #header>My Panel Title</template>
   *   <p>This is the content of the panel.</p>
   * </Pane>
   *
   * @example
   * // With a custom header (no automatic Header component wrapping)
   * <Pane :custom-header="true">
   *   <template #header>
   *     <div style="display: flex; justify-content: space-between; align-items: center;">
   *       <h2>Custom Header</h2>
   *       <Button icon="Settings" />
   *     </div>
   *   </template>
   *   <p>Content with a custom header layout.</p>
   * </Pane>
   *
   * @example
   * // Pane in mobile mode (styling adapts)
   * <Pane :mobile-mode="true">
   *   <template #header>Mobile Panel</template>
   *   <p>This panel is optimized for mobile screens.</p>
   * </Pane>
   */
  import { inject } from "vue";

  const props = defineProps({
    customHeader: { type: Boolean, default: false },
  });
  const mobileMode = inject("mobileMode");
</script>

<template>
  <div class="pane" :class="{ mobile: mobileMode }">
    <div v-if="$slots.header">
      <template v-if="customHeader">
        <slot name="header" />
      </template>
      <template v-else>
        <Header class="text-h4">
          <slot name="header" />
        </Header>
      </template>
    </div>
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
  .pane {
    padding-top: 16px;
    background-color: var(--surface-primary);
    width: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    box-shadow: var(--shadow-soft);
    min-height: 0;
    flex: 1;
  }

  .pane.mobile {
    border-radius: 0px;
    padding-block: 8px;
  }

  .pane > * {
    padding-inline: 16px;
  }

  .pane.mobile > * {
    padding-inline: 8px;
  }

  .pane-header {
    height: 48px;
    display: flex;
    justify-content: flex-start;
    align-items: center;
  }

  .pane-header > .title {
    margin-left: 4px;
  }

  .content:not(:first-child) {
    padding-top: 16px;
  }

  .content {
    overflow-x: auto;
    overflow-y: auto;
    padding-bottom: 16px;
    flex: 1;
    min-height: 0;
  }

  .content :deep(.section:last-child) {
    margin-bottom: 0px;
  }
</style>
