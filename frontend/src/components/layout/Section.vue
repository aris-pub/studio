<script setup>
  import { computed } from "vue";

  /**
   * Section component with multiple style variants for different contexts.
   *
   * Supports traditional bordered sections and modern card-style layouts
   * with theme support for different visual contexts.
   */

  const props = defineProps({
    /**
     * Visual style variant of the section
     * @values 'default', 'enhanced', 'minimal'
     */
    variant: {
      type: String,
      default: "default",
      validator: (value) => ["default", "enhanced", "minimal"].includes(value),
    },

    /**
     * Color theme for the section
     * @values 'neutral', 'purple', 'danger'
     */
    theme: {
      type: String,
      default: "neutral",
      validator: (value) => ["neutral", "purple", "danger"].includes(value),
    },

    /**
     * Enable hover effects for interactive sections
     */
    hoverable: {
      type: Boolean,
      default: false,
    },

    /**
     * HTML tag for the title element, for correct heading hierarchy (WCAG 1.3.1)
     * @values 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
     */
    headingTag: {
      type: String,
      default: "div",
      validator: (value) => ["div", "h1", "h2", "h3", "h4", "h5", "h6"].includes(value),
    },
  });

  const sectionClasses = computed(() => ({
    section: true,
    [`variant-${props.variant}`]: props.variant !== "default",
    [`theme-${props.theme}`]: props.theme !== "neutral",
    hoverable: props.hoverable,
    // Preserve legacy danger class for backward compatibility
    danger: props.theme === "danger" && props.variant === "default",
  }));
</script>

<template>
  <div :class="sectionClasses">
    <component :is="headingTag" v-if="$slots.title" class="title text-h5">
      <slot name="title" />
    </component>
    <div class="content"><slot name="content" /></div>
    <div v-if="$slots.footer" class="footer"><slot name="footer" /></div>
  </div>
</template>

<style scoped>
  /*
   * Base Section Styles (Default Variant)
   * Maintains backward compatibility with existing usage
   */
  .section {
    border-radius: calc(8px + var(--border-thin));
    background-color: var(--surface-page);
    border: var(--border-thin) solid var(--border-primary);
    margin-bottom: 16px;
    width: fit-content;
  }

  .section > * {
    padding-inline: 8px;
  }

  .section > .title {
    height: 40px;
    border-bottom: 2px solid var(--border-primary);
    margin-bottom: 8px;
    padding-inline: 8px;
    background-color: var(--gray-200);
    border-radius: 8px 8px 0 0;
    display: flex;
    align-items: center;
  }

  .section > .content:first-child {
    padding-top: 8px;
  }

  .section > .content:not(:last-child) {
    padding-bottom: 16px;
  }

  .section > :is(.content, .footer) {
    display: flex;
    flex-direction: column;
    padding-inline: 8px;
    padding-bottom: 8px;
    gap: 16px;
  }

  /* Legacy danger support for backward compatibility */
  .section.danger {
    border-color: var(--border-error);
    border-radius: 8px;
  }

  .section.danger .title {
    background-color: var(--error-50);
    border-color: var(--border-error);
  }

  /*
   * Enhanced Variant - Modern Card Design
   * Based on account view styling for professional appearance
   */
  .section.variant-enhanced {
    background: var(--surface-primary);
    border-radius: 16px;
    border: var(--border-thin) solid var(--gray-200);
    box-shadow: none;
    padding: 24px;
    width: 100%;
    transition: box-shadow 0.2s ease;
  }

  .section.variant-enhanced.hoverable:hover {
    box-shadow: var(--shadow-soft);
  }

  .section.variant-enhanced > * {
    padding-inline: 0;
  }

  .section.variant-enhanced > .title {
    font-size: 20px;
    font-weight: var(--weight-semi);
    color: var(--gray-900);
    margin: 0 0 24px 0;
    padding: 0 0 16px 0;
    border-bottom: var(--border-thin) solid var(--gray-200);
    background: transparent;
    border-radius: 0;
    height: auto;
    display: block;
  }

  .section.variant-enhanced > :is(.content, .footer) {
    padding: 0;
    gap: 20px;
    padding-bottom: 0;
  }

  /*
   * Minimal Variant - Compact Design
   * For dense layouts where space is at a premium
   */
  .section.variant-minimal {
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 8px;
    width: 100%;
  }

  .section.variant-minimal > * {
    padding-inline: 0;
  }

  .section.variant-minimal > .title {
    font-size: 16px;
    margin: 0 0 12px 0;
    padding: 0 0 8px 0;
    border-bottom: var(--border-thin) solid var(--gray-200);
    background: transparent;
    border-radius: 0;
    height: auto;
    display: block;
  }

  .section.variant-minimal > :is(.content, .footer) {
    padding: 0;
    gap: 12px;
    padding-bottom: 0;
  }

  /*
   * Theme Variants
   * Support for different color schemes
   */

  /* Purple Theme - For FileSettings and similar contexts */
  .section.theme-purple > .title {
    background-color: var(--purple-50) !important;
    color: var(--purple-900);
  }

  .section.variant-enhanced.theme-purple > .title {
    border-bottom-color: var(--purple-200);
  }

  .section.theme-purple {
    border-color: var(--purple-200);
  }

  /* Danger Theme - For error states and destructive actions */
  .section.theme-danger {
    border-color: var(--border-error);
  }

  .section.theme-danger > .title {
    background-color: var(--error-50);
    color: var(--error-700);
  }

  .section.variant-enhanced.theme-danger > .title {
    border-bottom-color: var(--error-200);
  }

  /*
   * Responsive Design
   * Enhanced variants adapt to smaller screens
   */
  @media (max-width: 768px) {
    .section.variant-enhanced {
      padding: 20px;
    }

    .section.variant-enhanced > .title {
      font-size: 18px;
      margin-bottom: 20px;
      padding-bottom: 12px;
    }

    .section.variant-enhanced > :is(.content, .footer) {
      gap: 16px;
    }
  }

  @media (max-width: 480px) {
    .section.variant-enhanced {
      padding: 16px;
    }

    .section.variant-enhanced > .title {
      font-size: 16px;
      margin-bottom: 16px;
    }
  }
</style>
