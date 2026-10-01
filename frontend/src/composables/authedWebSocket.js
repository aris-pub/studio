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
 *   - A `fetchToken(url)` callback mints the token for THIS connection. It is
 *     called once per connect (initial and every reconnect), so y-websocket's
 *     auto-reconnect always carries a fresh token instead of a stale one parked
 *     in a shared registry (std-3ulu). The caller owns freshness and caching; a
 *     thrown or null result fails closed (we close the socket without authing).
 *   - On the underlying open event we await the token, then send the auth frame.
 *   - We hold y-websocket's onopen callback until auth_ok arrives.
 *   - Any send() y-websocket attempts before auth_ok is queued and flushed
 *     immediately after auth_ok.
 *   - The auth_ok frame is consumed by us — y-websocket never sees it.
 *
 * y-websocket constructs its WebSocketPolyfill as `new Polyfill(url, protocols)`
 * with no room to pass the fetcher, so `authedWebSocketWith(fetchToken)` binds a
 * fetcher into a 2-arg subclass that is passed as the polyfill.
 */

const READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

const AUTH_FAILED_CODE = 4401;

// An Event instance can only be dispatched once. The browser's WebSocket has
// already fired the original event when it called our inner.on{message,close}
// handler, so we forge a fresh one when forwarding to addEventListener
// listeners. Errors fall back to a plain Event (CloseEvent/MessageEvent may be
// unavailable in some non-browser environments).
function _cloneMessageEvent(event) {
  try {
    return new MessageEvent("message", { data: event.data, origin: event.origin });
  } catch (_e) {
    const e = new Event("message");
    e.data = event.data;
    return e;
  }
}

function _cloneCloseEvent(event) {
  try {
    return new CloseEvent("close", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
  } catch (_e) {
    const e = new Event("close");
    e.code = event.code;
    e.reason = event.reason;
    e.wasClean = event.wasClean;
    return e;
  }
}

export class AuthedWebSocket extends EventTarget {
  /**
   * @param {string} url
   * @param {string|string[]|undefined} protocols
   * @param {(url: string) => Promise<string|null>} [fetchToken] mints the auth
   *   token for this connection. Started immediately so the round trip overlaps
   *   the socket handshake. A null/thrown result fails closed.
   */
  constructor(url, protocols, fetchToken) {
    super();
    this._inner = new WebSocket(url, protocols);
    this._inner.binaryType = "arraybuffer";
    this._authed = false;
    this._sendQueue = [];

    this._userOnOpen = null;
    this._userOnMessage = null;
    this._userOnError = null;
    this._userOnClose = null;

    this._tokenPromise = (async () => {
      try {
        return fetchToken ? await fetchToken(url) : null;
      } catch (_e) {
        return null;
      }
    })();

    this._inner.onopen = async () => {
      const token = await this._tokenPromise;
      if (!token) {
        // Fail closed: no token means no auth frame. Closing lets y-websocket's
        // normal backoff and status handler fire instead of stalling until the
        // server's own auth timeout.
        try {
          this._inner.close(AUTH_FAILED_CODE, "no-token");
        } catch (_e) {
          /* already closed */
        }
        return;
      }
      try {
        this._inner.send(JSON.stringify({ type: "auth", token }));
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
          const openEvent = new Event("open");
          if (this._userOnOpen) {
            try {
              this._userOnOpen(openEvent);
            } catch (_e) {
              /* user error */
            }
          }
          this.dispatchEvent(openEvent);
          return;
        }
        // Any other text frame before auth means the server failed us; let it
        // close us via the normal onclose path. Don't forward to y-websocket.
        return;
      }
      if (this._userOnMessage) this._userOnMessage(event);
      this.dispatchEvent(_cloneMessageEvent(event));
    };

    this._inner.onerror = (event) => {
      if (this._userOnError) this._userOnError(event);
      this.dispatchEvent(new Event("error"));
    };

    this._inner.onclose = (event) => {
      if (this._userOnClose) this._userOnClose(event);
      this.dispatchEvent(_cloneCloseEvent(event));
    };
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

/**
 * Bind a token fetcher into a 2-arg WebSocket polyfill for y-websocket, which
 * constructs its polyfill as `new Polyfill(url, protocols)` with no room for the
 * fetcher. The fetcher's lifetime is tied to this class (and the provider that
 * holds it), so there is no global token registry to clear.
 */
export function authedWebSocketWith(fetchToken) {
  return class BoundAuthedWebSocket extends AuthedWebSocket {
    constructor(url, protocols) {
      super(url, protocols, fetchToken);
    }
  };
}

// Match the browser's WebSocket contract: these constants are accessible both
// statically (Foo.OPEN) and via instance (someFoo.OPEN). y-websocket's
// broadcastMessage compares ws.readyState === ws.OPEN on the instance, so the
// prototype assignments are load-bearing — without them ws.OPEN is undefined
// and every Y.Doc update is silently dropped.
AuthedWebSocket.CONNECTING = READY_STATES.CONNECTING;
AuthedWebSocket.OPEN = READY_STATES.OPEN;
AuthedWebSocket.CLOSING = READY_STATES.CLOSING;
AuthedWebSocket.CLOSED = READY_STATES.CLOSED;

AuthedWebSocket.prototype.CONNECTING = READY_STATES.CONNECTING;
AuthedWebSocket.prototype.OPEN = READY_STATES.OPEN;
AuthedWebSocket.prototype.CLOSING = READY_STATES.CLOSING;
AuthedWebSocket.prototype.CLOSED = READY_STATES.CLOSED;
