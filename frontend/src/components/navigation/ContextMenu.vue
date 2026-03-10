<script setup>
  /**
   * ContextMenu - Simplified dropdown menu component with Floating UI positioning
   *
   * A streamlined context menu component that provides dropdown menus with precise
   * Floating UI positioning. Supports dots button and custom slot triggers with
   * mobile-responsive positioning strategies and keyboard navigation.
   *
   * Key Features:
   * - Two variants: 'dots' (default button) and 'slot' (custom trigger)
   * - Floating UI positioning with automatic placement adjustment
   * - Mobile-responsive positioning (centered modal vs. anchored desktop)
   * - Keyboard navigation with arrow keys (j/k and arrow up/down)
   * - Sub-menu support with automatic context providing
   * - Click-outside and ESC key closing
   * - Teleported to body for proper z-index layering
   *
   * @displayName ContextMenu
   * @example
   * // Basic dots menu (most common usage)
   * <ContextMenu>
   *   <ContextMenuItem icon="edit" caption="Edit" />
   *   <ContextMenuItem icon="trash" caption="Delete" />
   * </ContextMenu>
   *
   * @example
   * // Custom placement
   * <ContextMenu placement="right-start">
   *   <ContextMenuItem icon="copy" caption="Copy" />
   *   <ContextMenuItem icon="paste" caption="Paste" />
   * </ContextMenu>
   *
   * @example
   * // Mobile mode (centered modal)
   * <ContextMenu :mobile-mode="true">
   *   <ContextMenuItem icon="share" caption="Share" />
   *   <ContextMenuItem icon="download" caption="Download" />
   * </ContextMenu>
   *
   * @example
   * // Custom trigger via slot
   * <ContextMenu variant="slot">
   *   <template #trigger="{ toggle, isOpen }">
   *     <button @click="toggle" :class="{ active: isOpen }" class="custom-btn">
   *       Actions <Icon name="chevron-down" />
   *     </button>
   *   </template>
   *   <ContextMenuItem icon="settings" caption="Settings" />
   *   <ContextMenuItem icon="help" caption="Help" />
   * </ContextMenu>
   *
   * @example
   * // Custom menu styling
   * <ContextMenu menuClass="wide-menu">
   *   <ContextMenuItem icon="edit" caption="Edit" />
   *   <ContextMenuItem icon="delete" caption="Delete" />
   * </ContextMenu>
   *
   * @example
   * // Multiple custom classes
   * <ContextMenu :menuClass="['custom-menu', 'dark-theme']">
   *   <ContextMenuItem icon="share" caption="Share" />
   *   <ContextMenuItem icon="download" caption="Download" />
   * </ContextMenu>
   *
   * @example
   * // Conditional classes
   * <ContextMenu :menuClass="{ 'active': isActive, 'disabled': isDisabled }">
   *   <ContextMenuItem icon="settings" caption="Settings" />
   * </ContextMenu>
   *
   * @example
   * // Nested sub-menu (automatic context inheritance)
   * <ContextMenu>
   *   <ContextMenuItem icon="edit" caption="Edit" />
   *   <ContextMenu variant="slot" placement="right-start">
   *     <template #trigger="{ toggle }">
   *       <button @click="toggle" class="item">
   *         <Icon name="dots" /> More Actions
   *       </button>
   *     </template>
   *     <ContextMenuItem icon="copy" caption="Duplicate" />
   *     <ContextMenuItem icon="archive" caption="Archive" />
   *   </ContextMenu>
   * </ContextMenu>
   */

  import { ref, computed, watch, provide, inject, useTemplateRef } from "vue";
  import { useFloating, autoUpdate, offset, flip, shift } from "@floating-ui/vue";
  import { useListKeyboardNavigation } from "@/composables/useListKeyboardNavigation.js";
  import useClosable from "@/composables/useClosable.js";
  import ButtonDots from "@/components/base/ButtonDots.vue";

  const props = defineProps({
    /**
     * Menu trigger variant type
     * @values 'dots', 'slot'
     */
    variant: {
      type: String,
      default: "dots",
      validator: (value) => ["dots", "slot"].includes(value),
    },

    /**
     * Floating UI placement string for menu positioning relative to trigger
     * @see https://floating-ui.com/docs/tutorial#placements
     * @values 'top', 'top-start', 'top-end', 'right', 'right-start', 'right-end', 'bottom', 'bottom-start', 'bottom-end', 'left', 'left-start', 'left-end'
     */
    placement: {
      type: String,
      default: "bottom-start",
    },

    /**
     * Custom CSS classes to apply to the menu container
     * @type {String|Array|Object}
     */
    menuClass: {
      type: [String, Array, Object],
      default: null,
    },
  });
  defineOptions({ inheritAttrs: false });

  // Sub-menu setup
  provide("isSubMenu", true);
  provide("parentMenu", { placement: props.placement });
  const isSubMenu = inject("isSubMenu", false);
  const parentMenu = inject("parentMenu", null);

  // State
  const show = ref(false);

  // Template refs
  const triggerRef = useTemplateRef("trigger-ref");
  const menuRef = useTemplateRef("menu-ref");

  // Floating UI setup
  const mobileMode = inject("mobileMode");
  const strategy = computed(() => (mobileMode?.value ? "fixed" : "absolute"));
  const { floatingStyles, placement: actualPlacement } = useFloating(triggerRef, menuRef, {
    placement: computed(() => props.placement),
    strategy: strategy,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Mobile positioning override
  const menuStyles = computed(() => {
    if (mobileMode.value) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "90vw",
        maxWidth: "320px",
        maxHeight: "80vh",
        overflowY: "auto",
      };
    }
    return floatingStyles.value;
  });

  const menuClasses = computed(() => {
    const classes = ["context-menu", { "context-menu--mobile": mobileMode?.value }];

    if (props.menuClass) {
      classes.push(props.menuClass);
    }

    return classes;
  });

  // Toggle function
  const toggle = () => {
    show.value = !show.value;
  };

  /**
   * Exposes methods and computed properties for parent components
   */
  defineExpose({
    toggle,
    actualPlacement,
  });

  // Keyboard navigation
  const numItems = computed(() => menuRef.value?.querySelectorAll(".item").length || 0);
  const {
    activeIndex,
    clearSelection: clearMenuSelection,
    activate: activateNav,
    deactivate: deactivateNav,
  } = useListKeyboardNavigation(numItems, menuRef, false, false);

  // Closable behavior
  const close = () => {
    show.value = false;
    clearMenuSelection();
  };

  const { activate: activateClosable, deactivate: deactivateClosable } = useClosable({
    onClose: close,
    closeOnEsc: true,
    closeOnOutsideClick: true,
    closeOnCloseButton: false,
    autoActivate: false,
  });

  provide("closeMenu", close);

  // Menu lifecycle
  watch(show, (isShown) => {
    if (isShown) {
      activateClosable();
      activateNav();
    } else {
      deactivateNav();
      deactivateClosable();
    }
  });

  // Focus the menu item when navigated via keyboard
  watch(activeIndex, (newIndex) => {
    // Only focus when menu is shown and index is valid
    if (!show.value || newIndex === null) return;
    const menuEl = menuRef.value;
    if (!menuEl) return;
    const items = menuEl.querySelectorAll(".item");
    if (newIndex >= 0 && newIndex < items.length) {
      items[newIndex].focus();
    }
  });
