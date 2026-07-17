"""General in-process pub/sub for per-file events.

Any backend code can publish a typed event to a file, and any number of
subscribers (e.g. one Server-Sent-Events stream per open browser tab) receive
it. Events are plain dicts carrying at least a ``type``; the transport and the
consumers decide what the types mean.

First consumer: the asset-change notification (std-iu0n) that tells an open tab
to recompile when a file's asset changes out of band. Kept deliberately generic
so any file-scoped event (comment added, version created, collaborator joined)
can reuse the same channel.

In-process only: state lives in one process, which is correct for the current
single backend instance. Moving to multiple instances would need a shared bus
(Redis pub/sub, Postgres LISTEN/NOTIFY) behind this same interface.
"""

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator


class FileEventBroker:
    """Fan-out of file-scoped events to live subscribers."""

    def __init__(self) -> None:
        self._subscribers: dict[int, set[asyncio.Queue]] = {}

    def publish(self, file_id: int, event: dict[str, Any]) -> int:
        """Deliver ``event`` to every current subscriber of ``file_id``.

        Non-blocking: the event is queued for each subscriber and never awaits a
        consumer, so a slow or stalled subscriber cannot hold up the publisher.
        Returns the number of subscribers reached (0 is a harmless no-op).
        """
        queues = self._subscribers.get(file_id)
        if not queues:
            return 0
        for queue in queues:
            queue.put_nowait(event)
        return len(queues)

    @asynccontextmanager
    async def subscribe(self, file_id: int) -> AsyncIterator[asyncio.Queue]:
        """Subscribe to ``file_id`` for the duration of the context.

        Yields a queue that receives every event published after subscription;
        the subscription is torn down on exit, even if the consumer is cancelled
        (e.g. the browser closes the SSE connection).
        """
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(file_id, set()).add(queue)
        try:
            yield queue
        finally:
            subscribers = self._subscribers.get(file_id)
            if subscribers is not None:
                subscribers.discard(queue)
                if not subscribers:
                    del self._subscribers[file_id]

    def subscriber_count(self, file_id: int) -> int:
        """Number of live subscribers for a file (0 if none)."""
        return len(self._subscribers.get(file_id, ()))


async def sse_event_stream(
    broker: FileEventBroker, file_id: int
) -> AsyncIterator[str]:
    """Server-Sent-Events view of a file's event stream.

    Subscribes to ``file_id`` and yields SSE-framed strings: an initial ``:``
    comment (flushes headers, confirms the subscription is live, keep-alive),
    then one ``data:`` line per published event. Runs until the consumer stops
    iterating (the browser closing the connection), at which point the
    subscription is torn down.
    """
    async with broker.subscribe(file_id) as queue:
        yield ": connected\n\n"
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"


_broker = FileEventBroker()


def get_event_broker() -> FileEventBroker:
    """FastAPI dependency / accessor for the process-wide broker singleton."""
    return _broker
