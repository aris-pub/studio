<script setup>
  import { inject } from "vue";

  const props = defineProps({
    icon: { type: String, required: true },
    caption: { type: String, required: true },
    iconClass: { type: String, default: "" },
    shortcut: { type: String, default: "" },
  });

  const closeMenu = inject("closeMenu");
</script>

<template>
  <button
    ref="self-ref"
    type="button"
    class="item"
    role="menuitem"
    tabindex="-1"
    @click.stop="closeMenu"
  >
    <Icon :name="icon" class="cmi-icon" :class="iconClass" />
    <span class="cmi-caption">{{ caption }}</span>
    <span v-if="shortcut" class="cmi-shortcut">{{ shortcut }}</span>
  </button>
</template>

<style scoped>
  .item {
    /* reset button default styles */
    background: transparent;
    border: none;
    font: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    width: 100%;
    padding-left: 10px;
    padding-right: 16px;
    padding-block: 0px;
    gap: 4px;
    transition: var(--transition-bg-color);
    color: var(--extra-dark);

    &:hover {
      background-color: var(--surface-hover);
    }
    &:focus-visible {
      background-color: var(--surface-hover);
      outline: none;
    }
  }

  .item > .tabler-icon {
    stroke-width: 1.75px;
  }

  .item.danger {
    color: var(--text-error);

    &:hover {
      background-color: var(--surface-error);
    }

    & .tabler-icon {
      color: var(--icon-error);
    }
  }
  .item.focused {
    background-color: var(--surface-hover);
  }

  .cmi-shortcut {
    margin-left: auto;
    padding-left: 16px;
    font-size: 11px;
    color: var(--gray-600);
    white-space: nowrap;
  }
</style>
