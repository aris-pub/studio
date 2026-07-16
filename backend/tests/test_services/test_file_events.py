"""Tests for the general per-file event broker (in-process pub/sub).

The broker is transport-agnostic: publishers push typed events to a file_id and
any number of subscribers receive them. Its first consumer is the asset-change
notification (std-iu0n), but it is deliberately generic so any file-scoped event
(comments, version created, collaborator joined, ...) can reuse it.
"""

import asyncio

from aris.services.file_events import FileEventBroker, sse_event_stream


async def test_publish_delivers_to_subscriber():
    broker = FileEventBroker()
    async with broker.subscribe(1) as q:
        reached = broker.publish(1, {"type": "asset-changed"})
        assert reached == 1
        event = await asyncio.wait_for(q.get(), timeout=1)
        assert event == {"type": "asset-changed"}


async def test_publish_reaches_all_subscribers():
    broker = FileEventBroker()
    async with broker.subscribe(1) as q1, broker.subscribe(1) as q2:
        assert broker.publish(1, {"type": "x"}) == 2
        assert (await q1.get())["type"] == "x"
        assert (await q2.get())["type"] == "x"


async def test_publish_with_no_subscribers_is_a_noop():
    broker = FileEventBroker()
    assert broker.publish(999, {"type": "x"}) == 0


async def test_events_are_isolated_by_file_id():
    broker = FileEventBroker()
    async with broker.subscribe(1) as q1, broker.subscribe(2) as q2:
        broker.publish(1, {"type": "for-1"})
        assert (await q1.get())["type"] == "for-1"
        assert q2.empty()


async def test_subscriber_is_removed_on_context_exit():
    broker = FileEventBroker()
    async with broker.subscribe(1):
        assert broker.subscriber_count(1) == 1
    assert broker.subscriber_count(1) == 0
    # publishing after everyone has left is a harmless no-op
    assert broker.publish(1, {"type": "x"}) == 0


async def test_one_slow_subscriber_does_not_block_publish():
    # put_nowait means publish never awaits a consumer; the event just queues.
    broker = FileEventBroker()
    async with broker.subscribe(1) as q:
        for i in range(5):
            broker.publish(1, {"type": "n", "i": i})
        assert q.qsize() == 5


async def test_sse_stream_yields_connected_comment_then_data_lines():
    broker = FileEventBroker()
    stream = sse_event_stream(broker, 1)
    try:
        first = await asyncio.wait_for(stream.__anext__(), timeout=1)
        assert first.startswith(":")  # the initial keep-alive comment
        # subscription is live once the comment is out; a publish becomes a data line
        broker.publish(1, {"type": "asset-changed"})
        data = await asyncio.wait_for(stream.__anext__(), timeout=1)
        assert data == 'data: {"type": "asset-changed"}\n\n'
    finally:
        await stream.aclose()


async def test_sse_stream_unsubscribes_when_closed():
    broker = FileEventBroker()
    stream = sse_event_stream(broker, 1)
    await asyncio.wait_for(stream.__anext__(), timeout=1)  # enter the subscription
    assert broker.subscriber_count(1) == 1
    await stream.aclose()
    assert broker.subscriber_count(1) == 0
