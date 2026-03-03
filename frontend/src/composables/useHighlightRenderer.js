import { watch, nextTick, isRef } from "vue";
import { resolveAnchor } from "@/utils/anchorExtraction.js";
import { HIGHLIGHT_COLORS } from "@/constants/annotationColors.js";

export function useHighlightRenderer(annotations, manuscriptRef, activeAnnotationId) {
  function clearHighlights(root) {
    if (!root) return;
    const marks = root.querySelectorAll("mark[data-annotation-id]");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    });
    // Remove highlight styling from math elements
    root.querySelectorAll("[data-highlight-annotation]").forEach((el) => {
      el.style.removeProperty("background-color");
      el.style.removeProperty("border-radius");
      el.style.removeProperty("--mark-border");
      el.removeAttribute("data-highlight-annotation");
    });
  }

  // Apply highlight styling to an entire math element. We style the whole
  // equation because <mark> elements inside MathML break rendering.
  function styleMath(container, annId, colors) {
    const mathTarget = container.querySelector("math");
    const target = mathTarget?.style ? mathTarget : container;
    target.style.backgroundColor = colors.bg;
    target.style.borderRadius = "2px";
    target.style.setProperty("--mark-border", colors.border);
    target.setAttribute("data-highlight-annotation", annId);
  }

  // Wrap a range in <mark> element(s). Three strategies depending on content:
  //
  // 1. Range inside math → non-destructive inline styling on the whole equation.
  //    Inserting <mark> inside MathML breaks rendering, so math elements are
  //    treated as atomic units: even a partial selection highlights the entire
  //    equation. This matches Google Docs / Notion behavior.
  //
  // 2. Cross-boundary, no math → extractContents for one contiguous mark.
  //
  // 3. Cross-boundary with math → per-text-node marks + inline math styling.
  //
  // NOTE: Browsers do not allow cross-boundary selections that start in normal
  // text and end inside MathML (or vice versa). Users must select entirely
  // within the math element or entirely outside it. This is a Chromium/WebKit
  // limitation, not something we can work around in JS.
  function wrapRange(range, mark, colors) {
    const annId = mark.getAttribute("data-annotation-id");

    // Case 1: range entirely inside a math element — style the whole equation
    const startEl =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer;
    if (startEl?.closest("math")) {
      const container =
        startEl.closest("span.math") || startEl.closest(".mathblock") || startEl.closest("math");
      styleMath(container, annId, colors);
      return;
    }

    // Case 2: simple range — no partial elements
    try {
      range.surroundContents(mark);
      mark.querySelectorAll("span.math, .mathblock").forEach((m) => styleMath(m, annId, colors));
      return;
    } catch {
      // Range crosses element boundaries — fall through
    }

    // Walk the range to detect math and collect text nodes
    const ancestor =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;

    const mathEls = new Set();
    const wrapTargets = [];
    const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!range.intersectsNode(node)) continue;

      const mathParent = node.parentElement?.closest("span.math, .mathblock, math");
      if (mathParent) {
        mathEls.add(mathParent.closest("span.math") || mathParent);
      } else {
        let sliceStart = 0;
        let sliceEnd = node.textContent.length;
        if (node === startContainer) sliceStart = startOffset;
        if (node === endContainer) sliceEnd = endOffset;
        if (sliceStart < sliceEnd) {
          wrapTargets.push({ node, sliceStart, sliceEnd });
        }
      }
    }

    if (mathEls.size === 0) {
      // Case 2b: no math — extractContents for single contiguous mark
      const contents = range.extractContents();
      mark.appendChild(contents);
      range.insertNode(mark);
      return;
    }

    // Case 3: math present — wrap text nodes individually, style math inline
    for (const mathEl of mathEls) {
      styleMath(mathEl, annId, colors);
    }
    for (const { node, sliceStart, sliceEnd } of wrapTargets) {
      const nodeRange = document.createRange();
      nodeRange.setStart(node, sliceStart);
      nodeRange.setEnd(node, sliceEnd);
      const m = mark.cloneNode(false);
      try {
        nodeRange.surroundContents(m);
      } catch {
        // Skip nodes that can't be wrapped
      }
    }
  }

  function applyHighlights() {
    const el = manuscriptRef.value?.$el || manuscriptRef.value;
    if (!el) return;

    clearHighlights(el);

    const list = isRef(annotations) ? annotations.value : annotations;
    // Process newest first so their marks become inner elements in overlapping
    // regions. Inner marks' backgrounds visually override outer marks', so the
    // most recent annotation's color wins in the overlap.
    const sorted = [...list].sort((a, b) => b.id - a.id);
    for (const annotation of sorted) {
      if (!annotation.anchor_data) continue;

      const anchorData = {
        ...annotation.anchor_data,
        selected_text: annotation.selected_text,
      };
      const range = resolveAnchor(anchorData, el);
      if (!range) continue;

      const mark = document.createElement("mark");
      mark.setAttribute("data-annotation-id", annotation.id);
      const colors = HIGHLIGHT_COLORS[annotation.color] || HIGHLIGHT_COLORS.purple;
      mark.style.backgroundColor = colors.bg;
      mark.style.setProperty("--mark-border", colors.border);
      mark.style.borderRadius = "2px";
      mark.style.cursor = "pointer";

      if (activeAnnotationId?.value === annotation.id) {
        mark.classList.add("active");
      }

      wrapRange(range, mark, colors);
    }
  }

  function handleMarkClick(event) {
    const mark = event.target.closest("mark[data-annotation-id]");
    const mathHighlight = event.target.closest("[data-highlight-annotation]");
    const annId =
      mark?.getAttribute("data-annotation-id") ||
      mathHighlight?.getAttribute("data-highlight-annotation");
    if (!annId || !activeAnnotationId) return;
    activeAnnotationId.value = parseInt(annId, 10);
  }

  // JS-based hover: highlight ALL marks/math-highlights sharing the same
  // annotation ID so fragmented marks (from overlapping annotations) light
  // up as a single unit. Uses the innermost mark under the cursor.
  let hoveredAnnId = null;

  function handleHover(event) {
    const mark = event.target.closest("mark[data-annotation-id]");
    const mathHl = event.target.closest("[data-highlight-annotation]");
    const annId =
      mark?.getAttribute("data-annotation-id") ||
      mathHl?.getAttribute("data-highlight-annotation") ||
      null;

    if (annId === hoveredAnnId) return;

    const el = manuscriptRef.value?.$el || manuscriptRef.value;
    if (!el) return;

    if (hoveredAnnId) {
      el.querySelectorAll(".hover[data-annotation-id], .hover[data-highlight-annotation]").forEach(
        (m) => m.classList.remove("hover"),
      );
    }

    hoveredAnnId = annId;

    if (hoveredAnnId) {
      el.querySelectorAll(`mark[data-annotation-id="${hoveredAnnId}"]`).forEach((m) =>
        m.classList.add("hover"),
      );
      el.querySelectorAll(`[data-highlight-annotation="${hoveredAnnId}"]`).forEach((m) =>
        m.classList.add("hover"),
      );
    }
  }

  function handleHoverLeave() {
    if (!hoveredAnnId) return;
    const el = manuscriptRef.value?.$el || manuscriptRef.value;
    if (!el) return;
    el.querySelectorAll(".hover").forEach((m) => m.classList.remove("hover"));
    hoveredAnnId = null;
  }

  function setupClickHandler() {
    const el = manuscriptRef.value?.$el || manuscriptRef.value;
    if (!el) return;
    el.addEventListener("click", handleMarkClick);
    el.addEventListener("mouseover", handleHover);
    el.addEventListener("mouseleave", handleHoverLeave);
    return () => {
      el.removeEventListener("click", handleMarkClick);
      el.removeEventListener("mouseover", handleHover);
      el.removeEventListener("mouseleave", handleHoverLeave);
    };
  }

  watch(
    annotations,
    async () => {
      await nextTick();
      applyHighlights();
    },
    { deep: true }
  );

  if (activeAnnotationId) {
    watch(activeAnnotationId, () => {
      const el = manuscriptRef.value?.$el || manuscriptRef.value;
      if (!el) return;
      el.querySelectorAll("mark[data-annotation-id]").forEach((mark) => {
        const id = parseInt(mark.getAttribute("data-annotation-id"), 10);
        mark.classList.toggle("active", id === activeAnnotationId.value);
      });
      el.querySelectorAll("[data-highlight-annotation]").forEach((mathEl) => {
        const id = parseInt(mathEl.getAttribute("data-highlight-annotation"), 10);
        mathEl.classList.toggle("active", id === activeAnnotationId.value);
      });
    });
  }

  return { applyHighlights, clearHighlights, setupClickHandler };
}