</script>

<template>
  <div class="cm-wrapper" @click.stop @dblclick.stop>
    <!-- Dots variant trigger -->
    <ButtonDots
      v-if="variant === 'dots'"
      ref="trigger-ref"
      v-model="show"
      class="context-menu-trigger"
      :aria-expanded="show"
      data-testid="trigger-button"
      v-bind="$attrs"
    />

    <!-- Slot variant trigger -->
    <div
      v-else-if="variant === 'slot'"
      ref="trigger-ref"
      class="context-menu-trigger"
      v-bind="$attrs"
    >
      <!--
        @slot trigger - Custom trigger element (only used when variant="slot")
        @binding {Function} toggle - Function to toggle menu open/closed
        @binding {boolean} isOpen - Whether the menu is currently open
        @example
        <template #trigger="{ toggle, isOpen }">
          <button @click="toggle" :class="{ active: isOpen }">
            Custom Trigger
          </button>
        </template>
      -->
      <slot name="trigger" :toggle="toggle" :is-open="show" />
    </div>

    <Teleport to="body">
      <div
        v-if="show"
        ref="menu-ref"
        :class="menuClasses"
        role="menu"
        aria-orientation="vertical"
        :style="menuStyles"
        data-testid="context-menu"
      >
        <!--
          @slot default - Menu content (typically ContextMenuItem components)
          @binding {Function} close - Function to close the menu programmatically
          @example
          <ContextMenuItem @click="handleEdit">Edit</ContextMenuItem>
          <ContextMenuItem @click="handleDelete">Delete</ContextMenuItem>
          <ContextMenu variant="dots">
            <ContextMenuItem>Nested Option</ContextMenuItem>
          </ContextMenu>
        -->
        <slot />
      </div>
    </Teleport>
  </div>
</template>

<style>
  .cm-wrapper {
    width: fit-content;
    overflow: visible;
  }

  .context-menu {
    z-index: 999;
    background-color: var(--surface-primary);
    padding-block: 8px;
    border-radius: 16px;
    min-width: fit-content;
    box-shadow: var(--shadow-strong), var(--shadow-soft);

    & > *:not(:last-child) {
      margin-bottom: 8px;
    }
  }

  .context-menu--mobile {
    width: 90vw;
    max-width: 320px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .context-menu-trigger {
    width: fit-content;
  }

  /* Touch interactions */
  @media (hover: none) and (pointer: coarse) {
    .cm-wrapper {
      -webkit-tap-highlight-color: transparent;
    }
  }
</style>
