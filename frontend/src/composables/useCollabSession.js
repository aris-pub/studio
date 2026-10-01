import { ref, shallowRef, watch, onBeforeUnmount } from "vue";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { captureException } from "@sentry/vue";
import { authedWebSocketWith } from "@/composables/authedWebSocket";
import { toast } from "@/utils/toast.js";

/**
 * Own the Y.js collaboration session for the open file, independent of any UI panel.
 *
 * The session used to live inside EditorCodeMirror.vue, which only mounts when the
 * source editor panel is open (std-hvgpnr). So opening a file with the panel closed
 * (the default, and the reader/reviewer case) never opened a WebSocket, and
 * annotation anchoring fell back to drifting DOM offsets. This composable is owned
 * at the view level and watches the file id alone, so the session comes up whenever
 * a file is open. The editor is now a pure consumer of the shared ydoc/ytext/awareness.
 *
 * The session is authoritative for the editable document (ydoc_state); the read
 * view renders from the derived `source` column on the backend, so it does not
 * depend on this connection.
 *
 * @param {import('vue').Ref<number|undefined>} fileId reactive current file id
 * @param {object} deps
 * @param {object} deps.api axios-like client (post)
 * @param {import('vue').Ref<object>} deps.user current user (for awareness)
 * @param {string} [deps.serverUrl] multiplayer ws base (defaults to env)
 */
