<script setup>
  import { ref, inject, onMounted, onUnmounted, useTemplateRef } from "vue";
  import { useFloating, autoUpdate, offset, flip, shift } from "@floating-ui/vue";
  import { extractAnchor } from "@/utils/anchorExtraction.js";
  import { SWATCH_COLORS } from "@/constants/annotationColors.js";

  const selfRef = useTemplateRef("selfRef");
  const noteInputRef = useTemplateRef("noteInputRef");
  const visible = ref(false);
  const virtualEl = ref(null);
  const currentAnchor = ref(null);
  const showNoteInput = ref(false);
  const inputText = ref("");
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
    showNoteInput.value = false;
    inputText.value = "";

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
    showNoteInput.value = false;
    inputText.value = "";
    visible.value = true;
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
  async function onColorClick(colorName) {
    if (!annotationActions || !currentAnchor.value) return;

    const anchor = currentAnchor.value;

    try {
      const annotation = await annotationActions.createAnnotation({
        color: colorName,
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
    } catch (err) {
      console.error("Failed to create annotation:", err);
    }

    clearSelection();
  }

  function onNoteClick() {
    showNoteInput.value = true;
    setTimeout(() => noteInputRef.value?.focus(), 0);
  }

  // Send button / Enter in the note input: commit with purple default
  async function onNoteSubmit() {
    await onColorClick("purple");
  }

  function onNoteKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.value.trim()) {
        onNoteSubmit();
      }
    }
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
  });
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" ref="selfRef" :style="floatingStyles" class="hl-menu" @mouseup.stop>
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

      <div class="separator" />

      <div v-if="!showNoteInput" class="note-trigger" @mousedown.prevent>
        <Button kind="tertiary" size="sm" icon="Message" @click="onNoteClick" />
      </div>

      <div v-else class="note-area">
        <textarea
          ref="noteInputRef"
          v-model="inputText"
          class="note-input"
          placeholder="Add a note..."
          rows="1"
          @keydown="onNoteKeydown"
        />
        <Button
          kind="tertiary"
          size="sm"
          icon="Send2"
          :disabled="!inputText.trim()"
          class="send-btn"
          @mousedown.prevent
          @click="onNoteSubmit"
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
    padding-block: 4px;
    padding-inline: 8px;
    box-shadow: var(--shadow-soft);
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 999;
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
  }

  .swatch-circle {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: var(--border-extrathin) solid var(--gray-700);
    pointer-events: none;
  }

  .separator {
    width: 1px;
    height: 20px;
    background: var(--border-primary);
    flex-shrink: 0;
  }

  .note-trigger {
    display: flex;
    align-items: center;

    & :deep(.tabler-icon) {
      color: var(--dark) !important;
    }
  }

  .note-area {
    display: flex;
    align-items: center;
    gap: 4px;

    & :deep(.tabler-icon) {
      color: var(--dark) !important;
    }
  }

  .note-input {
    width: 180px;
    min-height: 28px;
    max-height: 64px;
    padding: 4px 8px;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 12px;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.4;
    resize: none;
    outline: none;
    background-color: var(--surface-hover);
    color: var(--extra-dark);
    transition: var(--transition-bd-color);

    &:focus {
      border-color: var(--border-action);
    }

    &::placeholder {
      color: var(--medium);
      font-style: italic;
    }
  }

  .send-btn {
    flex-shrink: 0;
  }
</style>
