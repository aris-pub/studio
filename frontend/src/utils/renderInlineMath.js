/**
 * Render $...$ inline math in plain text strings using Temml.
 * Returns an HTML string safe for v-html — non-math segments are HTML-escaped.
 */

import temml from "temml";

const INLINE_MATH_RE = /\$([^$]+)\$/g;

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderInlineMath(text) {
  if (!text) return "";

  let result = "";
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_MATH_RE)) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    try {
      result += temml.renderToString(match[1], { displayMode: false });
    } catch {
      result += escapeHtml(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}
