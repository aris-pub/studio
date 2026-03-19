/**
 * Render $...$ inline math in plain text strings using KaTeX.
 * Returns an HTML string safe for v-html — non-math segments are HTML-escaped.
 */

import katex from "katex";
import "katex/dist/katex.min.css";

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
      result += katex.renderToString(match[1], { displayMode: false, throwOnError: false });
    } catch {
      result += escapeHtml(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}
