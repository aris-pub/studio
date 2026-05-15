import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { AuthedWebSocket } from "@/composables/authedWebSocket";

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
  AuthedWebSocket._tokens.clear();
});

describe("AuthedWebSocket — addEventListener compatibility (regression for std-kab28c)", () => {
  it("exposes addEventListener / removeEventListener / dispatchEvent (EventTarget API)", () => {
    const ws = new AuthedWebSocket("ws://localhost:1234/file-1-test");
    expect(typeof ws.addEventListener).toBe("function");
    expect(typeof ws.removeEventListener).toBe("function");
    expect(typeof ws.dispatchEvent).toBe("function");
  });

  it("dispatches an 'error' event to addEventListener listeners when inner socket errors", () => {
    const ws = new AuthedWebSocket("ws://localhost:1234/file-1-test");
    const listener = vi.fn();
    ws.addEventListener("error", listener);

    lastInner.onerror(new Event("error"));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe("error");
  });

  it("dispatches a 'close' event with code/reason preserved", () => {
    const ws = new AuthedWebSocket("ws://localhost:1234/file-1-test");
    const listener = vi.fn();
    ws.addEventListener("close", listener);

    lastInner.onclose({ code: 4401, reason: "auth-failed", wasClean: false });

    expect(listener).toHaveBeenCalledTimes(1);
    const evt = listener.mock.calls[0][0];
    expect(evt.type).toBe("close");
    expect(evt.code).toBe(4401);
    expect(evt.reason).toBe("auth-failed");
  });

  it("dispatches an 'open' event only after auth_ok arrives", () => {
    AuthedWebSocket.registerToken("ws://localhost:1234/file-1-test", "tok-abc");
    const ws = new AuthedWebSocket("ws://localhost:1234/file-1-test");
    const listener = vi.fn();
    ws.addEventListener("open", listener);

    lastInner.onopen();
    expect(listener).not.toHaveBeenCalled();
    expect(lastInner.sent[0]).toBe(JSON.stringify({ type: "auth", token: "tok-abc" }));

    lastInner.onmessage({ data: JSON.stringify({ type: "auth_ok" }) });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe("open");
  });

  it("does not break setter API (used by y-websocket internally)", () => {
    AuthedWebSocket.registerToken("ws://localhost:1234/file-1-test", "tok-abc");
    const ws = new AuthedWebSocket("ws://localhost:1234/file-1-test");
    const setterOpen = vi.fn();
    const setterMsg = vi.fn();
    ws.onopen = setterOpen;
    ws.onmessage = setterMsg;

    lastInner.onopen();
    lastInner.onmessage({ data: JSON.stringify({ type: "auth_ok" }) });
    expect(setterOpen).toHaveBeenCalledTimes(1);

    // After auth, regular messages reach the setter
    const dataFrame = { data: new ArrayBuffer(4) };
    lastInner.onmessage(dataFrame);
    expect(setterMsg).toHaveBeenCalledWith(dataFrame);
  });

  it("closes with 4401 when no token is registered", () => {
    const ws = new AuthedWebSocket("ws://localhost:1234/file-1-test");
    lastInner.onopen();
    expect(lastInner.closed).toEqual({ code: 4401, reason: "no-token" });
    // Wrapper exists; no auth frame sent
    expect(lastInner.sent).toEqual([]);
    expect(ws.readyState).toBe(3);
  });
});
