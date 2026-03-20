/**
 * Render $...$ inline math in plain text strings using Temml.
 * Returns an HTML string safe for v-html — non-math segments are HTML-escaped.
 *
 * Loads Temml from CDN on first use if not already available (e.g. onload.js
 * loaded it). Returns a promise that resolves to signal readiness.
 */

const TEMML_JS = "https://cdn.jsdelivr.net/npm/temml/dist/temml.min.js";
const TEMML_CSS = "https://cdn.jsdelivr.net/npm/temml/dist/Temml.css";
const INLINE_MATH_RE = /\$([^$]+)\$/g;

let loadPromise = null;

/**
 * Ensure Temml is loaded. Returns a promise that resolves when ready.
 * Idempotent — safe to call multiple times.
 */
export function ensureTemml() {
  if (window.temml) return Promise.resolve();
  if (loadPromise) return loadPromise;

  // CSS
  if (!document.querySelector(`link[href="${TEMML_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TEMML_CSS;
    document.head.appendChild(link);
  }

  // JS
  const script = document.createElement("script");
  script.src = TEMML_JS;
  document.head.appendChild(script);

  loadPromise = new Promise((resolve) => {
    script.onload = resolve;
    script.onerror = resolve;
  });
  return loadPromise;
}

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
  if (!text.includes("$")) return escapeHtml(text);

  const temml = window.temml;
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
