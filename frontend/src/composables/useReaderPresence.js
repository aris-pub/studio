/**
 * Reader-side presence: show where remote collaborators are in the rendered
 * manuscript, as a small Avatar in the margin beside the paragraph they are in.
 *
 * The source editor already renders remote cursors via y-codemirror.next. The
 * reading pane had nothing, so a reviewer viewing the manuscript could not tell
 * anyone else was on the page (std-5v3h).
 *
 * Placement is paragraph-level: a user's awareness cursor is a position in the
 * Y.Text source, which we resolve to an absolute offset and match against the
 * data-source-start/end range each rendered block carries (the same offset model
 * annotations use). Exact in-line placement waits on std-s41a.
 */
import { ref, watch, onBeforeUnmount } from "vue";
import * as Y from "yjs";

const DEFAULT_IDLE_MS = 5000;

/**
 * Decode an awareness cursor (y-codemirror.next stores {anchor, head} as JSON
 * relative positions) into an absolute offset in the source. Returns null when
 * it is missing or cannot be resolved against the current document.
 */
export function resolveCursorOffset(cursor, ydoc) {
  if (!cursor || !ydoc) return null;
  const point = cursor.head ?? cursor.anchor;
  if (!point) return null;
  try {
    const rel = Y.createRelativePositionFromJSON(point);
    const abs = Y.createAbsolutePositionFromRelativePosition(rel, ydoc);
    return abs ? abs.index : null;
  } catch {
    return null;
  }
}

/**
 * Find the rendered block whose data-source-start/end range contains the offset.
 * Prefers the smallest containing range so nested blocks resolve to the innermost.
 */
export function findBlockForOffset(manuscriptEl, offset) {
  if (!manuscriptEl || offset === null || offset === undefined) return null;
  const blocks = manuscriptEl.querySelectorAll("[data-source-start]");
  let best = null;
  let bestSize = Infinity;
  for (const block of blocks) {
    const start = parseInt(block.getAttribute("data-source-start"), 10);
    const end = parseInt(block.getAttribute("data-source-end") ?? "", 10);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (offset >= start && offset <= end && end - start < bestSize) {
      best = block;
      bestSize = end - start;
    }
  }
  return best;
}

/**
 * Pure core: turn awareness states into presence entries. Self and users with no
 * identity or no resolvable block are dropped. `active` is false once a client has
 * gone quiet for longer than idleMs, which drives the fade.
 */
export function buildPresenceEntries(states, opts) {
  const { selfClientId, resolveOffset, findBlock, now, lastSeen, idleMs } = opts;
  const entries = [];
  for (const [clientId, state] of states) {
    if (clientId === selfClientId) continue;
    if (!state || !state.user) continue;
    const offset = state.cursor ? resolveOffset(state.cursor) : null;
    const block = offset === null || offset === undefined ? null : findBlock(offset);
    if (!block) continue;
    const seen = lastSeen.has(clientId) ? lastSeen.get(clientId) : now;
    entries.push({
      clientId,
      user: state.user,
      color: state.user.avatar_color || state.user.color || "var(--primary-400)",
      block,
      active: now - seen < idleMs,
    });
  }
  return entries;
}

/**
 * Composable: a reactive list of { clientId, user, color, block, active } for the
 * remote users currently in the document. The caller measures `block` against its
 * own overlay root so placement stays self-consistent.
 */
export function useReaderPresence({ awareness, ydoc, manuscriptRef, idleMs = DEFAULT_IDLE_MS }) {
  const presences = ref([]);
  const lastSeen = new Map();
  let tick = null;

  function rootEl() {
    const m = manuscriptRef?.value;
    return m?.mountPoint || m?.$el || m || null;
  }

  function recompute() {
    const aw = awareness?.value;
    const el = rootEl();
    if (!aw || !el) {
      presences.value = [];
      return;
    }
    const now = Date.now();
    const entries = buildPresenceEntries(aw.getStates(), {
      selfClientId: aw.clientID,
      resolveOffset: (c) => resolveCursorOffset(c, ydoc?.value),
      findBlock: (off) => findBlockForOffset(el, off),
      now,
      lastSeen,
      idleMs,
    });
    presences.value = entries;
  }

  function onAwarenessChange({ added = [], updated = [] } = {}) {
    const now = Date.now();
    for (const clientId of [...added, ...updated]) lastSeen.set(clientId, now);
    recompute();
  }

  // A slow tick lets `active` flip to false after idle without an awareness event.
  function startTick() {
    stopTick();
    tick = setInterval(recompute, 1000);
  }
  function stopTick() {
    if (tick) clearInterval(tick);
    tick = null;
  }

  function bind(aw) {
    if (!aw) return;
    aw.on("change", onAwarenessChange);
  }
  function unbind(aw) {
    if (!aw) return;
    aw.off("change", onAwarenessChange);
  }

  const stopWatch = watch(
    () => awareness?.value,
    (aw, prev) => {
      unbind(prev);
      bind(aw);
      recompute();
    },
    { immediate: true }
  );

  startTick();

  onBeforeUnmount(() => {
    stopWatch();
    unbind(awareness?.value);
    stopTick();
  });

  return { presences, recompute };
}
