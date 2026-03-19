/**
 * Render $...$ inline math in plain text strings using Temml (if available).
 * Returns an HTML string safe for v-html — non-math segments are HTML-escaped.
 */

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

  const temml = typeof window !== "undefined" && window.temml;
  if (!temml) return escapeHtml(text);

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
