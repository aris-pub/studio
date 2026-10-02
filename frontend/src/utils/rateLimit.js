/**
 * Turn a backend 429 (Too Many Requests) into a readable toast.
 *
 * The rate-limit backend (aris/rate_limiting.py) returns 429 with a Retry-After
 * header on a known set of routes: login, register, public render, file create,
 * asset upload, and collab/start. This module is the single place that maps a
 * request URL to user-facing copy, so the axios response interceptor only has to
 * delegate. Unknown routes return no message, so a component that handles its own
 * 429 inline is left untouched.
 */
import { toast } from "@/utils/toast.js";

/**
 * Format a Retry-After header into a short human phrase.
 * Retry-After is either a number of seconds or an HTTP-date, per RFC 7231.
 * Returns "" when it is missing, unparseable, or already in the past.
 */
export function formatRetryAfter(retryAfter) {
  if (retryAfter === undefined || retryAfter === null || retryAfter === "") return "";

  let seconds = Number(retryAfter);
  if (Number.isNaN(seconds)) {
    const when = Date.parse(retryAfter);
    if (Number.isNaN(when)) return "";
    seconds = Math.round((when - Date.now()) / 1000);
  }
  if (seconds <= 0) return "";

  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// Order matters: asset upload and collab/start live under the /files path, so they
// are matched before the bare /files create route (which must end in /files).
function rateLimitMessage(url = "", when = "") {
  const again = when ? ` Try again in ${when}.` : " Please slow down.";
  const u = url.toLowerCase();

  if (u.includes("/login")) return `Too many login attempts.${again}`;
  if (u.includes("/register")) return `Too many sign-up attempts.${again}`;
  // Collab reconnects can fire in bursts, so keep this soft and free of a countdown.
  if (u.includes("/collab/start")) return "Live collaboration is catching up, one moment.";
  if (u.includes("/assets")) return `Too many uploads.${again}`;
  if (u.includes("/render")) {
    return when
      ? `Rendering paused: too many requests a minute. Resuming in ${when}.`
      : "Rendering paused: too many requests a minute.";
  }
  if (/\/files\/?(\?.*)?$/.test(u)) return `Too many new documents.${again}`;
  return null;
}

// A burst of 429s (repeated saves, reconnect loops) would otherwise stack
// identical toasts, so suppress a repeat of the same message within this window.
const DEDUPE_MS = 5000;
const lastShown = new Map();

function showOnce(message) {
  const now = Date.now();
  if (now - (lastShown.get(message) || 0) < DEDUPE_MS) return;
  lastShown.set(message, now);
  toast.warning(message);
}

/**
 * Build and show the toast for a rate-limited request. Returns true when the URL
 * is a known rate-limited route (and a message was produced), false otherwise.
 * Works for any caller, so a fetch-based path can reuse it, not only axios.
 */
export function notifyRateLimit(url, retryAfter) {
  const message = rateLimitMessage(url, formatRetryAfter(retryAfter));
  if (!message) return false;
  showOnce(message);
  return true;
}

/**
 * If the axios error is a 429 on a known route, show the matching toast and
 * return true. Returns false for anything else so callers keep handling it.
 */
export function handleRateLimit(error) {
  const resp = error?.response;
  if (!resp || resp.status !== 429) return false;

  const headers = resp.headers || {};
  const retryAfter = headers["retry-after"] ?? headers["Retry-After"];
  return notifyRateLimit(error.config?.url || "", retryAfter);
}

// Test-only: clear the dedupe cache between cases.
export function _resetRateLimitDedupe() {
  lastShown.clear();
}
