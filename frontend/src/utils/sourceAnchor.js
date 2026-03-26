/**
 * sourceAnchor.js
 *
 * Annotation anchoring via Y.js RelativePositions. Anchors survive document
 * edits from any source (browser, CLI, collaboration) because they reference
 * CRDT item IDs instead of byte offsets.
 *
 * Extraction: DOM Range → find nearest data-source-start → compute Y.Text
 *             index → create Y.RelativePosition → serialize to JSON.
 *
 * Resolution: deserialize Y.RelativePosition → convert to absolute index →
 *             find paragraph by data-source-start range → compute DOM Range.
 */

import * as Y from "yjs";
import { resolveAnchor as legacyResolveAnchor } from "./anchorExtraction.js";

/**
 * Extract a source-anchored annotation from a DOM Range.
 *
 * Returns an anchor object with Y.js RelativePositions that survive edits,
 * plus backward-compatible fields (node_id, start_offset, end_offset).
 */
export function extractSourceAnchor(range, manuscriptEl, ytext) {
  if (!range || !manuscriptEl || !ytext) return null;

  const selectedText = range.toString();
  if (!selectedText) return null;

  // Find the nearest element with data-source-start for both start and end
  const startEl =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;
  const endEl =
    range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement
      : range.endContainer;

  if (!startEl || !endEl) return null;

  // Math elements are atomic: snap to full source range if selection is inside math
  const mathEl = startEl.closest("[data-source-start].math, [data-source-start][class*='math']");
  let sourceStart, sourceEnd;

  if (mathEl && manuscriptEl.contains(mathEl)) {
    sourceStart = parseInt(mathEl.getAttribute("data-source-start"), 10);
    sourceEnd = parseInt(mathEl.getAttribute("data-source-end"), 10);
  } else {
    sourceStart = computeSourceOffset(range.startContainer, range.startOffset, manuscriptEl);
    sourceEnd = computeSourceOffset(range.endContainer, range.endOffset, manuscriptEl);
  }

  if (sourceStart === null || sourceEnd === null) return null;
  if (sourceStart >= sourceEnd) return null;

  // Create Y.js RelativePositions
  const startRel = Y.createRelativePositionFromTypeIndex(ytext, sourceStart);
  const endRel = Y.createRelativePositionFromTypeIndex(ytext, sourceEnd);

  // Backward-compat: also extract node_id and rendered-text offsets
  const block = startEl.closest("[data-nodeid]");
  const nodeId = block?.getAttribute("data-nodeid") || null;
  const elementId = block?.getAttribute("id") || null;

  // Compute rendered-text offsets within the block for backward compat
  let startOffset = 0;
  let endOffset = 0;
  if (block) {
    const fullText = block.textContent;
    const idx = fullText.indexOf(selectedText);
    if (idx !== -1) {
      startOffset = idx;
      endOffset = idx + selectedText.length;
    }
  }

  return {
    type: "yjs_relative",
    start_relative: Y.relativePositionToJSON(startRel),
    end_relative: Y.relativePositionToJSON(endRel),
    source_start: sourceStart,
    source_end: sourceEnd,
    selected_text: selectedText,
    // Backward compat
    node_id: nodeId,
    element_id: elementId,
    start_offset: startOffset,
    end_offset: endOffset,
  };
}

/**
 * Compute the source byte offset for a position in the DOM.
 *
 * Walks up from the container to find the nearest element with
 * data-source-start, then adds the character offset within that element.
 * Rejects elements that are too broad (manuscript root) — the rendered-text
 * offset within the entire document is meaningless as a source offset
 * because whitespace normalization and markup stripping make them diverge.
 */
