/**
 * Build anchor data from a DOM Range within a manuscript element.
 * Finds the nearest [data-nodeid] ancestor and computes character offsets.
 *
 * Math limitation: browsers prevent cross-boundary selections that start in
 * normal text and end inside MathML (or vice versa). A selection that begins
 * outside a <math> element cannot extend into it. Users must select entirely
 * within the equation or entirely outside it. When a math-internal selection
 * is anchored, the [data-nodeid] block is the <span class="math"> wrapper
 * itself, and the offsets span individual MathML text nodes (e.g. <mn>, <mo>).
 */
export function extractAnchor(range, manuscriptEl) {
  if (!range || !manuscriptEl) return null;

  const container =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;

  const block = container.closest("[data-nodeid]");
  if (!block || !manuscriptEl.contains(block)) return null;

  const nodeId = block.getAttribute("data-nodeid");
  const elementId = block.getAttribute("id") || null;
  const selectedText = range.toString();

  // Compute character offsets within the block's text content
  const treeWalker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let charCount = 0;
  let startOffset = 0;
  let endOffset = 0;
  let foundStart = false;
  let foundEnd = false;

  while (treeWalker.nextNode()) {
    const textNode = treeWalker.currentNode;
    const len = textNode.textContent.length;

    if (!foundStart && textNode === range.startContainer) {
      startOffset = charCount + range.startOffset;
      foundStart = true;
    }
    if (!foundEnd && textNode === range.endContainer) {
      endOffset = charCount + range.endOffset;
      foundEnd = true;
      break;
    }
    charCount += len;
  }

  if (!foundStart || !foundEnd) return null;

  return {
    node_id: nodeId,
    element_id: elementId,
    start_offset: startOffset,
    end_offset: endOffset,
    selected_text: selectedText,
  };
}

/**
 * Resolve anchor data back to a DOM Range within a manuscript element.
 */
export function resolveAnchor(anchorData, manuscriptEl) {
  if (!anchorData || !manuscriptEl) return null;

  // Find the block element
  let block = manuscriptEl.querySelector(`[data-nodeid="${anchorData.node_id}"]`);
  if (!block && anchorData.element_id) {
    block = manuscriptEl.querySelector(`#${CSS.escape(anchorData.element_id)}`);
  }
  if (!block) return null;

  const { start_offset, end_offset, selected_text } = anchorData;

  // Walk text nodes to find the range at the specified offsets
  const range = document.createRange();
  const treeWalker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let charCount = 0;
  let startSet = false;

  while (treeWalker.nextNode()) {
    const textNode = treeWalker.currentNode;
    const len = textNode.textContent.length;

    if (!startSet && charCount + len > start_offset) {
      range.setStart(textNode, start_offset - charCount);
      startSet = true;
    }
    if (startSet && charCount + len >= end_offset) {
      range.setEnd(textNode, end_offset - charCount);

      // Validate against stored text
      if (selected_text && range.toString() !== selected_text) {
        return resolveByTextSearch(block, selected_text);
      }
      return range;
    }
    charCount += len;
  }

  // Offset-based resolution failed — try text search
  if (selected_text) {
    return resolveByTextSearch(block, selected_text);
  }
  return null;
}

function resolveByTextSearch(block, searchText) {
  const treeWalker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (treeWalker.nextNode()) {
    textNodes.push(treeWalker.currentNode);
  }

  const fullText = textNodes.map((n) => n.textContent).join("");
  const idx = fullText.indexOf(searchText);
  if (idx === -1) return null;

  const range = document.createRange();
  let charCount = 0;
  let startSet = false;

  for (const textNode of textNodes) {
    const len = textNode.textContent.length;
    if (!startSet && charCount + len > idx) {
      range.setStart(textNode, idx - charCount);
      startSet = true;
    }
    if (startSet && charCount + len >= idx + searchText.length) {
      range.setEnd(textNode, idx + searchText.length - charCount);
      return range;
    }
    charCount += len;
  }
  return null;
}
