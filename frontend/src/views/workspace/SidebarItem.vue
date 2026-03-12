<script setup>
  import { watch, inject } from "vue";

  const props = defineProps({
    icon: { type: String, required: true },
    label: { type: String, default: "" },
    preferredSide: {
      type: String,
      default: "left",
      validator: (value) => ["left", "top", "right"].includes(value),
    },
    showDelay: { type: Number, default: 500 },
    hideDelay: { type: Number, default: 300 },
    type: { type: String, default: "filled" },
  });
  const emit = defineEmits(["on", "off"]);
  const buttonState = defineModel({ type: Boolean, default: false });
  const mobileMode = inject("mobileMode");

  // Emit legacy @on/@off events for backward compatibility
  watch(buttonState, (state) => {
    state ? emit("on") : emit("off");
  });
</script>

<template>
  <div class="sb-item">
    <div class="sb-item-btn">
      <ButtonToggle
        v-model="buttonState"
        :icon="icon"
        :aria-label="label || 'Toggle ' + icon"
        :aria-pressed="buttonState"
        tabindex="0"
        :button-size="mobileMode ? 'sm' : 'md'"
        active-color="purple"
        :type="type"
      />
    </div>
    <div class="sb-item-label text-default">{{ label }}</div>
  </div>
</template>

<style scoped>
  .sb-item {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .sb-item-btn {
    display: flex;
    gap: 16px;
    justify-content: center;
    align-items: center;
  }

  .sb-item-btn button {
    padding: 6px !important;
  }

  .sb-item-btn:hover button:not(.active) {
    box-shadow: var(--shadow-strong);
    background-color: var(--gray-50);
  }

  .sb-item-btn:has(button.active.outline) {
    font-weight: var(--weight-semi);
  }

  .sb-item-btn > button.active.outline {
    background-color: var(--surface-page);
  }

  .sb-item-btn:has(button.active) + .sb-item-label {
    font-weight: var(--weight-semi);
  }

  .sb-item-label {
    margin-left: -8px;
    width: 64px;
    text-align: center;
    font-size: 14px;
    transition: color 0.3s ease;
  }

  .sc-wrapper {
    z-index: -1;
    position: absolute;
    left: calc(64px + 8px);
    transform: translateX(calc(-100% - 64px - 8px));
    opacity: 0.5;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
  }

  .sc-wrapper.show {
    transform: translateX(0);
  }

  .sc-wrapper:hover {
    opacity: 1;
  }
</style>