function computeSourceOffset(container, offset, manuscriptEl) {
  const el =
    container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  if (!el || !manuscriptEl.contains(el)) return null;

  // Find the nearest ancestor with data-source-start that isn't the manuscript root.
  // Walk up from the element, checking each ancestor.
  let sourceEl = el.closest("[data-source-start]");
  if (!sourceEl) return null;

  // Reject if the source element is the manuscript root or too broad
  // (class="manuscript" or no data-source-end, or covers the entire document)
  if (sourceEl.classList.contains("manuscript") || sourceEl === manuscriptEl) return null;

  const blockSourceStart = parseInt(sourceEl.getAttribute("data-source-start"), 10);
  const blockSourceEnd = parseInt(sourceEl.getAttribute("data-source-end") || "0", 10);

  // Sanity check: reject if the source range is unreasonably large (> 2000 chars)
  // This catches cases where we matched a section-level element instead of a paragraph
  if (blockSourceEnd - blockSourceStart > 2000) return null;

  // Compute character offset within this element's textContent
  const charOffset = computeCharOffsetInElement(sourceEl, container, offset);
  if (charOffset === null) return null;

  return blockSourceStart + charOffset;
}

/**
 * Compute the character offset of a specific text position within an element.
 */
function computeCharOffsetInElement(element, targetContainer, targetOffset) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let charCount = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    if (textNode === targetContainer) {
      return charCount + targetOffset;
    }
    charCount += textNode.textContent.length;
  }

  // targetContainer might be an element node (offset = child index)
  if (targetContainer.nodeType === Node.ELEMENT_NODE) {
    const childNodes = Array.from(targetContainer.childNodes);
    for (let i = 0; i < targetOffset && i < childNodes.length; i++) {
      charCount += (childNodes[i].textContent || "").length;
    }
    return charCount;
  }

  return null;
}

/**
 * Resolve a source anchor back to a DOM Range.
 *
 * For yjs_relative anchors: converts RelativePosition → absolute index →
 * finds paragraph by data-source-start → computes DOM Range.
 *
 * For legacy anchors (no type field): falls back to the old resolution.
 */
export function resolveSourceAnchor(anchorData, manuscriptEl, ydoc) {
  if (!anchorData || !manuscriptEl) return null;

  // Legacy anchors: use old resolution
  if (anchorData.type !== "yjs_relative") {
    return legacyResolveAnchor(anchorData, manuscriptEl);
  }

  if (!ydoc) return null;

  // Deserialize RelativePositions
  let absStart, absEnd;
  try {
    const relStart = Y.createRelativePositionFromJSON(anchorData.start_relative);
    const relEnd = Y.createRelativePositionFromJSON(anchorData.end_relative);
    absStart = Y.createAbsolutePositionFromRelativePosition(relStart, ydoc);
    absEnd = Y.createAbsolutePositionFromRelativePosition(relEnd, ydoc);
  } catch {
    return null;
  }

  if (!absStart || !absEnd) return null;

  const sourceStart = absStart.index;
  const sourceEnd = absEnd.index;

  if (sourceStart >= sourceEnd) return null;

  // Find the paragraph whose data-source-start/end range contains sourceStart
  const blocks = manuscriptEl.querySelectorAll("[data-source-start]");
  let targetBlock = null;
  let bestBlockStart = -1;

  for (const block of blocks) {
    const bStart = parseInt(block.getAttribute("data-source-start"), 10);
    const bEnd = parseInt(block.getAttribute("data-source-end"), 10);

    // Find the most specific (deepest/narrowest) block containing sourceStart
    if (bStart <= sourceStart && sourceEnd <= bEnd && bStart > bestBlockStart) {
      targetBlock = block;
      bestBlockStart = bStart;
    }
  }

  if (!targetBlock) return null;

  const blockSourceStart = parseInt(targetBlock.getAttribute("data-source-start"), 10);
  const charStart = sourceStart - blockSourceStart;
  const charEnd = sourceEnd - blockSourceStart;

  // Walk text nodes within the block to find the DOM Range
  return createRangeFromCharOffsets(targetBlock, charStart, charEnd);
}

/**
 * Create a DOM Range from character offsets within an element.
 */
function createRangeFromCharOffsets(element, startCharOffset, endCharOffset) {
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let charCount = 0;
  let startSet = false;

  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    const len = textNode.textContent.length;

    if (!startSet && charCount + len > startCharOffset) {
      range.setStart(textNode, startCharOffset - charCount);
      startSet = true;
    }
    if (startSet && charCount + len >= endCharOffset) {
      range.setEnd(textNode, endCharOffset - charCount);
      return range;
    }
    charCount += len;
  }

  return null;
}
