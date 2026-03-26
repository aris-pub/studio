<script setup>
  /**
   * ButtonDots - A toggle button component displaying vertical dots.
   *
   * This component is a specialized toggle button that renders three vertical dots.
   * It's typically used to indicate the presence of a context menu or more options.
   * It inherits toggle functionality from `ButtonToggle` and allows customization of hover and active colors.
   *
   * @displayName ButtonDots
   * @example
   * // Basic usage (default colors)
   * <ButtonDots v-model="isActive" />
   *
   * @example
   * // With custom colors
   * <ButtonDots v-model="isActive" hover-color="var(--blue-200)" active-color="var(--blue-500)" />
   *
   * @example
   * // Used to trigger a context menu
   * <ContextMenu>
   *   <template #trigger>
   *     <ButtonDots v-model="isMenuOpen" />
   *   </template>
   *   <!-- Context menu items -->
   * </ContextMenu>
   */
  import { watch } from "vue";
  import ButtonToggle from "@/components/base/ButtonToggle.vue";
  import { IconDotsVertical } from "@/components/base/iconRegistry.js";

  defineOptions({
    name: "ButtonDots",
  });

  const props = defineProps({
    hoverColor: { type: String, default: "var(--surface-hint)" },
    activeColor: { type: String, default: "var(--surface-hint)" },
  });
  const active = defineModel({ type: Boolean });
  const emit = defineEmits(["on", "off"]);

  watch(active, (newValue) => (newValue ? emit("on") : emit("off")));
</script>

<template>
  <ButtonToggle v-model="active" :hover-color="hoverColor" :active-color="activeColor">
    <!--
      CRITICAL: IconDotsVertical sizing and positioning

      These specific width, height, and viewBox values are REQUIRED for proper dot visibility.
      DO NOT change to generic size prop - it causes dots to be cropped/positioned incorrectly.

      Values explained:
      - width="4": Narrow width to fit compact button design
      - height="18": Sufficient height to show all three dots
      - viewBox="10 3 4 18.25": Custom viewport focusing on the central dot area
        * x=10, y=3: Offset to center the dots horizontally and position vertically
        * width=4, height=18.25: Viewport size that shows all dots without cropping

      Previous issue: Using size="18" caused the default 24x24 viewBox to crop the dots
      at this small width, making them nearly invisible.

      Regression test: ButtonDots.regression.test.js prevents accidental changes
    -->
    <IconDotsVertical width="4" height="18" viewBox="10 3 4 18.25" />
  </ButtonToggle>
</template>

<style scoped>
  .btn-toggle {
    width: 16px !important;
    height: 32px !important;
    padding: 0 !important;
  }

  .btn-toggle svg {
    margin: 0;
  }
</style>
