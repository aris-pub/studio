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
  import { ref, computed, watch, useTemplateRef } from "vue";
  import { IconChevronDown } from "@tabler/icons-vue";
  import ContextMenu from "@/components/navigation/ContextMenu.vue";

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

  const menuRef = useTemplateRef("menu-ref");

  const normalizedOptions = computed(() =>
    props.options.map((opt) =>
      typeof opt === "object" && opt !== null ? opt : { value: opt, label: String(opt) },
    ),
  );

  const currentLabel = computed(() => {
    const found = normalizedOptions.value.find((o) => o.value === localValue.value);
    return found ? found.label : "";
  });

  const selectOption = (value) => {
    localValue.value = value;
    menuRef.value?.toggle();
  };
</script>

<template>
  <div class="select-box" :class="[direction, { labeled: label }]">
    <label v-if="label" class="select-label">{{ label }}</label>
    <ContextMenu ref="menu-ref" variant="slot" placement="bottom-start" menu-class="select-dropdown">
      <template #trigger="{ toggle, isOpen }">
        <button
          type="button"
          class="select-control"
          :class="{ open: isOpen }"
          v-bind="$attrs"
          @click="toggle"
        >
          <span class="current-label">{{ currentLabel }}</span>
          <IconChevronDown class="select-chevron" :class="{ rotated: isOpen }" :size="16" />
        </button>
      </template>
      <button
        v-for="opt in normalizedOptions"
        :key="opt.value"
        type="button"
        class="select-option"
        :class="{ active: opt.value === localValue }"
        role="menuitem"
        @click="selectOption(opt.value)"
      >
        {{ opt.label }}
      </button>
    </ContextMenu>
  </div>
</template>

<style scoped>
  .select-box {
    display: flex;
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

<style>
  .select-dropdown.context-menu {
    border-radius: 8px;
    padding-block: 4px;
    min-width: 120px;
  }

  .select-dropdown.context-menu > *:not(:last-child) {
    margin-bottom: 0;
  }
</style>
