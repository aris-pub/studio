<script setup>
  import { ref, shallowRef, inject, computed, onMounted, onUnmounted, useTemplateRef, nextTick } from "vue";
  import { useFloating, autoUpdate, offset, flip, shift } from "@floating-ui/vue";
  import { extractAnchor } from "@/utils/anchorExtraction.js";
  import { extractSourceAnchor } from "@/utils/sourceAnchor.js";
  import { SWATCH_COLORS } from "@/constants/annotationColors.js";

  const selfRef = useTemplateRef("selfRef");
  const visible = ref(false);
  const virtualEl = ref(null);
  const currentAnchor = ref(null);
  const selectedColor = ref("purple");
  let anchorRect = null;

  const annotationActions = inject("annotationActions", null);
  const ydoc = inject("ydoc", shallowRef(null));
  const ytext = computed(() => ydoc.value?.getText("text") || null);
  const activeAnnotationId = inject("activeAnnotationId", ref(null));

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
    selectedColor.value = "purple";

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

    const manuscriptEl = getManuscriptEl();
    const anchor = ytext.value
      ? extractSourceAnchor(range, manuscriptEl, ytext.value)
      : extractAnchor(range, manuscriptEl);
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

  function buildAnchorData(anchor) {
    return anchor.type === "yjs_relative"
      ? {
          type: anchor.type,
          node_id: anchor.node_id,
          element_id: anchor.element_id,
          start_offset: anchor.start_offset,
          end_offset: anchor.end_offset,
          start_relative: anchor.start_relative,
          end_relative: anchor.end_relative,
          source_start: anchor.source_start,
          source_end: anchor.source_end,
        }
      : {
          node_id: anchor.node_id,
          element_id: anchor.element_id,
          start_offset: anchor.start_offset,
          end_offset: anchor.end_offset,
        };
  }

  function onSwatchSelect(name) {
    selectedColor.value = name;
  }

  function onSwatchKeydown(e) {
    const names = Object.keys(SWATCH_COLORS);
    const idx = names.indexOf(selectedColor.value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      selectedColor.value = names[(idx + 1) % names.length];
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      selectedColor.value = names[(idx - 1 + names.length) % names.length];
    }
  }

  async function onHighlight() {
    if (!annotationActions || !currentAnchor.value) return;
    try {
      await annotationActions.createAnnotation({
        color: selectedColor.value,
        anchorData: buildAnchorData(currentAnchor.value),
        selectedText: currentAnchor.value.selected_text,
      });
    } catch (err) {
      console.error("Failed to create highlight:", err);
    }
    clearSelection();
  }

  async function onCreateAnnotation(visibility) {
    if (!annotationActions || !currentAnchor.value) return;
    try {
      const annotation = await annotationActions.createAnnotation({
        color: selectedColor.value,
        visibility,
        anchorData: buildAnchorData(currentAnchor.value),
        selectedText: currentAnchor.value.selected_text,
      });
      clearSelection();
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
      <div class="swatches" role="radiogroup" aria-label="Highlight color" @mousedown.prevent @keydown="onSwatchKeydown">
        <button
          v-for="(color, name) in SWATCH_COLORS"
          :key="name"
          type="button"
          role="radio"
          class="swatch-btn"
          :aria-checked="selectedColor === name"
          :aria-label="`${name} color`"
          :tabindex="selectedColor === name ? 0 : -1"
          @click="onSwatchSelect(name)"
        >
          <span
            class="swatch-circle"
            :style="{
              backgroundColor: color,
              boxShadow: selectedColor === name
                ? `0 0 0 2px var(--surface-page), 0 0 0 4px var(--${name}-500)`
                : 'none'
            }"
          />
        </button>
      </div>

      <div class="separator" aria-hidden="true" />

      <div class="annotation-actions" @mousedown.prevent>
        <Button
          kind="tertiary"
          size="sm"
          icon="Highlight"
          text="Highlight"
          @click="onHighlight"
        />
        <Button
          kind="tertiary"
          size="sm"
          icon="Note"
          text="Note"
          @click="onCreateAnnotation('private')"
        />
        <Button
          kind="tertiary"
          size="sm"
          icon="Messages"
          text="Comment"
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
      background-color: var(--gray-100);
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
    transition: box-shadow 0.15s ease;
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
  }
</style>
