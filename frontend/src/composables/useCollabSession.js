import { ref, shallowRef, watch, onBeforeUnmount } from "vue";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { captureException } from "@sentry/vue";
import { AuthedWebSocket } from "@/composables/authedWebSocket";
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
      try {
        AuthedWebSocket.clearToken(`${wsBase}/${provider.value.roomname}`);
      } catch (_e) {
        /* ignore */
      }
      provider.value.destroy();
      provider.value = null;
    }
    if (ydoc.value) {
      ydoc.value.destroy();
      ydoc.value = null;
    }
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
    api.post(`/files/${id}/collab/stop`).catch((err) => {
      captureException(err);
      toast.warning("Couldn't cleanly close the previous collaboration session.");
    });
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

    // Tell the backend to start its Y.js client and mint a short-lived WS auth
    // token. The multi-player server requires the token as the first frame or it
    // rejects the socket with code 4401.
    activeBackendFileId = id;
    let token = null;
    try {
      const startResp = await api.post(`/files/${id}/collab/start`);
      token = startResp?.data?.token ?? null;
      if (!token) {
        collabStartFailed.value = true;
        console.error(`[Collab] /collab/start for file ${id} returned no token`);
      }
    } catch (err) {
      collabStartFailed.value = true;
      console.error(
        `[Collab] Failed to start backend client for file ${id}:`,
        err?.response?.status,
        err?.response?.data || err.message
      );
    }

    // Bail if a newer session superseded us while we awaited the token.
    if (gen !== generation) return;

    const wsUrl = `${wsBase}/${roomName.value}`;
    if (token) AuthedWebSocket.registerToken(wsUrl, token);

    // AuthedWebSocket handles the auth handshake so y-websocket sees a normal socket.
    provider.value = new WebsocketProvider(wsBase, roomName.value, ydoc.value, {
      WebSocketPolyfill: AuthedWebSocket,
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

    // Refresh the WS auth token before each reconnect; it is short-lived (5 min)
    // and y-websocket would otherwise reconnect with a stale one and be rejected
    // with code 4401. Guard on the session generation, not a captured id, so a
    // refresh for an abandoned session never registers a token or starts a client.
    provider.value.on("connection-close", async () => {
      if (gen !== generation) return;
      try {
        const refresh = await api.post(`/files/${id}/collab/start`);
        const fresh = refresh?.data?.token;
        if (gen !== generation) return;
        if (fresh) AuthedWebSocket.registerToken(wsUrl, fresh);
      } catch (err) {
        console.error(
          `[Collab] Failed to refresh token for file ${id}:`,
          err?.response?.status,
          err?.response?.data || err.message
        );
      }
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

  // Re-attempt a failed session without a full reload: fetch a fresh token and
  // force the existing provider to reconnect now instead of waiting for backoff.
  async function retry() {
    const id = fileId.value;
    if (!id) return;
    try {
      const startResp = await api.post(`/files/${id}/collab/start`);
      const token = startResp?.data?.token ?? null;
      if (!token) throw new Error("/collab/start returned no token");
      AuthedWebSocket.registerToken(`${wsBase}/${roomName.value}`, token);
      collabStartFailed.value = false;
      if (provider.value) {
        provider.value.disconnect();
        provider.value.connect();
      }
    } catch (err) {
      collabStartFailed.value = true;
      console.error(
        `[Collab] Retry to start backend client for file ${id} failed:`,
        err?.response?.status,
        err?.response?.data || err.message
      );
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
