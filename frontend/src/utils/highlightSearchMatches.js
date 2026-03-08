export const highlightClass = "aris-search-highlight";
export const currentHighlightClass = "aris-search-highlight--current";
export const mathContainerClass = "aris-search-math-container";

const MATH_CONTAINER_SELECTOR = "span.math, div.mathblock";

function isInsideMath(node) {
  return !!node.closest?.(MATH_CONTAINER_SELECTOR) || !!node.parentNode?.closest?.(MATH_CONTAINER_SELECTOR);
}

export function clearHighlights(rootEl) {
  // Clear <mark> highlights (document scope)
  const marks = rootEl.querySelectorAll(`mark.${highlightClass}, mark.${currentHighlightClass}`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    const fragment = document.createDocumentFragment();
    while (mark.firstChild) {
      fragment.appendChild(mark.firstChild);
    }
    parent.replaceChild(fragment, mark);
  }
  rootEl.normalize();

  // Clear math highlights (class applied directly to MathML elements)
  const mathHits = rootEl.querySelectorAll(`.${highlightClass}, .${currentHighlightClass}`);
  for (const el of mathHits) {
    el.classList.remove(highlightClass, currentHighlightClass);
  }

  // Clear container wash
  const containers = rootEl.querySelectorAll(`.${mathContainerClass}`);
  for (const el of containers) {
    el.classList.remove(mathContainerClass);
  }
}

/**
 * Updates the current search match to have special highlighting
 * @param {Array} matches - Array of match objects
 * @param {number} currentIndex - Index of the current match to highlight
 */
export function updateCurrentMatch(matches, currentIndex) {
  // Remove current highlight class from all matches
  matches.forEach((match) => {
    if (match.mathEls) {
      for (const el of match.mathEls) {
        el.classList.remove(currentHighlightClass);
        el.classList.add(highlightClass);
      }
    } else if (match.mark) {
      match.mark.classList.remove(currentHighlightClass);
      match.mark.classList.add(highlightClass);
    }
  });

  // Add current highlight class to the current match
  if (currentIndex >= 0 && currentIndex < matches.length) {
    const current = matches[currentIndex];
    if (current.mathEls) {
      for (const el of current.mathEls) {
        el.classList.remove(highlightClass);
        el.classList.add(currentHighlightClass);
      }
    } else if (current.mark) {
      current.mark.classList.remove(highlightClass);
      current.mark.classList.add(currentHighlightClass);
    }
  }
}

/**
 * Highlights text matches across multiple DOM nodes
 * @param {Element} rootEl - The root element to search within
 * @param {string} searchTerm - The text to search for
 * @param {Object} options - Configuration options
 * @param {boolean} options.caseSensitive - Whether search should be case-sensitive (default: false)
 * @param {boolean} options.wholeWord - Match whole words only (default: false)
 * @returns {number} - Count of matches found
 */
