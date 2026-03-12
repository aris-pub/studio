<script setup>
  /**
   * TabPage - Content container for individual tab pages
   *
   * A simple wrapper component that contains the content for a single tab page.
   * Usually used within a Tabs component to organize tab content.
   *
   * @displayName TabPage
   * @example
   * // Basic usage
   * <TabPage>
   *   <h2>Tab Content</h2>
   *   <p>This is the content of the tab.</p>
   * </TabPage>
   *
   * @example
   * // With complex content
   * <TabPage>
   *   <div class="dashboard">
   *     <Widget />
   *     <Chart />
   *   </div>
   * </TabPage>
   */
</script>

<template>
  <div class="tab-page-wrapper">
    <slot />
  </div>
</template>

<style>
  .tab-page-wrapper {
    width: 100%;
    height: 100%;
  }
</style>
