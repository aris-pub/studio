<script setup>
  /**
   * SelectBox - A custom dropdown select component styled to match InputText.
   *
   * @displayName SelectBox
   * @example
   * <SelectBox v-model="selectedFruit" :options="['Apple', 'Banana', 'Orange']" />
   *
   * @example
   * <SelectBox
   *   v-model="selectedId"
   *   :options="[{ value: 1, label: 'First' }, { value: 2, label: 'Second' }]"
   *   direction="column"
   * />
   */
  import { ref, computed, watch, useTemplateRef, nextTick } from "vue";
  import { useFloating, autoUpdate, offset, flip, shift } from "@floating-ui/vue";
  import { IconChevronDown } from "@tabler/icons-vue";

  const props = defineProps({
    modelValue: { type: [String, Number], default: null },
    direction: { type: String, default: "row" },
    options: { type: Array, default: () => [] },
    label: { type: String, default: "" },
  });
  const emit = defineEmits(["update:modelValue"]);

  const localValue = ref(props.modelValue);
  watch(
    () => props.modelValue,
    (v) => {
      localValue.value = v;
    },
  );
  watch(
    () => localValue.value,
    (v) => {
      emit("update:modelValue", v);
    },
  );
  defineOptions({ inheritAttrs: false });

  const isOpen = ref(false);
  const controlRef = useTemplateRef("control-ref");
  const listboxRef = useTemplateRef("listbox-ref");

  const { floatingStyles } = useFloating(controlRef, listboxRef, {
    placement: "bottom-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const normalizedOptions = computed(() =>
    props.options.map((opt) =>
      typeof opt === "object" && opt !== null ? opt : { value: opt, label: String(opt) },
    ),
  );

  const currentLabel = computed(() => {
    const found = normalizedOptions.value.find((o) => o.value === localValue.value);
    return found ? found.label : "";
  });

  const toggle = () => {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
      nextTick(() => document.addEventListener("click", handleOutsideClick));
      document.addEventListener("keydown", handleKeydown);
    }
  };

  const close = () => {
    if (!isOpen.value) return;
    isOpen.value = false;
    document.removeEventListener("click", handleOutsideClick);
    document.removeEventListener("keydown", handleKeydown);
  };

  const selectOption = (value) => {
    localValue.value = value;
    close();
  };

  const handleOutsideClick = (event) => {
    const control = controlRef.value;
    const listbox = listboxRef.value;
    if (control && !control.contains(event.target) && listbox && !listbox.contains(event.target)) {
      close();
    }
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      close();
    }
  };
</script>

<template>
  <div class="select-box" :class="[direction, { labeled: label }]">
    <label v-if="label" class="select-label">{{ label }}</label>
    <button
      ref="control-ref"
      type="button"
      class="select-control"
      :class="{ open: isOpen }"
      v-bind="$attrs"
      @click="toggle"
    >
      <span class="current-label">{{ currentLabel }}</span>
      <IconChevronDown class="select-chevron" :class="{ rotated: isOpen }" :size="16" />
    </button>
    <div
      v-if="isOpen"
      ref="listbox-ref"
      class="select-listbox"
      role="listbox"
      :style="floatingStyles"
    >
      <button
        v-for="opt in normalizedOptions"
        :key="opt.value"
        type="button"
        class="select-option"
        :class="{ active: opt.value === localValue }"
        role="option"
        :aria-selected="opt.value === localValue"
        @click="selectOption(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
  .select-box {
    display: flex;
    position: relative;
  }

  .select-box.labeled {
    flex-direction: column;
    gap: 6px;
  }

  .select-label {
    font-weight: var(--weight-medium, 500);
    font-size: 14px;
    color: var(--gray-900);
  }

  .select-box.row:not(.labeled) {
    width: fit-content;
    flex-direction: row;
    align-items: center;
  }

  .select-box.column:not(.labeled) {
    flex-direction: column;
    gap: 2px;
  }

  .select-control {
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 8px;
    padding-block: 6px;
    padding-inline: 12px 8px;
    font: inherit;
    cursor: pointer;
    width: 100%;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;
  }

  .select-control:hover {
    border-color: var(--border-action);
  }

  .select-control.open {
    border-color: var(--border-action);
    background-color: var(--white);
  }

  .select-control[disabled] {
    background-color: var(--surface-disabled);
    cursor: not-allowed;
  }

  .current-label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
  }

  .select-chevron {
    color: var(--gray-500);
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  .select-chevron.rotated {
    transform: rotate(180deg);
  }

  .select-listbox {
    z-index: 999;
    background-color: var(--surface-primary);
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 8px;
    padding-block: 4px;
    min-width: 100%;
    box-shadow: var(--shadow-soft);
  }

  .select-option {
    display: block;
    width: 100%;
    padding: 6px 12px;
    background: transparent;
    border: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
    color: var(--extra-dark);
    transition: var(--transition-bg-color);
  }

  .select-option:hover {
    background-color: var(--surface-hover);
  }

  .select-option.active {
    font-weight: var(--weight-medium, 500);
    color: var(--text-action);
  }
</style>
