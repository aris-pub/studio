"""The backend acks REAL persistence, closing the silent data-loss window (std-wmjv).

Saving flows only through this backend client. The editor's status chip used to
reflect the relay link, not whether Postgres actually received the write, so a
crashed persistence peer or a failing DB write left every tab "green" while work
was silently lost.

Fix: after a successful ``_save_to_db`` commit, publish a ``persisted`` event on
the file's in-process event broker; the SSE channel relays it to open tabs, which
turn it into a true "saved" indicator. These tests pin the contract:

  * a committed write publishes exactly one ``persisted`` event for that file, and
  * a FAILED write publishes nothing (never a false "saved"), and
  * a broker error can never turn a successful save into a failure.
"""

import asyncio

import pytest
from pycrdt import Doc, Text

from aris.collaboration import yjs_client
from aris.collaboration.yjs_client import YDocClient
from aris.services.file_events import FileEventBroker


class _FakeSession:
    """Minimal async-context DB session; optionally fails at commit."""

    def __init__(self, fail_commit: bool = False):
        self.fail_commit = fail_commit
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, statement, params):
        return None

    async def commit(self):
        if self.fail_commit:
            raise RuntimeError("DB write failed")
        self.committed = True


def _make_client(file_id: int = 42) -> YDocClient:
    c = YDocClient(file_id=file_id, websocket_url="ws://x", debounce_ms=50)
    c.doc = Doc()
    c.text = c.doc.get("text", type=Text)
    with c.doc.transaction():
        c.text += "hello world"
    return c


@pytest.fixture
def broker(monkeypatch):
    """Swap the process-wide broker for a fresh, isolated instance."""
    b = FileEventBroker()
    monkeypatch.setattr(yjs_client, "get_event_broker", lambda: b)
    return b


@pytest.mark.asyncio
async def test_successful_save_publishes_persisted_event(broker, monkeypatch):
    monkeypatch.setattr(yjs_client, "CollabSession", lambda: _FakeSession())
    client = _make_client(file_id=7)

    async with broker.subscribe(7) as q:
        await client._save_to_db()
        event = await asyncio.wait_for(q.get(), timeout=1)

    assert event["type"] == "persisted"
    assert isinstance(event["at"], int)
    assert event["at"] > 0


@pytest.mark.asyncio
async def test_persisted_event_targets_only_this_file(broker, monkeypatch):
    monkeypatch.setattr(yjs_client, "CollabSession", lambda: _FakeSession())
    client = _make_client(file_id=7)

    async with broker.subscribe(7) as mine, broker.subscribe(8) as other:
        await client._save_to_db()
        assert (await asyncio.wait_for(mine.get(), timeout=1))["type"] == "persisted"
        assert other.empty()


@pytest.mark.asyncio
async def test_failed_save_publishes_nothing(broker, monkeypatch):
    """A DB write that never commits must never emit a (false) "saved" ack."""
    monkeypatch.setattr(yjs_client, "CollabSession", lambda: _FakeSession(fail_commit=True))
    client = _make_client(file_id=9)

    async with broker.subscribe(9) as q:
        await client._save_to_db()  # swallows the DB error, does not raise
        assert q.empty()


@pytest.mark.asyncio
async def test_broker_error_never_breaks_the_save(monkeypatch):
    """If publishing the ack blows up, the (already committed) save still succeeds."""
    session = _FakeSession()
    monkeypatch.setattr(yjs_client, "CollabSession", lambda: session)

    class _BoomBroker:
        def publish(self, *args, **kwargs):
            raise RuntimeError("broker exploded")

    monkeypatch.setattr(yjs_client, "get_event_broker", lambda: _BoomBroker())
    client = _make_client(file_id=11)

    await client._save_to_db()  # must not raise

    assert session.committed is True
