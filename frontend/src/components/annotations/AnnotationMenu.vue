<script setup>
  import { ref, inject, onMounted, onUnmounted, useTemplateRef, nextTick } from "vue";
  import { useFloating, autoUpdate, offset, flip, shift } from "@floating-ui/vue";
  import { extractAnchor } from "@/utils/anchorExtraction.js";
  import { SWATCH_COLORS } from "@/constants/annotationColors.js";

  const selfRef = useTemplateRef("selfRef");
  const visible = ref(false);
  const virtualEl = ref(null);
  const currentAnchor = ref(null);
  // Static rect snapshot — immune to DOM mutations that invalidate live Ranges
  let anchorRect = null;

  const annotationActions = inject("annotationActions", null);

  const getVirtualElementFromRect = (rect) => ({
    getBoundingClientRect: () => rect,
    contextElement: document.body,
  });

  const { floatingStyles } = useFloating(virtualEl, selfRef, {
    whileElementsMounted: autoUpdate,
    strategy: "fixed",
    placement: "top",
    middleware: [offset(8), shift(), flip()],
  });

  const isRectInViewport = (rect) => {
    if (!rect || (rect.width === 0 && rect.height === 0)) return false;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    return rect.bottom >= 0 && rect.right >= 0 && rect.top <= vh && rect.left <= vw;
  };

  const clearSelection = () => {
    visible.value = false;
    virtualEl.value = null;
    anchorRect = null;
    currentAnchor.value = null;

    const selection = window.getSelection();
    if (selection && selection.removeAllRanges) {
      selection.removeAllRanges();
    }
  };

  const updateFloatingPosition = () => {
    if (!anchorRect) return;
    if (!isRectInViewport(anchorRect)) {
      clearSelection();
    }
  };

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

    // Extract anchor and snapshot the rect immediately while the Range
    // is still valid. DOM mutations from applyHighlights invalidate live Ranges.
    const manuscriptEl = getManuscriptEl();
    const anchor = extractAnchor(range, manuscriptEl);
    if (!anchor) {
      clearSelection();
      return;
    }

    anchorRect = range.getBoundingClientRect();
    currentAnchor.value = anchor;
    virtualEl.value = getVirtualElementFromRect(anchorRect);
    visible.value = true;
    nextTick(() => selfRef.value?.focus());
  };

  function getManuscriptWrapper() {
    return document.querySelector(".manuscriptwrapper");
  }

  const handleMouseDown = () => {
    const wrapper = getManuscriptWrapper();
    if (wrapper) {
      wrapper.dataset.selecting = "";
    }
  };

  const handleMouseUp = (e) => {
    const clickedMark = e.target.closest?.("mark[data-annotation-id]");

    setTimeout(() => {
      const wrapper = getManuscriptWrapper();
      const sel = window.getSelection();
      const isDrag = sel && !sel.isCollapsed;

      if (isDrag || clickedMark) {
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

  const handleMouseUpFallback = (e) => {
    const manuscriptContainer =
      document.querySelector('[data-testid="manuscript-viewer"]') ||
      document.querySelector(".rsm-manuscript") ||
      document.querySelector('[data-testid="manuscript-container"]');
    // Only clean up when mouseup is outside the manuscript (the leak scenario).
    // Inside-manuscript mouseups are handled by handleMouseUp with proper sequencing.
    if (manuscriptContainer?.contains(e.target)) return;
    const wrapper = getManuscriptWrapper();
    if (wrapper?.hasAttribute("data-selecting")) {
      delete wrapper.dataset.selecting;
    }
  };

  function getManuscriptEl() {
    return (
      document.querySelector('[data-testid="manuscript-viewer"]') ||
      document.querySelector(".rsm-manuscript")
    );
  }

  // Color click is the terminal action: create annotation with whatever
  // note text exists (empty string for highlight-only) and dismiss.
  const activeAnnotationId = inject("activeAnnotationId", ref(null));

  async function onColorClick(colorName) {
    if (!annotationActions || !currentAnchor.value) return;

    const anchor = currentAnchor.value;

    try {
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
    } catch (err) {
      console.error("Failed to create annotation:", err);
    }

    clearSelection();
  }

  async function onCreateAnnotation(visibility) {
    if (!annotationActions || !currentAnchor.value) return;

    const anchor = currentAnchor.value;

    try {
      const annotation = await annotationActions.createAnnotation({
        color: "purple",
        visibility,
        anchorData: {
          node_id: anchor.node_id,
          element_id: anchor.element_id,
          start_offset: anchor.start_offset,
          end_offset: anchor.end_offset,
        },
        selectedText: anchor.selected_text,
      });

      clearSelection();

      // Activate the annotation card so it opens in editing mode
      await nextTick();
      activeAnnotationId.value = annotation.id;
    } catch (err) {
      console.error("Failed to create annotation:", err);
      clearSelection();
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape" && visible.value) {
      clearSelection();
    }
  }

  function onOutsideMousedown(e) {
    if (!visible.value) return;
    if (selfRef.value?.contains(e.target)) return;
    clearSelection();
  }

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
    document.addEventListener("mouseup", handleMouseUpFallback);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("mousedown", onOutsideMousedown);
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
    document.removeEventListener("mouseup", handleMouseUpFallback);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("mousedown", onOutsideMousedown);
  });
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="selfRef"
      :style="floatingStyles"
      class="hl-menu"
      role="toolbar"
      aria-label="Annotation tools"
      tabindex="-1"
      @mouseup.stop
    >
      <div class="swatches" @mousedown.prevent>
        <button
          v-for="(color, name) in SWATCH_COLORS"
          :key="name"
          type="button"
          class="swatch-btn"
          :aria-label="`Highlight ${name}`"
          @click="onColorClick(name)"
        >
          <span class="swatch-circle" :style="{ backgroundColor: color }" />
        </button>
      </div>

      <div class="separator" aria-hidden="true" />

      <div class="annotation-actions" @mousedown.prevent>
        <Button
          kind="tertiary"
          size="sm"
          icon="Note"
          aria-label="Private note"
          title="Private note"
          @click="onCreateAnnotation('private')"
        />
        <Button
          kind="tertiary"
          size="sm"
          icon="Messages"
          aria-label="Shared comment"
          title="Shared comment"
          @click="onCreateAnnotation('shared')"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
  .hl-menu {
    position: fixed;
    background: var(--surface-page);
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 16px;
    padding: 6px 8px;
    box-shadow: var(--shadow-soft);
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 999;
    outline: none;
  }

  .swatches {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .swatch-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: var(--blue-100);
    }

    &:active {
      background-color: var(--blue-400);
    }

    &:focus-visible {
      outline: 2px solid var(--border-action);
      outline-offset: 2px;
    }
  }

  .swatch-circle {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: var(--border-extrathin) solid var(--gray-800);
    pointer-events: none;
  }

  .separator {
    width: 1px;
    height: 20px;
    background: var(--border-primary);
    flex-shrink: 0;
  }

  .annotation-actions {
    display: flex;
    align-items: center;
    gap: 0;

    & :deep(.tabler-icon) {
      color: var(--dark) !important;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
