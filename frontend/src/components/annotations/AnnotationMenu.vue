<script setup>
  import { ref, computed, inject, onMounted, onUnmounted, useTemplateRef } from "vue";
  import { useFloating, autoUpdate, offset, flip, shift } from "@floating-ui/vue";
  import { extractAnchor } from "@/utils/anchorExtraction.js";

  const selfRef = useTemplateRef("selfRef");
  const visible = ref(false);
  const virtualEl = ref(null);
  const currentRange = ref(null);
  const expanded = ref(false);
  const selectedColor = ref("purple");

  const annotationActions = inject("annotationActions", null);

  // Color state
  const colors = computed(() =>
    expanded.value
      ? {
          purple: "var(--purple-300)",
          orange: "var(--orange-300)",
          green: "var(--green-300)",
          red: "var(--red-300)",
          pink: "var(--pink-300)",
          yellow: "var(--yellow-300)",
        }
      : {
          purple: "var(--purple-300)",
          orange: "var(--orange-300)",
          green: "var(--green-300)",
        }
  );

  // Create virtual element for Floating UI
  const getVirtualElementFromRange = (range) => ({
    getBoundingClientRect: () => range.getBoundingClientRect(),
    contextElement: document.body,
  });

  // Floating UI setup
  const { floatingStyles } = useFloating(virtualEl, selfRef, {
    whileElementsMounted: autoUpdate,
    placement: "top",
    middleware: [offset(8), shift(), flip()],
  });

  // Range in viewport check
  const isRangeInViewport = (range) => {
    const rect = range.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;

    return rect.bottom >= 0 && rect.right >= 0 && rect.top <= vh && rect.left <= vw;
  };

  const clearSelection = () => {
    visible.value = false;
    virtualEl.value = null;
    currentRange.value = null;

    const selection = window.getSelection();
    if (selection && selection.removeAllRanges) {
      selection.removeAllRanges();
    }
  };

  // Update floating position and hide if out of bounds
  const updateFloatingPosition = () => {
    if (!currentRange.value) return;

    virtualEl.value = getVirtualElementFromRange(currentRange.value);
    if (!isRangeInViewport(currentRange.value)) {
      clearSelection();
    }
  };

  // Called only after user has finished selecting (mouseup)
  const tryShowMenu = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      clearSelection();
      return;
    }

    const range = sel.getRangeAt(0);
    if (!range || range.collapsed) {
      clearSelection();
      return;
    }

    currentRange.value = range;
    virtualEl.value = getVirtualElementFromRange(range);
    visible.value = true;
    updateFloatingPosition();
  };

  function getManuscriptWrapper() {
    return document.querySelector(".manuscriptwrapper");
  }

  // Set data-selecting on mousedown so the CSS rule
  // .manuscriptwrapper:not([data-selecting]) .hr:focus won't match.
  // This runs before the browser's default focus action paints.
  const handleMouseDown = () => {
    const wrapper = getManuscriptWrapper();
    if (wrapper) {
      wrapper.dataset.selecting = "";
    }
  };

  const handleMouseUp = () => {
    setTimeout(() => {
      const wrapper = getManuscriptWrapper();
      const sel = window.getSelection();
      const isDrag = sel && !sel.isCollapsed;

      if (isDrag) {
        const focused = document.activeElement;
        if (focused?.closest?.(".hr")) {
          focused.blur();
        }
      }

      if (wrapper) {
        delete wrapper.dataset.selecting;
      }

      tryShowMenu();
    }, 0);
  };

  function getManuscriptEl() {
    return (
      document.querySelector('[data-testid="manuscript-viewer"]') ||
      document.querySelector(".rsm-manuscript")
    );
  }

  async function onColorClick(colorName) {
    selectedColor.value = colorName;
    if (!annotationActions || !currentRange.value) return;

    const manuscriptEl = getManuscriptEl();
    const anchor = extractAnchor(currentRange.value, manuscriptEl);
    if (!anchor) return;

    await annotationActions.createAnnotation({
      color: colorName,
      anchorData: {
        node_id: anchor.node_id,
        element_id: anchor.element_id,
        start_offset: anchor.start_offset,
        end_offset: anchor.end_offset,
      },
      selectedText: anchor.selected_text,
    });

    clearSelection();
  }

  const inputText = ref("");
  const onSubmit = async () => {
    if (!annotationActions || !currentRange.value) return;

    const manuscriptEl = getManuscriptEl();
    const anchor = extractAnchor(currentRange.value, manuscriptEl);
    if (!anchor) return;

    const annotation = await annotationActions.createAnnotation({
      color: selectedColor.value,
      anchorData: {
        node_id: anchor.node_id,
        element_id: anchor.element_id,
        start_offset: anchor.start_offset,
        end_offset: anchor.end_offset,
      },
      selectedText: anchor.selected_text,
    });

    if (inputText.value.trim()) {
      await annotationActions.addNote(annotation.id, inputText.value.trim());
    }

    inputText.value = "";
    clearSelection();
  };

  onMounted(() => {
    const manuscriptContainer =
      document.querySelector('[data-testid="manuscript-viewer"]') ||
      document.querySelector(".rsm-manuscript") ||
      document.querySelector('[data-testid="manuscript-container"]');

    if (manuscriptContainer) {
      manuscriptContainer.addEventListener("mousedown", handleMouseDown);
      manuscriptContainer.addEventListener("mouseup", handleMouseUp);
    }

    document.addEventListener("scroll", updateFloatingPosition, true);
    window.addEventListener("resize", updateFloatingPosition);
  });

  onUnmounted(() => {
    const manuscriptContainer =
      document.querySelector('[data-testid="manuscript-viewer"]') ||
      document.querySelector(".rsm-manuscript") ||
      document.querySelector('[data-testid="manuscript-container"]');

    if (manuscriptContainer) {
      manuscriptContainer.removeEventListener("mousedown", handleMouseDown);
      manuscriptContainer.removeEventListener("mouseup", handleMouseUp);
    }

    document.removeEventListener("scroll", updateFloatingPosition, true);
    window.removeEventListener("resize", updateFloatingPosition);
  });
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" ref="selfRef" :style="floatingStyles" class="hl-menu" @mouseup.stop>
      <div class="left">
        <ColorPicker
          :colors="colors"
          :labels="false"
          :default-active="selectedColor"
          @change="onColorClick"
        />
      </div>
      <div class="middle">
        <AnnotationInputBox v-model="inputText" :expanded="expanded" @submit="onSubmit" />
      </div>
      <div class="right">
        <Button
          kind="tertiary"
          size="sm"
          :icon="expanded ? 'ChevronUp' : 'ChevronDown'"
          @click="expanded = !expanded"
        />
        <ButtonClose @click="clearSelection" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
  .hl-menu {
    position: absolute;
    background: var(--surface-page);
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 16px;
    padding-block: 4px;
    padding-inline: 8px;
    box-shadow: var(--shadow-soft);
    display: flex;
    gap: 16px;
    z-index: 999;

    & > * {
      display: flex;
      align-items: center;
    }
  }

  .left {
    width: 88px;
  }

  .right {
    display: flex;
    padding-block: 4px;
    align-items: flex-start;
    margin: -4px;

    & :deep(.tabler-icon) {
      color: var(--dark) !important;
    }
  }

  .cp-wrapper {
    gap: 2px !important;
  }

  .cp-wrapper :deep(.swatch) {
    height: fit-content;
    width: fit-content;
    padding-inline: 6px;
    padding-block: 6px;

    & > button {
      height: 16px;
      width: 16px;
    }
  }
</style>
