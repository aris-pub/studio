<script setup>
  /**
   * SegmentedControl - A component for creating a group of mutually exclusive buttons.
   *
   * This component displays a set of buttons, where only one can be active at a time.
   * It supports displaying icons, labels, or both, and can show tooltips on hover.
   * The active button's index is managed via `v-model`.
   *
   * @displayName SegmentedControl
   * @example
   * // Basic usage with labels
   * <SegmentedControl v-model="selectedOption" :labels="['Option A', 'Option B', 'Option C']" />
   *
   * @example
   * // With icons and a default active item
   * <SegmentedControl v-model="viewMode" :icons="['List', 'Grid']" :default-active="0" />
   *
   * @example
   * // With labels, icons, and tooltips
   * <SegmentedControl
   *   v-model="alignment"
   *   :labels="['Left', 'Center', 'Right']"
   *   :icons="['AlignLeft', 'AlignCenter', 'AlignRight']"
   *   :tooltips="['Align text left', 'Align text center', 'Align text right']"
   * />
   */
  import { computed, onMounted, ref } from "vue";

  const props = defineProps({
    icons: { type: Array, default: null },
    labels: { type: Array, default: null },
    tooltips: { type: Array, default: null },
    defaultActive: { type: Number, default: -1 },
    vertical: { type: Boolean, default: false },
    small: { type: Boolean, default: false },
  });

  const numItems = computed(() => {
    if (props.icons === null && props.labels === null) {
      console.error("Must provide one of icons or labels");
      return 0;
    } else if (props.icons === null && props.labels !== null) {
      return props.labels.length;
    } else if (props.icons !== null && props.labels === null) {
      return props.icons.length;
    } else if (props.icons !== null && props.labels !== null) {
      if (props.icons.length !== props.labels.length) {
        console.error("Lengths of icons and labels must match");
        return 0;
      } else {
        return props.icons.length;
      }
    }
    return 0;
  });

  const buttonRefs = ref([]);
  const setButtonRef = (el, index) => {
    if (el) buttonRefs.value[index] = el;
  };

  const active = defineModel({ type: Number, default: -1 });
  onMounted(() => (active.value = props.defaultActive));
  const click = (idx) => (active.value = idx);
</script>

<template>
  <div class="sc-wrapper" :class="{ vertical, small }">
    <template v-for="idx in numItems" :key="`segment-${idx}`">
      <button
        :ref="(el) => setButtonRef(el, idx - 1)"
        type="button"
        class="sc-item sc-btn"
        :class="{ active: idx - 1 === active }"
        @click="click(idx - 1)"
      >
        <Icon v-if="icons" :name="icons[idx - 1]" class="sc-icon" />
        <span v-if="labels" class="sc-label text-default">{{ labels[idx - 1] }}</span>
      </button>

      <Tooltip
        v-if="tooltips && tooltips[idx - 1] && buttonRefs[idx - 1]"
        :anchor="buttonRefs[idx - 1]"
        :content="tooltips[idx - 1]"
      />
    </template>
  </div>
</template>

<style scoped>
  .sc-wrapper {
    border-radius: 16px;
    display: flex;
    gap: 4px;
  }

  .sc-item {
    --padding-inline: 10px;
    padding-block: 6px;
    display: flex;
    align-items: center;
    padding-inline: calc(var(--padding-inline) - 2 * var(--border-thin));
    border-radius: 4px;
    transition: var(--transition-bg-color);

    &:first-child,
    &:last-child {
      padding-left: calc(var(--padding-inline));
      padding-right: calc(var(--padding-inline));
    }

    &:first-child {
      border-top-left-radius: 16px;
      border-bottom-left-radius: 16px;
    }

    &:last-child {
      border-top-right-radius: 16px;
      border-bottom-right-radius: 16px;
    }

    &:active {
      background-color: var(--blue-400) !important;
    }

    &.active {
      color: var(--almost-black);
      background-color: var(--blue-300);
      border-color: transparent;
      box-shadow: var(--shadow-soft), var(--shadow-strong);

      & > .sc-icon {
        color: var(--almost-black);
      }
    }

    &:not(.active) {
      cursor: pointer;
      color: var(--dark);
      background-color: var(--gray-100);

      & > .sc-icon {
        color: var(--dark);
      }

      &:hover {
        box-shadow: var(--shadow-strong);
        background-color: var(--blue-100);
        color: var(--extra-dark);
        & > .sc-icon {
          color: var(--extra-dark);
        }
      }
    }

    &:focus-visible {
      background-color: var(--surface-hover);
      outline-offset: var(--border-extrathin);
      & > .sc-icon {
        color: var(--dark);
      }

      &:hover {
        & > .sc-icon {
          color: var(--extra-dark);
        }
      }
    }
  }

  .sc-wrapper.small .sc-item {
    --padding-inline: 6px;
    padding-block: 4px;
  }

  .sc-wrapper.small .sc-icon {
    width: 14px;
    height: 14px;
  }

  .sc-wrapper.small .sc-label {
    font-size: 11px;
  }

  .sc-wrapper.vertical {
    flex-direction: column;

    & .sc-item:first-child {
      border-radius: 16px 16px 4px 4px;
      border-bottom-left-radius: 4px;
    }

    & .sc-item:last-child {
      border-radius: 4px 4px 16px 16px;
      border-top-right-radius: 4px;
    }
  }
</style>