export function highlightSearchMatches(rootEl, searchTerm, options = {}) {
  const { caseSensitive = false, wholeWord = false } = options;
  if (!rootEl || !searchTerm || searchTerm.trim() === "") return 0;

  // Setup TreeWalker to find all text nodes (skipping math containers)
  const treeWalker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ALL, {
    acceptNode: (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName === "SCRIPT" || node.nodeName === "STYLE") return NodeFilter.FILTER_REJECT;
        if (node.matches?.(MATH_CONTAINER_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      // Text node checks
      const parent = node.parentNode;
      if (
        !node.textContent.trim() ||
        (parent.nodeName === "MARK" &&
          (parent.classList.contains(highlightClass) ||
            parent.classList.contains(currentHighlightClass)))
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // Collect all text nodes and their position data
  const nodeInfo = [];
  let currentPosition = 0;
  let node;
  while ((node = treeWalker.nextNode())) {
    const length = node.textContent.length;
    nodeInfo.push({
      node,
      start: currentPosition,
      end: currentPosition + length,
    });
    currentPosition += length;
  }

  // If no text nodes found, exit
  if (nodeInfo.length === 0) {
    return 0;
  }

  // Combine all text for searching
  const fullText = nodeInfo.map((info) => info.node.textContent).join("");

  // Prepare search term and text for matching
  const searchFor = caseSensitive ? searchTerm : searchTerm.toLowerCase();
  const searchIn = caseSensitive ? fullText : fullText.toLowerCase();

  // Create regex pattern for whole word search if needed
  let searchRegex = null;
  if (wholeWord) {
    const escapedTerm = searchFor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    searchRegex = new RegExp(`\\b${escapedTerm}\\b`, caseSensitive ? "g" : "gi");
  }

  // Find all matches
  const matches = [];

  if (wholeWord && searchRegex) {
    let match;
    while ((match = searchRegex.exec(searchIn)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        mark: null,
      });
    }
  } else {
    let startIndex = 0;
    while ((startIndex = searchIn.indexOf(searchFor, startIndex)) !== -1) {
      matches.push({
        start: startIndex,
        end: startIndex + searchFor.length,
        mark: null,
      });
      startIndex += searchFor.length;
    }
  }

  // Early return if no matches
  if (matches.length === 0) return 0;

  // Process matches in reverse order to avoid offset issues when modifying the DOM
  matches.sort((a, b) => b.start - a.start);

  for (const match of matches) {
    try {
      // Find nodes containing the start and end of match
      let startNodeInfo = null;
      let endNodeInfo = null;

      for (const info of nodeInfo) {
        if (match.start >= info.start && match.start < info.end) {
          startNodeInfo = info;
        }
        if (match.end > info.start && match.end <= info.end) {
          endNodeInfo = info;
        }
        if (startNodeInfo && endNodeInfo) {
          break;
        }
      }

      // Skip if we can't find the nodes
      if (!startNodeInfo || !endNodeInfo) continue;

      // Create a range for the match and skip if it is collapsed
      const range = document.createRange();
      range.setStart(startNodeInfo.node, match.start - startNodeInfo.start);
      range.setEnd(endNodeInfo.node, match.end - endNodeInfo.start);
      if (range.collapsed) continue;

      // Create highlight element
      const mark = document.createElement("mark");
      mark.className = highlightClass;

      // Try to surround with the highlight
      try {
        range.surroundContents(mark);
      } catch {
        // Handle case where match spans multiple nodes
        if (startNodeInfo !== endNodeInfo) {
          // Extract and highlight content in multiple fragments
          const fragment = range.extractContents();
          mark.appendChild(fragment);
          range.insertNode(mark);
        }
      }
      match.mark = mark;

      // Update node info to reflect changes to the DOM
      // We're processing in reverse order, so only need to update the current match
      for (let i = 0; i < nodeInfo.length; i++) {
        const info = nodeInfo[i];
        if (info.end > match.start) {
          // Update any node whose range is affected by this match
          if (info === startNodeInfo) {
            info.node = mark.firstChild || mark.nextSibling || mark.previousSibling;
          } else if (info === endNodeInfo && startNodeInfo !== endNodeInfo) {
            info.node = mark.lastChild || mark.nextSibling || mark.previousSibling;
          }
        }
      }
    } catch (e) {
      console.error("Error highlighting match:", e);
    }
  }

  // Need to reverse since we traversed the document backwards
  return matches.toReversed();
}

/**
 * Highlights search matches inside math containers (span.math, div.mathblock).
 * Applies highlight class directly to MathML leaf elements rather than wrapping in <mark>.
 */
export function highlightMathMatches(rootEl, searchTerm, options = {}) {
  const { caseSensitive = false } = options;
  if (!rootEl || !searchTerm || searchTerm.trim() === "") return [];

  const containers = rootEl.querySelectorAll(MATH_CONTAINER_SELECTOR);
  if (containers.length === 0) return [];

  const searchFor = caseSensitive ? searchTerm : searchTerm.toLowerCase();
  const matches = [];

  for (const container of containers) {
    // Only search inside <math> elements (skip handrail zones, error spans, etc.)
    const mathEl = container.querySelector("math");
    if (!mathEl) continue;

    const leaves = [];
    const walker = document.createTreeWalker(mathEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    let textNode;
    while ((textNode = walker.nextNode())) {
      leaves.push({ node: textNode, parent: textNode.parentElement });
    }
    if (leaves.length === 0) continue;

    // Build concatenated text and position map
    const segments = [];
    let pos = 0;
    for (const leaf of leaves) {
      const text = leaf.node.textContent;
      segments.push({ leaf, start: pos, end: pos + text.length });
      pos += text.length;
    }
    const fullText = leaves.map((l) => l.node.textContent).join("");
    const searchIn = caseSensitive ? fullText : fullText.toLowerCase();

    // Find matches in this container's rendered text
    let idx = 0;
    while ((idx = searchIn.indexOf(searchFor, idx)) !== -1) {
      const matchEnd = idx + searchFor.length;

      const els = [];
      for (const seg of segments) {
        if (seg.end > idx && seg.start < matchEnd && seg.leaf.parent) {
          if (!els.includes(seg.leaf.parent)) {
            els.push(seg.leaf.parent);
          }
        }
      }

      if (els.length > 0) {
        for (const el of els) el.classList.add(highlightClass);
        container.classList.add(mathContainerClass);
        matches.push({ mark: els[0], mathEls: els });
      }

      idx += searchFor.length;
    }
  }

  return matches;
}

export function highlightSearchMatchesSource(sourceText, searchString) {
  if (!searchString.trim() || !sourceText) {
    return [];
  }

  const matches = [];
  const regex = new RegExp(escapeRegExp(searchString), "gi");
  let match;

  while ((match = regex.exec(sourceText)) !== null) {
    matches.push({
      index: match.index,
      text: match[0],
      line: getLineNumber(sourceText, match.index),
      column: getColumnNumber(sourceText, match.index),
    });
  }

  return matches;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLineNumber(text, index) {
  return text.substring(0, index).split("\n").length;
}

function getColumnNumber(text, index) {
  const lines = text.substring(0, index).split("\n");
  return lines[lines.length - 1].length + 1;
}