export function useCollabSession(fileId, { api, user, serverUrl } = {}) {
  const ydoc = shallowRef(null);
  const ytext = shallowRef(null);
  const awareness = shallowRef(null);
  const provider = shallowRef(null);
  const isConnected = ref(false);
  const isSynced = ref(false);
  // True when a session could not be started (/collab/start failed or returned no
  // token). Distinct from a transient !isConnected drop: it means no session was
  // ever established, so the status bar offers an explicit retry.
  const collabStartFailed = ref(false);
  const roomName = ref("");

  const wsBase = serverUrl || import.meta.env.VITE_MULTIPLAYER_URL || "ws://localhost:1234";

  // Monotonic session generation. Every start bumps it; each async continuation
  // captures its own value and bails if superseded. This is the cancellation
  // guard for rapid file switching and for a late token refresh landing after we
  // moved on. It is correct where comparing file.value.id is not (A -> B -> A
  // returns the same id).
  let generation = 0;
  // The file id we last told the backend to start a client for, so we can stop it
  // on switch/unmount even if its own start failed.
  let activeBackendFileId = null;
  // The most recently minted WS auth token for the current file, with when it was
  // minted. Lets a reconnect burst reuse one token instead of hitting /collab/start
  // on every attempt (std-3ulu). Per-composable, reset on every file switch and
  // teardown, so it never leaks across files.
  let tokenCache = null;
  const TOKEN_CACHE_MS = 30000;

  // Serialize /collab/start and /collab/stop for the SAME file so a fire-and-forget
  // stop cannot overtake an in-flight start (or the reverse) on rapid A->B->A
  // switching and orphan a backend client (std-i40m). Different files run
  // independently.
  const opChains = new Map();
  function _serialize(id, op) {
    const prev = opChains.get(id) || Promise.resolve();
    // Run op after prev settles either way, so one failed op does not wedge the chain.
    const next = prev.then(op, op);
    const tail = next.then(
      () => {},
      () => {}
    );
    opChains.set(id, tail);
    tail.then(() => {
      if (opChains.get(id) === tail) opChains.delete(id);
    });
    return next;
  }

  // Presence label for the awareness cursor. Returns null when we have no user
  // identity yet rather than throwing: awareness is presence-only, so a missing
  // label must never break the document session (a reader with the panel closed
  // still needs the session for annotation anchoring).
  const userInfo = () => {
    const u = user?.value;
    if (!u || (!u.name && !u.email)) return null;
    const color = u.avatar_color || "#0E9AE9";
    return {
      name: u.name || u.email,
      color,
      colorLight: color + "33",
      id: u.id,
      avatar_color: u.avatar_color,
    };
  };

  function _exposeForTests() {
    if (import.meta.env.PROD) return;
    window.__ydoc = ydoc.value;
    window.__ytext = ytext.value;
    window.__provider = provider.value;
    window.__awareness = awareness.value;
  }

  function _clearTestGlobals() {
    if (import.meta.env.PROD) return;
    delete window.__ydoc;
    delete window.__ytext;
    delete window.__provider;
    delete window.__awareness;
  }

  // Tear down the current session's frontend objects. Order matters: null the
  // shared ytext/awareness FIRST so the editor's y-codemirror binding drops its
  // reference before the doc is destroyed, then destroy the provider, then the
  // doc. Destroying the doc while a binding still holds it is the silent-edit-loss
  // failure this ordering prevents (std-wmjv class).
  function _teardown() {
    if (ytext.value) ytext.value = null;
    if (awareness.value) awareness.value = null;
    if (provider.value) {
      provider.value.destroy();
      provider.value = null;
    }
    if (ydoc.value) {
      ydoc.value.destroy();
      ydoc.value = null;
    }
    tokenCache = null;
    isConnected.value = false;
    isSynced.value = false;
    _clearTestGlobals();
  }

  // Best-effort backend stop. Non-blocking, but a failed stop leaves a backend
  // Y.js client lingering, so report it (std-eisqeg) instead of swallowing.
  // NOTE: this stop is fire-and-forget and can race an in-flight start on rapid
  // switching. Serializing stop-then-start is tracked separately (std-i40m).
  function _stopBackend(id) {
    if (!id) return;
    _serialize(id, () => api.post(`/files/${id}/collab/stop`)).catch((err) => {
      captureException(err);
      toast.warning("Couldn't cleanly close the previous collaboration session.");
    });
  }

  // Mint the auth token for one connection. Reuse a recently-minted token so a
  // reconnect burst does not hit /collab/start on every attempt (that route also
  // spins the backend client); within this short window the backend client is
  // still alive, so skipping the re-ensure is safe. Generation-guarded and
  // fail-closed: a superseded session, a missing token, or an error returns null,
  // which makes the wrapper close the socket without authing. Never logs the token.
  async function _mintToken(id, gen) {
    if (tokenCache && Date.now() - tokenCache.mintedAt < TOKEN_CACHE_MS) {
      return tokenCache.token;
    }
    try {
      const resp = await _serialize(id, () => api.post(`/files/${id}/collab/start`));
      if (gen !== generation) return null;
      const token = resp?.data?.token ?? null;
      if (!token) {
        collabStartFailed.value = true;
        console.error(`[Collab] /collab/start for file ${id} returned no token`);
        return null;
      }
      tokenCache = { token, mintedAt: Date.now() };
      return token;
    } catch (err) {
      if (gen !== generation) return null;
      collabStartFailed.value = true;
      console.error(
        `[Collab] Failed to start backend client for file ${id}:`,
        err?.response?.status,
        err?.response?.data || err.message
      );
      return null;
    }
  }

  async function _start(id) {
    const gen = ++generation;

    // The room name carries no environment suffix. Each deployment runs its own
    // multiplayer server, so rooms cannot collide across environments, and the
    // suffix only ever created a frontend/backend mismatch when their env values
    // disagreed (VITE_ENV=preview vs backend ENV=PROD on previews). See std-0g12.
    roomName.value = `file-${id}`;

    ydoc.value = new Y.Doc();
    ytext.value = ydoc.value.getText("text");

    activeBackendFileId = id;
    tokenCache = null;
    const fetchToken = () => _mintToken(id, gen);

    // Pre-warm the token before the socket exists, so the first auth frame is not
    // gated by a cold /collab/start under the multiplayer server's short first-frame
    // timeout. On every (re)connect the wrapper mints via this same fetcher, so a
    // reconnect never carries a stale token (std-3ulu). The wrapper owns the auth
    // handshake, so y-websocket sees a normal socket.
    await fetchToken();
    if (gen !== generation) return;

    provider.value = new WebsocketProvider(wsBase, roomName.value, ydoc.value, {
      WebSocketPolyfill: authedWebSocketWith(fetchToken),
    });
    awareness.value = provider.value.awareness;
    const info = userInfo();
    if (info) awareness.value.setLocalStateField("user", info);

    provider.value.ws?.addEventListener("error", (error) => {
      console.error("[Y.js WS] WebSocket ERROR:", error);
    });

    provider.value.on("status", (event) => {
      isConnected.value = event.status === "connected";
      // A successful (re)connect clears any prior start failure, covering both
      // manual retry and y-websocket's own eventual reconnect.
      if (isConnected.value) collabStartFailed.value = false;
    });

    provider.value.on("connection-error", (event) => {
      console.error("[Y.js] Connection error:", event);
    });

    // NB: the frontend must NEVER seed file.source into the shared Y.Text. The
    // backend is the single authoritative seeder: /collab/start awaits the backend
    // YDocClient's readiness (DB restore + broadcast) before this provider is
    // created, and content arrives via normal sync. Typing plaintext here mints
    // fresh CRDT items that merge into duplicate copies (the historical
    // 1x->2x->4x duplication bug). Restores are idempotent only through the
    // backend's encoded ydoc_state.

    provider.value.once("synced", () => {
      if (gen !== generation) return;
      isSynced.value = true;
    });

    _exposeForTests();
  }

  // Re-attempt a failed session without a full reload: drop the cached token so the
  // next connect mints a fresh one, and reconnect now instead of waiting for
  // y-websocket's backoff. The wrapper's fetcher does the minting and sets
  // collabStartFailed again if it still fails.
  function retry() {
    if (!fileId.value) return;
    tokenCache = null;
    collabStartFailed.value = false;
    if (provider.value) {
      provider.value.disconnect();
      provider.value.connect();
    }
  }

  watch(
    fileId,
    (id) => {
      const previousBackendFileId = activeBackendFileId;
      _teardown();
      collabStartFailed.value = false;
      if (previousBackendFileId && previousBackendFileId !== id) {
        _stopBackend(previousBackendFileId);
        activeBackendFileId = null;
      }
      if (!id) return;
      _start(id);
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    const id = activeBackendFileId;
    // Bump the generation so any in-flight continuation is cancelled.
    generation++;
    _teardown();
    _stopBackend(id);
  });

  return {
    ydoc,
    ytext,
    awareness,
    provider,
    isConnected,
    isSynced,
    collabStartFailed,
    retry,
    roomName,
  };
}
