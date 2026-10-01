import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { AuthedWebSocket, authedWebSocketWith } from "@/composables/authedWebSocket";

class MockInnerSocket {
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.binaryType = "blob";
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this.sent = [];
    this.closed = null;
  }
  send(data) {
    this.sent.push(data);
  }
  close(code, reason) {
    this.closed = { code, reason };
    this.readyState = 3;
  }
}

let lastInner = null;
let origWebSocket;

const URL = "ws://localhost:1234/file-1";

beforeEach(() => {
  origWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = vi.fn().mockImplementation((url, protocols) => {
    lastInner = new MockInnerSocket(url, protocols);
    return lastInner;
  });
});

afterEach(() => {
  globalThis.WebSocket = origWebSocket;
  lastInner = null;
});

describe("AuthedWebSocket — EventTarget compatibility (regression for std-kab28c)", () => {
  it("exposes addEventListener / removeEventListener / dispatchEvent (EventTarget API)", () => {
    const ws = new AuthedWebSocket(URL);
    expect(typeof ws.addEventListener).toBe("function");
    expect(typeof ws.removeEventListener).toBe("function");
    expect(typeof ws.dispatchEvent).toBe("function");
  });

  it("dispatches an 'error' event to addEventListener listeners when inner socket errors", () => {
    const ws = new AuthedWebSocket(URL);
    const listener = vi.fn();
    ws.addEventListener("error", listener);

    lastInner.onerror(new Event("error"));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe("error");
  });

  it("dispatches a 'close' event with code/reason preserved", () => {
    const ws = new AuthedWebSocket(URL);
    const listener = vi.fn();
    ws.addEventListener("close", listener);

    lastInner.onclose({ code: 4401, reason: "auth-failed", wasClean: false });

    expect(listener).toHaveBeenCalledTimes(1);
    const evt = listener.mock.calls[0][0];
    expect(evt.type).toBe("close");
    expect(evt.code).toBe(4401);
    expect(evt.reason).toBe("auth-failed");
  });

  it("exposes CONNECTING/OPEN/CLOSING/CLOSED constants on both the class and instances", () => {
    expect(AuthedWebSocket.CONNECTING).toBe(0);
    expect(AuthedWebSocket.OPEN).toBe(1);
    expect(AuthedWebSocket.CLOSING).toBe(2);
    expect(AuthedWebSocket.CLOSED).toBe(3);

    const ws = new AuthedWebSocket(URL);
    expect(ws.CONNECTING).toBe(0);
    expect(ws.OPEN).toBe(1);
    expect(ws.CLOSING).toBe(2);
    expect(ws.CLOSED).toBe(3);
  });
});

describe("AuthedWebSocket — token fetcher (std-3ulu)", () => {
  it("mints a token via the fetcher on connect and sends it, then opens only after auth_ok", async () => {
    const fetchToken = vi.fn().mockResolvedValue("tok-abc");
    const ws = new AuthedWebSocket(URL, undefined, fetchToken);
    const listener = vi.fn();
    ws.addEventListener("open", listener);

    await lastInner.onopen();

    expect(fetchToken).toHaveBeenCalledWith(URL);
    expect(lastInner.sent[0]).toBe(JSON.stringify({ type: "auth", token: "tok-abc" }));
    expect(listener).not.toHaveBeenCalled();

    lastInner.onmessage({ data: JSON.stringify({ type: "auth_ok" }) });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe("open");
  });

  it("mints a fresh token on every connect (no stale shared token)", async () => {
    // The reconnect-bounce regression: a second connection must mint again, not
    // reuse a token parked in a shared registry.
    const fetchToken = vi.fn().mockResolvedValueOnce("tok-1").mockResolvedValueOnce("tok-2");

    new AuthedWebSocket(URL, undefined, fetchToken);
    await lastInner.onopen();
    expect(lastInner.sent[0]).toBe(JSON.stringify({ type: "auth", token: "tok-1" }));

    new AuthedWebSocket(URL, undefined, fetchToken);
    await lastInner.onopen();
    expect(lastInner.sent[0]).toBe(JSON.stringify({ type: "auth", token: "tok-2" }));

    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("fails closed (4401, no auth frame) when the fetcher returns null", async () => {
    const ws = new AuthedWebSocket(URL, undefined, vi.fn().mockResolvedValue(null));
    await lastInner.onopen();
    expect(lastInner.closed).toEqual({ code: 4401, reason: "no-token" });
    expect(lastInner.sent).toEqual([]);
    expect(ws.readyState).toBe(3);
  });

  it("fails closed when the fetcher throws", async () => {
    const ws = new AuthedWebSocket(URL, undefined, vi.fn().mockRejectedValue(new Error("boom")));
    await lastInner.onopen();
    expect(lastInner.closed).toEqual({ code: 4401, reason: "no-token" });
    expect(lastInner.sent).toEqual([]);
    expect(ws.readyState).toBe(3);
  });

  it("does not break the setter API y-websocket uses, and relays data frames after auth", async () => {
    const ws = new AuthedWebSocket(URL, undefined, vi.fn().mockResolvedValue("tok"));
    const setterOpen = vi.fn();
    const setterMsg = vi.fn();
    ws.onopen = setterOpen;
    ws.onmessage = setterMsg;

    await lastInner.onopen();
    lastInner.onmessage({ data: JSON.stringify({ type: "auth_ok" }) });
    expect(setterOpen).toHaveBeenCalledTimes(1);

    const dataFrame = { data: new ArrayBuffer(4) };
    lastInner.onmessage(dataFrame);
    expect(setterMsg).toHaveBeenCalledWith(dataFrame);
  });

  it("authedWebSocketWith binds the fetcher into a 2-arg polyfill (y-websocket contract)", async () => {
    const fetchToken = vi.fn().mockResolvedValue("bound-tok");
    const Polyfill = authedWebSocketWith(fetchToken);
    // y-websocket constructs with exactly (url, protocols).
    new Polyfill(URL, undefined);
    await lastInner.onopen();
    expect(fetchToken).toHaveBeenCalledWith(URL);
    expect(lastInner.sent[0]).toBe(JSON.stringify({ type: "auth", token: "bound-tok" }));
  });
});
