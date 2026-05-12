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
      if (!fs && tn === range.startContainer) { startOffset = cc + range.startOffset; fs = true; }
      if (fs && tn === range.endContainer) { endOffset = cc + range.endOffset; break; }
      cc += len;
    }
    if (!fs) {
      const idx = block.textContent.indexOf(selectedText);
      if (idx !== -1) { startOffset = idx; endOffset = idx + selectedText.length; }
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
 * Compute the SOURCE byte offset of a position within an element,
 * relative to that element's data-source-start.
 *
 * Walks child nodes. For children that have their own data-source-start/end,
 * uses the source byte length (not rendered text length) to advance the counter.
 * For bare text nodes, advances by text length (1:1 with source for plain text).
 */
function computeCharOffsetInElement(element, targetContainer, targetOffset) {
  const blockStart = parseInt(element.getAttribute("data-source-start") || "0", 10);

  // RSM emits handrail UI zones (`.hr-*-zone` siblings of `.hr-content-zone`)
  // inside every source-mapped block. These zones contain icons, menus, and
  // decorative spacers whose text content does NOT come from the manuscript
  // source. The newlines between these sibling divs in the rendered markup
  // also count as text nodes but are not source content. Counting any of
  // this inflates the offset and pushes source_start past the source length.
  //
  // Strategy: when the source-mapped element wraps a handrail block (i.e.
  // it has a direct `.hr-content-zone` child), narrow the walk to that
  // content zone — the only subtree whose text is 1:1 with the source.
  const HANDRAIL_UI_CLASSES = new Set([
    "hr-collapse-zone",
    "hr-menu-zone",
    "hr-border-zone",
    "hr-spacer-zone",
    "hr-info-zone",
  ]);

  function findContentZone(el) {
    if (!el || !el.children) return null;
    for (const child of el.children) {
      if (child.classList?.contains("hr-content-zone")) return child;
    }
    return null;
  }

  function isHandrailUiZone(node) {
    if (node.nodeType !== Node.ELEMENT_NODE || !node.classList) return false;
    for (const cls of HANDRAIL_UI_CLASSES) {
      if (node.classList.contains(cls)) return true;
    }
    return false;
  }

  // Walk direct and nested children, tracking source bytes
  function walk(node) {
    // Skip RSM handrail UI zones — their text is decorative, not source.
    if (isHandrailUiZone(node)) {
      return { found: false, chars: 0 };
    }

    // If this element has its own source data, use source byte length
    if (node !== element && node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("data-source-start")) {
      const srcStart = parseInt(node.getAttribute("data-source-start"), 10);
      const srcEnd = parseInt(node.getAttribute("data-source-end"), 10);

      // Check if target is inside this element
      if (node.contains(targetContainer)) {
        // Target is inside a source-mapped inline element — delegate to it
        return { found: true, offset: (srcStart - blockStart) + computeInner(node, targetContainer, targetOffset) };
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

  // For handrail blocks, narrow the walk root to the element inside the
  // content zone that wraps the target (usually a <p>, <h1>, etc.). RSM
  // separates handrail UI siblings from a single `.hr-content-zone` whose
  // first element child holds the actual source-equivalent prose.
  // Walking only that element skips both the UI siblings AND the formatting
  // whitespace text nodes between them.
  const contentZone = findContentZone(element);
  let walkRoot = element;
  if (contentZone && contentZone.contains(targetContainer)) {
    for (const child of contentZone.children) {
      if (child.contains(targetContainer)) {
        walkRoot = child;
        break;
      }
    }
    // Fallback: target is in contentZone but not inside any element child
    if (walkRoot === element) walkRoot = contentZone;
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

  // Math elements: wrap the entire element instead of character-level ranging.
  // The source bytes are LaTeX ($x^2$) but the DOM contains MathML — offsets don't correspond.
  if (targetBlock.classList.contains("math") || targetBlock.querySelector("math")) {
    const range = document.createRange();
    range.selectNode(targetBlock);
    return range;
  }

  const blockSourceStart = parseInt(targetBlock.getAttribute("data-source-start"), 10);
  const charStart = sourceStart - blockSourceStart;
  const charEnd = sourceEnd - blockSourceStart;

  // Resolve against the actual content subtree, not the whole handrail
  // wrapper. The wrapper also contains UI siblings (`.hr-*-zone`) whose
  // text content is not part of the source — counting them shifts the
  // resolved range away from the originally-anchored text.
  const resolveRoot = findResolutionRoot(targetBlock);
  return createRangeFromCharOffsets(resolveRoot, charStart, charEnd);
}

/**
 * Find the subtree of a source-mapped block whose text content corresponds
 * 1:1 with the source bytes. For RSM handrail-wrapped elements this is the
 * first element child of `.hr-content-zone`; for other elements it is the
 * element itself.
 */
function findResolutionRoot(block) {
  if (!block || !block.children) return block;
  for (const child of block.children) {
    if (child.classList?.contains("hr-content-zone")) {
      for (const inner of child.children) {
        return inner;
      }
      return child;
    }
  }
  return block;
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
