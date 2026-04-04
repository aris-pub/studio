<script setup>
  import { ref, watch } from "vue";

  const props = defineProps({
    modelValue: { type: Boolean, default: false },
    height: {
      type: String,
      default: "half",
      validator: (v) => ["half", "full"].includes(v),
    },
    title: { type: String, default: "" },
  });

  const emit = defineEmits(["update:modelValue", "close"]);

  const panelRef = ref(null);
  const dragging = ref(false);
  const dragStartY = ref(0);
  const dragOffset = ref(0);

  const close = () => {
    emit("update:modelValue", false);
    emit("close");
  };

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) close();
  };

  const onKeydown = (e) => {
    if (e.key === "Escape") close();
  };

  const onDragStart = (e) => {
    dragging.value = true;
    dragStartY.value = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.value = 0;
  };

  const onDragMove = (e) => {
    if (!dragging.value) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = y - dragStartY.value;
    // Only allow dragging downward
    dragOffset.value = Math.max(0, delta);
    if (panelRef.value) {
      panelRef.value.style.transform = `translateY(${dragOffset.value}px)`;
    }
  };

  const onDragEnd = () => {
    if (!dragging.value) return;
    dragging.value = false;
    // Dismiss if dragged more than 100px down
    if (dragOffset.value > 100) {
      close();
    }
    if (panelRef.value) {
      panelRef.value.style.transform = "";
    }
    dragOffset.value = 0;
  };

  watch(
    () => props.modelValue,
    (open) => {
      if (open) dragOffset.value = 0;
    }
  );
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="bottom-sheet-backdrop"
      tabindex="-1"
      @click="onBackdropClick"
      @keydown="onKeydown"
    >
      <div
        ref="panelRef"
        class="bottom-sheet-panel"
        :class="height"
        @click.stop
        @touchstart.passive="onDragStart"
        @touchmove.passive="onDragMove"
        @touchend="onDragEnd"
      >
        <div class="drag-handle" @mousedown="onDragStart" />
        <div v-if="title" class="bottom-sheet-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="bottom-sheet-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
  .bottom-sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 9998;
    display: flex;
    align-items: flex-end;
    backdrop-filter: blur(2px);
  }

  .bottom-sheet-panel {
    width: 100%;
    background: var(--surface-page, #fff);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: transform 0.3s ease;
    will-change: transform;
  }

  .bottom-sheet-panel.half {
    max-height: 65vh;
  }

  .bottom-sheet-panel.full {
    max-height: 90vh;
  }

  .drag-handle {
    width: 36px;
    height: 4px;
    background: var(--border-primary, #ccc);
    border-radius: 2px;
    margin: 10px auto 4px;
    cursor: grab;
    flex-shrink: 0;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .bottom-sheet-header {
    padding: 8px 16px 4px;
    flex-shrink: 0;
  }

  .bottom-sheet-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #111);
  }

  .bottom-sheet-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
</style>
