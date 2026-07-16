import { describe, it, expect, vi } from "vitest";

import { useFileEvents } from "@/composables/useFileEvents.js";

function streamOf(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function okStream(chunks) {
  return { ok: true, status: 200, body: streamOf(chunks) };
}

describe("useFileEvents", () => {
  it("parses SSE frames and dispatches events to the matching handler", async () => {
    const onAsset = vi.fn();
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okStream([": connected\n\n", 'data: {"type":"asset-changed"}\n\n']));

    const sub = useFileEvents(
      42,
      { "asset-changed": onAsset },
      { fetch: fetchFn, getToken: () => "tok", baseURL: "http://x" }
    );

    await vi.waitFor(() => expect(onAsset).toHaveBeenCalledTimes(1));
    expect(onAsset).toHaveBeenCalledWith({ type: "asset-changed" });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://x/files/42/events",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      })
    );
    sub.close();
  });

  it("ignores comment lines and event types with no handler", async () => {
    const onAsset = vi.fn();
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okStream([": ping\n\n", 'data: {"type":"unrelated"}\n\n']));

    const sub = useFileEvents(
      1,
      { "asset-changed": onAsset },
      { fetch: fetchFn, getToken: () => "t", baseURL: "" }
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(onAsset).not.toHaveBeenCalled();
    sub.close();
  });

  it("gives up without retrying when the stream is forbidden", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    const sub = useFileEvents(
      1,
      {},
      { fetch: fetchFn, getToken: () => "t", baseURL: "", retryMs: 1 }
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    sub.close();
  });

  it("stops dispatching after close()", async () => {
    const onAsset = vi.fn();
    let controllerRef;
    const body = new ReadableStream({
      start(controller) {
        controllerRef = controller;
      },
    });
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, body });

    const sub = useFileEvents(
      1,
      { "asset-changed": onAsset },
      { fetch: fetchFn, getToken: () => "t", baseURL: "" }
    );
    await new Promise((r) => setTimeout(r, 10));
    sub.close();
    // an event enqueued after close must not be dispatched
    const encoder = new TextEncoder();
    controllerRef.enqueue(encoder.encode('data: {"type":"asset-changed"}\n\n'));
    controllerRef.close();
    await new Promise((r) => setTimeout(r, 20));
    expect(onAsset).not.toHaveBeenCalled();
  });
});
