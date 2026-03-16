<script setup>
  /**
   * SelectBox - A custom dropdown select component.
   *
   * This component provides a styled dropdown interface for selecting a single value
   * from a list of options. It displays the currently selected label and uses a
   * `ContextMenu` for the dropdown options. It supports `v-model` for its value,
   * and can display options in a row or column layout.
   *
   * @displayName SelectBox
   * @example
   * // Basic usage with string options
   * <SelectBox v-model="selectedFruit" :options="['Apple', 'Banana', 'Orange']" />
   *
   * @example
   * // With object options and column direction
   * <SelectBox
   *   v-model="selectedId"
   *   :options="[{ value: 1, label: 'First' }, { value: 2, label: 'Second' }]"
   *   direction="column"
   * />
   *
   * @example
   * // With a default selected value
   * <SelectBox v-model="selectedStatus" :options="['Active', 'Inactive']" :model-value="'Active'" />
   */
  import { ref, computed, watch } from "vue";
  import ContextMenu from "@/components/navigation/ContextMenu.vue";
  import ContextMenuItem from "@/components/navigation/ContextMenuItem.vue";

  const props = defineProps({
    modelValue: { type: [String, Number], default: null },
    direction: { type: String, default: "row" },
    options: { type: Array, default: () => [] },
    label: { type: String, default: "" },
  });
  const emit = defineEmits(["update:modelValue"]);

  // Manage internal value for v-model
  const localValue = ref(props.modelValue);
  watch(
    () => props.modelValue,
    (v) => {
      localValue.value = v;
    }
  );
  watch(
    () => localValue.value,
    (v) => {
      emit("update:modelValue", v);
    }
  );
  defineOptions({ inheritAttrs: false });

  // Normalize options: allow primitives or {value,label} objects
  const normalizedOptions = computed(() =>
    props.options.map((opt) =>
      typeof opt === "object" && opt !== null ? opt : { value: opt, label: String(opt) }
    )
  );

  // Display label of current value
  const currentLabel = computed(() => {
    const found = normalizedOptions.value.find((o) => o.value === localValue.value);
    return found ? found.label : "";
  });
</script>

<template>
  <div class="select-box" :class="[direction, { labeled: label }]">
    <label v-if="label" class="select-label">{{ label }}</label>
    <div class="select-control">
      <span class="current-label">{{ currentLabel }}</span>
      <ContextMenu variant="slot" placement="bottom-start">
        <template #trigger="{ toggle }">
          <ButtonToggle icon="CaretDownFilled" v-bind="$attrs" @click="toggle" />
        </template>
        <ContextMenuItem
          v-for="opt in normalizedOptions"
          :key="opt.value"
          icon=""
          :caption="opt.label"
          :class="{ active: opt.value === localValue }"
          @click="localValue = opt.value"
        />
      </ContextMenu>
    </div>
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

  .select-control {
    display: flex;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 8px;
  }

  .select-box:not(.labeled) .select-control {
    /* Unlabeled: match prior behaviour */
  }

  .select-box.row:not(.labeled) {
    width: fit-content;
    flex-direction: row;
    align-items: center;

    & .select-control {
      width: fit-content;
    }
  }

  .select-box.column:not(.labeled) {
    flex-direction: column;
    gap: 2px;
  }

  .current-label {
    flex: 1;
    display: flex;
    align-items: center;
    height: 100%;
    text-wrap: nowrap;
    background: var(--surface-page);
    padding-inline: 8px 4px;
    border-radius: 8px 0 0 8px;
  }

  :deep(.cm-btn) {
    width: 24px;
    height: calc(24px - var(--border-thin));
    padding: 0 !important;
    border-radius: 0 8px 8px 0 !important;

    & .tabler-icon {
      margin: 0;
    }
  }
</style>
