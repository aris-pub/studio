<script setup>
  /**
   * ColorPicker - A component for selecting a color from a predefined palette.
   *
   * This component displays a series of color swatches. Users can click on a swatch
   * to select a color, which then becomes active. It supports displaying color names
   * as labels and emits a 'change' event with the name of the selected color.
   *
   * @displayName ColorPicker
   * @example
   * // Basic usage with predefined colors and labels
   * <ColorPicker
   *   :colors="{ red: '#FF0000', green: '#00FF00', blue: '#0000FF' }"
   *   default-active="red"
   *   :labels="true"
   *   @change="handleColorChange"
   * />
   *
   * @example
   * // Without labels
   * <ColorPicker
   *   :colors="{ primary: '#6200EE', secondary: '#03DAC6' }"
   *   :labels="false"
   * />
   *
   * @example
   * // Custom color palette
   * <ColorPicker
   *   :colors="{ 'brand-a': '#FF6F00', 'brand-b': '#00B0FF', 'brand-c': '#76FF03' }"
   *   default-active="brand-b"
   * />
   */
  import { ref, watch, computed } from "vue";

  const props = defineProps({
    colors: { type: Object, required: true },
    defaultActive: { type: String, default: "" },
    labels: { type: Boolean, default: true },
    groupLabel: { type: String, default: "Color" },
  });
  const emit = defineEmits(["change"]);

  const activeColor = ref(props.defaultActive);
  watch(
    () => props.defaultActive,
    (val) => {
      activeColor.value = val;
    }
  );

  const colorNames = computed(() => Object.keys(props.colors));

  const tabbableColor = computed(() => {
    if (activeColor.value && colorNames.value.includes(activeColor.value)) {
      return activeColor.value;
    }
    return colorNames.value[0] || "";
  });

  const onClick = (name) => {
    activeColor.value = name;
    emit("change", name);
  };

  const onKeydown = (e) => {
    const names = colorNames.value;
    const idx = names.indexOf(activeColor.value || names[0]);
    let next;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      next = names[(idx + 1) % names.length];
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      next = names[(idx - 1 + names.length) % names.length];
    }
    if (next !== undefined) {
      onClick(next);
    }
  };
</script>

<template>
  <span class="cp-wrapper" role="radiogroup" :aria-label="groupLabel" @keydown="onKeydown">
    <div
      v-for="(color, name) in colors"
      :key="name"
      role="radio"
      class="swatch"
      :class="[name, activeColor === name ? 'active' : '']"
      :aria-checked="activeColor === name ? 'true' : 'false'"
      :aria-label="name"
      :tabindex="tabbableColor === name ? 0 : -1"
      @click="onClick(name)"
      @keydown.enter.prevent="onClick(name)"
      @keydown.space.prevent="onClick(name)"
    >
      <span class="circle" :style="{ 'background-color': color }" />
      <span v-if="labels" class="label text-caption">{{ name }}</span>
    </div>
  </span>
</template>

<style scoped>
  .cp-wrapper {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    flex-wrap: wrap;
  }

  .swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border-radius: 4px;
    padding: 8px;
    width: 60px;
    transition: var(--transition-bg-color);
    outline: none;

    &:active {
      background-color: var(--blue-400) !important;
    }

    &:hover {
      cursor: pointer;
      background-color: var(--blue-100);
      color: var(--extra-dark);

      & .circle {
        box-shadow: var(--shadow-strong);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--border-action, var(--blue-500));
      outline-offset: 2px;
    }
  }

  .swatch.active {
    background-color: var(--blue-300);
  }

  .swatch.active .circle {
    border-color: var(--almost-black);
    box-shadow: var(--shadow-soft);
  }

  .swatch.active .label {
    color: var(--almost-black);
    font-weight: var(--weight-medium);
  }

  .circle {
    display: inline-block;
    width: 32px;
    height: 32px;
    border-radius: 16px;
    border: var(--border-thin) solid var(--gray-700);
    pointer-events: none;
  }

  .label {
    color: var(--extra-dark);
  }
</style>
