import { ref, watch, getCurrentScope, onScopeDispose } from "vue";

/**
 * Derive a TRUE save-status signal for the collaborative editor (std-wmjv).
 *
 * All saving flows through the backend Y.js persistence peer, so a "connected"
 * relay link does NOT mean the work reached Postgres: if that peer is absent or a
 * DB write fails, edits still relay peer-to-peer while nothing persists, and work
 * is silently lost. This turns three raw signals into one honest indicator:
 *
 *   - a LOCAL doc edit (the user's own keystroke/undo, not a remote peer's edit)
 *     moves state to "saving" and stamps when it happened;
 *   - a "persisted" ack (published by the backend only after a committed DB write)
 *     that lands once local edits have quiesced moves state to "saved";
 *   - a watchdog moves state to "not-saving" (the warning) when the relay is
 *     offline, or when work has been "saving" for longer than `watchdogMs` with no
 *     ack, the visible face of the silent data-loss window.
 *
 * Kept transport-free and injectable (`isConnected`, timings, `now`) so it can be
 * unit-tested without mounting the editor.
 *
 * @param {object} [options]
 * @param {import('vue').Ref<boolean>} [options.isConnected] relay connection signal
 * @param {number} [options.settleMs] quiet window after a local edit before an ack counts (backend saves on ~500ms debounce)
 * @param {number} [options.watchdogMs] max time "saving" with no ack before warning
 * @param {number} [options.checkIntervalMs] watchdog poll interval
 * @param {() => number} [options.now] clock (injectable for tests)
 * @returns {{ saveState: import('vue').Ref<'saved'|'saving'|'not-saving'>, noteLocalEdit: () => void, notePersisted: () => void, checkWatchdog: () => void, reset: () => void, stop: () => void }}
 */
export function useSaveStatus(options = {}) {
  const isConnected = options.isConnected ?? ref(true);
  const settleMs = options.settleMs ?? 400;
  const watchdogMs = options.watchdogMs ?? 4000;
  const checkIntervalMs = options.checkIntervalMs ?? 1000;
  const now = options.now ?? (() => Date.now());

  const saveState = ref("saved");
  let lastLocalEditAt = null;

  function noteLocalEdit() {
    lastLocalEditAt = now();
    saveState.value = isConnected.value ? "saving" : "not-saving";
  }

  function notePersisted() {
    if (saveState.value === "saved") return; // nothing outstanding to confirm
    // Only settle once local edits have quiesced past the backend's save-debounce
    // window. An ack that races an in-flight keystroke predates that keystroke, so
    // ignore it and wait for the next ack rather than flashing a premature "saved".
    if (lastLocalEditAt === null || now() - lastLocalEditAt >= settleMs) {
      saveState.value = "saved";
      lastLocalEditAt = null;
    }
  }

  function checkWatchdog() {
    if (saveState.value === "saved") return;
    if (!isConnected.value) {
      saveState.value = "not-saving";
      return;
    }
    if (lastLocalEditAt !== null && now() - lastLocalEditAt > watchdogMs) {
      saveState.value = "not-saving";
    }
  }

  function reset() {
    lastLocalEditAt = null;
    saveState.value = "saved";
  }

  // React to relay loss/restore immediately (better than waiting a poll cycle),
  // but only while there is outstanding unsaved work.
  const stopConnWatch = watch(
    () => isConnected.value,
    (connected) => {
      if (saveState.value === "saved") return;
      saveState.value = connected ? "saving" : "not-saving";
    },
    { flush: "sync" }
  );

  const timer = setInterval(checkWatchdog, checkIntervalMs);

  function stop() {
    clearInterval(timer);
    stopConnWatch();
  }

  if (getCurrentScope()) onScopeDispose(stop);

  return { saveState, noteLocalEdit, notePersisted, checkWatchdog, reset, stop };
}
