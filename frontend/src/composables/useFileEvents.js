/**
 * Subscribe to a file's server-sent event stream and dispatch events by type.
 *
 * The backend exposes a general per-file event channel at GET /files/{id}/events
 * (see backend aris.services.file_events). This opens it with fetch() rather than
 * EventSource, because EventSource cannot attach the bearer token, then parses
 * the SSE frames and calls handlers[event.type] for each event.
 *
 * Deliberately generic: pass any map of { eventType: handler }. Its first use is
 * recompiling when a file's asset changes out of band (std-iu0n), but any future
 * file-scoped event can reuse the same channel and this same composable.
 *
 * @param {number|string} fileId
 * @param {Record<string, (event: object) => void>} handlers
 * @param {object} [options] - fetch, getToken, baseURL, retryMs (injectable for tests)
 * @returns {{ close: () => void }}
 */
export function useFileEvents(fileId, handlers, options = {}) {
  const baseURL = options.baseURL ?? import.meta.env.VITE_API_BASE_URL;
  const getToken = options.getToken ?? (() => localStorage.getItem("accessToken"));
  const fetchFn = options.fetch ?? ((...args) => fetch(...args));
  const retryMs = options.retryMs ?? 3000;

  const controller = new AbortController();
  let closed = false;

  function dispatch(frame) {
    for (const line of frame.split("\n")) {
      if (!line.startsWith("data:")) continue; // ':' comments and blanks are keep-alives
      let event;
      try {
        event = JSON.parse(line.slice("data:".length).trim());
      } catch {
        continue;
      }
      const handler = handlers[event?.type];
      if (handler) handler(event);
    }
  }

  async function consume(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!closed) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      // SSE frames are separated by a blank line.
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (closed) return;
        dispatch(frame);
      }
    }
  }

  async function run() {
    while (!closed) {
      try {
        const response = await fetchFn(`${baseURL}/files/${fileId}/events`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });
        // No permission (or gone): don't reconnect, there's nothing to wait for.
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          return;
        }
        if (response.ok && response.body) {
          await consume(response.body);
        }
      } catch {
        if (closed || controller.signal.aborted) return;
      }
      if (closed) return;
      // The server closed the stream or a transient error hit — back off, reconnect.
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }

  run();

  return {
    close() {
      closed = true;
      controller.abort();
    },
  };
}
