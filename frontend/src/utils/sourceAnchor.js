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

  // Compute rendered-text offsets within the block for backward compat.
  // Use tree-walker to match exact Range containers (handles duplicate text).
  let startOffset = 0;
  let endOffset = 0;
  if (block) {
    const tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let cc = 0;
    let fs = false;
    while (tw.nextNode()) {
      const tn = tw.currentNode;
      const len = tn.textContent.length;
      if (!fs && tn === range.startContainer) {
        startOffset = cc + range.startOffset;
        fs = true;
      }
      if (fs && tn === range.endContainer) {
        endOffset = cc + range.endOffset;
        break;
      }
      cc += len;
    }
    if (!fs) {
      const idx = block.textContent.indexOf(selectedText);
      if (idx !== -1) {
        startOffset = idx;
        endOffset = idx + selectedText.length;
      }
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
 * The real content of a handrail block lives in its .hr-content-zone, next to
 * chrome zones (hr-collapse/menu/border/spacer/info) that carry their own text.
 * Offsets must be computed over the content only. Inline spans have no content
 * zone, so they are their own content root.
 */
function getContentRoot(sourceEl) {
  return sourceEl.querySelector(":scope > .hr-content-zone") || sourceEl;
}

/**
 * Compute the source byte offset for a position in the DOM.
 *
 * Walks up from the container to find the nearest element with
 * data-source-start, then adds the character offset within that element's
 * content zone. Rejects elements that are too broad (manuscript root) — the
 * rendered-text offset within the entire document is meaningless as a source
 * offset because whitespace normalization and markup stripping make them diverge.
 */
function computeSourceOffset(container, offset, manuscriptEl) {
  const el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  if (!el || !manuscriptEl.contains(el)) return null;

  // Find the nearest ancestor with data-source-start that isn't the manuscript root.
  // Walk up from the element, checking each ancestor.
  const sourceEl = el.closest("[data-source-start]");
  if (!sourceEl) return null;

  // Reject if the source element is the manuscript root or too broad
  // (class="manuscript" or no data-source-end, or covers the entire document)
  if (sourceEl.classList.contains("manuscript") || sourceEl === manuscriptEl) return null;

  const blockSourceStart = parseInt(sourceEl.getAttribute("data-source-start"), 10);
  const blockSourceEnd = parseInt(sourceEl.getAttribute("data-source-end") || "0", 10);

  // Sanity check: reject if the source range is unreasonably large (> 2000 chars)
  // This catches cases where we matched a section-level element instead of a paragraph
  if (blockSourceEnd - blockSourceStart > 2000) return null;

  // Walk only the content, not the handrail chrome. Counting the chrome text as
  // source characters was the drift (about +108 characters per block).
  const walkRoot = getContentRoot(sourceEl);
  const charOffset = computeCharOffsetInElement(walkRoot, blockSourceStart, container, offset);
  if (charOffset === null) return null;

  return blockSourceStart + charOffset;
}

/**
 * Compute the SOURCE byte offset of a position within an element,
 * relative to that element's data-source-start.
 *
 * Walks child nodes. For children that have their own data-source-start/end,
 * uses the source byte length (not rendered text length) to advance the counter.
 * For bare text nodes, advances by text length (1:1 with source for plain text).
 */
function computeCharOffsetInElement(walkRoot, blockStart, targetContainer, targetOffset) {
  // Walk direct and nested children, tracking source bytes
  function walk(node) {
    // If this element has its own source data, use source byte length
    if (
      node !== walkRoot &&
      node.nodeType === Node.ELEMENT_NODE &&
      node.hasAttribute("data-source-start")
    ) {
      const srcStart = parseInt(node.getAttribute("data-source-start"), 10);
      const srcEnd = parseInt(node.getAttribute("data-source-end"), 10);

      // Check if target is inside this element
      if (node.contains(targetContainer)) {
        // Target is inside a source-mapped inline element — delegate to it
        return {
          found: true,
          offset: srcStart - blockStart + computeInner(node, targetContainer, targetOffset),
        };
      }
      // Skip this subtree, advance by source byte length
      return { found: false, chars: srcEnd - srcStart };
    }

    if (node.nodeType === Node.TEXT_NODE) {
      if (node === targetContainer) {
        return { found: true, offset: targetOffset };
      }
      return { found: false, chars: node.textContent.length };
    }

    // Element without source data — walk children
    let total = 0;
    for (const child of node.childNodes) {
      const result = walk(child);
      if (result.found) {
        return { found: true, offset: total + result.offset };
      }
      total += result.chars;
    }

    // targetContainer is this element node (offset = child index)
    if (node === targetContainer) {
      let count = 0;
      const children = Array.from(node.childNodes);
      for (let i = 0; i < targetOffset && i < children.length; i++) {
        count += (children[i].textContent || "").length;
      }
      return { found: true, offset: count };
    }

    return { found: false, chars: total };
  }

  const result = walk(walkRoot);
  return result.found ? result.offset : null;
}

function computeInner(element, targetContainer, targetOffset) {
  // Simple offset within an inline element (no nested source-mapped children expected)
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let charCount = 0;
  while (walker.nextNode()) {
    if (walker.currentNode === targetContainer) return charCount + targetOffset;
    charCount += walker.currentNode.textContent.length;
  }
  return 0;
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
    // Fall through to legacy
  }

  // Y.Doc not synced yet or positions deleted — fall back to legacy
  if (!absStart || !absEnd) {
    if (anchorData.node_id) {
      return legacyResolveAnchor(anchorData, manuscriptEl);
    }
    return null;
  }

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

  // Atomic math: the block IS a math element (inline span.math or a mathblock),
  // whose source is LaTeX ($x^2$) while the DOM is MathML, so character ranging is
  // meaningless. Wrap the whole element. A paragraph that merely CONTAINS inline
  // math is NOT atomic (it has a <math> descendant but its own class is
  // "paragraph"), so it must fall through to source-offset ranging. Checking for a
  // <math> descendant here was the bug that wrapped whole math-bearing paragraphs.
  const isAtomicMath =
    targetBlock.classList.contains("math") ||
    targetBlock.classList.contains("mathblock") ||
    targetBlock.tagName.toLowerCase() === "math";
  if (isAtomicMath) {
    const range = document.createRange();
    range.selectNode(targetBlock);
    return range;
  }

  const blockSourceStart = parseInt(targetBlock.getAttribute("data-source-start"), 10);
  const charStart = sourceStart - blockSourceStart;
  const charEnd = sourceEnd - blockSourceStart;

  // Resolve within the content zone (skip handrail chrome), advancing the source
  // cursor past inline source-mapped spans by their SOURCE length so the mapping
  // stays symmetric with extraction.
  return createRangeFromSourceOffsets(getContentRoot(targetBlock), charStart, charEnd);
}

/**
 * Create a DOM Range from SOURCE offsets within a content root.
 *
 * Mirrors computeCharOffsetInElement: plain text advances the source cursor by
 * rendered length (1:1 with source), and inline source-mapped spans advance by
 * their source byte length. Handrail chrome is not present in the content root.
 */
function createRangeFromSourceOffsets(root, startSrc, endSrc) {
  const range = document.createRange();
  let cursor = 0;
  let startSet = false;
  let endSet = false;

  function walk(node) {
    if (
      node !== root &&
      node.nodeType === Node.ELEMENT_NODE &&
      node.hasAttribute("data-source-start")
    ) {
      const s = parseInt(node.getAttribute("data-source-start"), 10);
      const e = parseInt(node.getAttribute("data-source-end"), 10);
      const srcLen = e - s;
      if (!startSet && cursor + srcLen > startSrc) {
        range.setStart(node, 0);
        startSet = true;
      }
      if (startSet && cursor + srcLen >= endSrc) {
        range.setEnd(node, node.childNodes.length);
        endSet = true;
        return true;
      }
      cursor += srcLen;
      return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length;
      if (!startSet && cursor + len > startSrc) {
        range.setStart(node, Math.max(0, startSrc - cursor));
        startSet = true;
      }
      if (startSet && cursor + len >= endSrc) {
        range.setEnd(node, Math.min(len, endSrc - cursor));
        endSet = true;
        return true;
      }
      cursor += len;
      return false;
    }

    for (const child of node.childNodes) {
      if (walk(child)) return true;
    }
    return false;
  }

  walk(root);
  return startSet && endSet ? range : null;
}
