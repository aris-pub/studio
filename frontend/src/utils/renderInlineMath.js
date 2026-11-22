/**
 * Render $...$ inline math in plain text strings with MathJax.
 * Returns an HTML string safe for v-html — non-math segments are HTML-escaped.
 *
 * Studio uses the MathJax that rsm loads (rsm's static/libraries.js), so a page
 * has one math renderer. Call ensureMathJax() first; until it resolves,
 * renderInlineMath returns the escaped text.
 */

const INLINE_MATH_RE = /\$([^$]+)\$/g;

let libsPromise = null;
let libs = null;

/**
 * Load rsm's math library module and MathJax. Idempotent.
 * The module URL is the same one that rsm's onload.js imports, so the browser
 * shares one module instance and one MathJax with the manuscript.
 */
export function loadRsmLibraries() {
  if (!libsPromise) {
    const base = import.meta.env.VITE_API_BASE_URL;
    libsPromise = import(/* @vite-ignore */ `${base}/static/libraries.js`)
      .then((mod) => {
        libs = mod;
        return mod;
      })
      .catch((err) => {
        libsPromise = null;
        throw err;
      });
  }
  return libsPromise;
}

export async function ensureMathJax() {
  try {
    const mod = await loadRsmLibraries();
    await mod.loadMathJax();
  } catch (err) {
    console.error("Loading MathJax failed:", err);
  }
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

  const MathJax = window.MathJax;
  if (!MathJax?.tex2chtml) return escapeHtml(text);

  let result = "";
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_MATH_RE)) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    try {
      result += MathJax.tex2chtml(match[1], { display: false }).outerHTML;
    } catch {
      result += escapeHtml(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  result += escapeHtml(text.slice(lastIndex));
  // tex2chtml runs outside a typeset call, so the CSS for the new characters
  // is added only when the stylesheet is brought up to date.
  libs?.refreshMathStyles();
  return result;
}
