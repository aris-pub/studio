/**
 * Authenticated WebSocket wrapper for the Y.js multi-player server.
 *
 * The multi-player server requires `{type: 'auth', token: '<jwt>'}` as the
 * first text frame and replies with `{type: 'auth_ok'}` before Y.js sync may
 * proceed. This class wraps the browser's WebSocket so y-websocket's
 * WebsocketProvider can treat it as a normal socket while we transparently
 * perform the auth handshake.
 *
 * Strategy:
 *   - On the underlying open event we send the auth JSON frame.
 *   - We hold y-websocket's onopen callback until auth_ok arrives.
 *   - Any send() y-websocket attempts before auth_ok is queued and flushed
 *     immediately after auth_ok.
 *   - The auth_ok frame is consumed by us — y-websocket never sees it.
 */

const READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

const AUTH_FAILED_CODE = 4401;

export class AuthedWebSocket {
  constructor(url, protocols) {
    this._inner = new WebSocket(url, protocols);
    this._inner.binaryType = "arraybuffer";
    this._authed = false;
    this._sendQueue = [];

    this._userOnOpen = null;
    this._userOnMessage = null;
    this._userOnError = null;
    this._userOnClose = null;

    this._token = AuthedWebSocket._resolveToken(url);

    this._inner.onopen = () => {
      if (!this._token) {
        try {
          this._inner.close(AUTH_FAILED_CODE, "no-token");
        } catch (_e) {
          /* already closed */
        }
        return;
      }
      try {
        this._inner.send(JSON.stringify({ type: "auth", token: this._token }));
      } catch (_e) {
        /* will surface via onclose */
      }
    };

    this._inner.onmessage = (event) => {
      if (!this._authed && typeof event.data === "string") {
        let parsed;
        try {
          parsed = JSON.parse(event.data);
        } catch (_e) {
          parsed = null;
        }
        if (parsed && parsed.type === "auth_ok") {
          this._authed = true;
          const queue = this._sendQueue;
          this._sendQueue = [];
          for (const data of queue) {
            try {
              this._inner.send(data);
            } catch (_e) {
              /* surfaces via onclose */
            }
          }
          if (this._userOnOpen) {
            try {
              this._userOnOpen(new Event("open"));
            } catch (_e) {
              /* user error */
            }
          }
          return;
        }
        // Any other text frame before auth means the server failed us; let it
        // close us via the normal onclose path. Don't forward to y-websocket.
        return;
      }
      if (this._userOnMessage) this._userOnMessage(event);
    };

    this._inner.onerror = (event) => {
      if (this._userOnError) this._userOnError(event);
    };

    this._inner.onclose = (event) => {
      if (this._userOnClose) this._userOnClose(event);
    };
  }

  /**
   * Token lookup hook.
   *
   * EditorCodeMirror.vue (and any other consumer) calls
   * AuthedWebSocket.registerToken(url, token) after /collab/start returns.
   */
  static _tokens = new Map();

  static registerToken(url, token) {
    AuthedWebSocket._tokens.set(url, token);
  }

  static clearToken(url) {
    AuthedWebSocket._tokens.delete(url);
  }

  static _resolveToken(url) {
    return AuthedWebSocket._tokens.get(url) ?? null;
  }

  get readyState() {
    return this._inner.readyState;
  }
  get url() {
    return this._inner.url;
  }
  get protocol() {
    return this._inner.protocol;
  }
  get binaryType() {
    return this._inner.binaryType;
  }
  set binaryType(v) {
    this._inner.binaryType = v;
  }
  get bufferedAmount() {
    return this._inner.bufferedAmount;
  }

  set onopen(fn) {
    this._userOnOpen = fn;
  }
  get onopen() {
    return this._userOnOpen;
  }
  set onmessage(fn) {
    this._userOnMessage = fn;
  }
  get onmessage() {
    return this._userOnMessage;
  }
  set onerror(fn) {
    this._userOnError = fn;
  }
  get onerror() {
    return this._userOnError;
  }
  set onclose(fn) {
    this._userOnClose = fn;
  }
  get onclose() {
    return this._userOnClose;
  }

  send(data) {
    if (!this._authed) {
      this._sendQueue.push(data);
    } else {
      this._inner.send(data);
    }
  }

  close(code, reason) {
    return this._inner.close(code, reason);
  }
}

AuthedWebSocket.CONNECTING = READY_STATES.CONNECTING;
AuthedWebSocket.OPEN = READY_STATES.OPEN;
AuthedWebSocket.CLOSING = READY_STATES.CLOSING;
AuthedWebSocket.CLOSED = READY_STATES.CLOSED;
