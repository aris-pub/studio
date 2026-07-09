"""Integration guard: the REAL persistence path is idempotent across reconnects.

test_yjs_persistence_invariant proves the invariant at the strategy level. This
file proves the actual ``YDocClient._load_from_db`` / ``_save_to_db`` wiring
honors it: restore prefers ``ydoc_state`` via apply_update, seeds from plaintext
exactly once for a legacy row, and never duplicates content when the backend
reconnects (fresh ``Doc``) into a room a surviving peer still holds — the
production "reload / multi-player restart" scenario that doubled content.

The DB is a tiny in-memory row so the test exercises the real branching in
_load_from_db/_save_to_db (SELECT source, ydoc_state -> apply_update vs seed)
without a database or websockets: fast and non-flaky.
"""

import pytest
from pycrdt import Doc, Text

from aris.collaboration import yjs_client
from aris.collaboration.yjs_client import YDocClient


SENTINEL = "# Manuscript\n\none logical copy of this line"


class _Row:
    def __init__(self, source=None, ydoc_state=None):
        self.source = source
        self.ydoc_state = ydoc_state


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row


class _FakeSession:
    """Interprets the two raw statements _load_from_db/_save_to_db issue."""

    def __init__(self, store: _Row):
        self.store = store

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, statement, params):
        sql = str(statement).strip().lower()
        if sql.startswith("select"):
            return _FakeResult((self.store.source, self.store.ydoc_state))
        # UPDATE files SET source = :content, ydoc_state = :ydoc_state
        self.store.source = params.get("content", self.store.source)
        self.store.ydoc_state = params.get("ydoc_state", self.store.ydoc_state)
        return _FakeResult(None)

    async def commit(self):
        pass


@pytest.fixture
def store(monkeypatch):
    s = _Row()
    monkeypatch.setattr(yjs_client, "CollabSession", lambda: _FakeSession(s))
    return s


def _fresh_client_doc(client: YDocClient) -> None:
    """Mirror _connect_and_run creating a brand-new Doc (new client_id) per connect."""
    client.doc = Doc()
    client.text = client.doc.get("text", type=Text)


async def _restore(client: YDocClient) -> None:
    # Real caller sets this while loading; keep parity.
    client._in_sync_operation = True
    try:
        await client._load_from_db()
    finally:
        client._in_sync_operation = False


@pytest.mark.asyncio
async def test_legacy_file_seeds_once_then_becomes_binary_authoritative(store):
    store.source = SENTINEL
    store.ydoc_state = None  # legacy row: no CRDT state yet

    client = YDocClient(file_id=1, websocket_url="ws://x", debounce_ms=99999)
    _fresh_client_doc(client)

    await _restore(client)

    assert str(client.text) == SENTINEL
    assert store.ydoc_state is not None, "seed must persist the encoded state"
    assert isinstance(store.ydoc_state, (bytes, bytearray))


@pytest.mark.asyncio
async def test_reconnect_into_surviving_peer_does_not_duplicate(store):
    """The production doubling scenario, through the real persistence code.

    A surviving peer holds SENTINEL across N backend reconnects. Each reconnect
    the backend makes a fresh Doc, restores from the store, syncs with the peer,
    and persists. Content must stay exactly one copy for any N.

    The peer's content DERIVES from the authoritative ydoc_state (in production it
    arrived via the backend's broadcast/sync), so it shares CRDT item identity.
    That is exactly the condition the fix guarantees and the old frontend
    plaintext seed violated: identity comes from one authoritative source, never
    from independent re-typing.
    """
    seed = Doc()
    seed_text = seed.get("text", type=Text)
    with seed.transaction():
        seed_text += SENTINEL
    store.source = SENTINEL
    store.ydoc_state = seed.get_update()

    peer = Doc()
    peer_text = peer.get("text", type=Text)
    peer.apply_update(store.ydoc_state)

    client = YDocClient(file_id=1, websocket_url="ws://x", debounce_ms=99999)

    for cycle in range(8):
        _fresh_client_doc(client)
        await _restore(client)
        # Sync handshake with the surviving peer, both directions.
        client.doc.apply_update(peer.get_update(client.doc.get_state()))
        peer.apply_update(client.doc.get_update(peer.get_state()))
        await client._save_to_db(force=True)

        assert str(peer_text).count("# Manuscript") == 1, (
            f"content duplicated after {cycle + 1} reconnect(s): {str(peer_text)!r}"
        )
        assert str(peer_text) == SENTINEL


@pytest.mark.asyncio
async def test_empty_room_restore_recovers_content_after_teardown(store):
    """After a 4000 teardown the backend reconnects to an empty room and must
    restore the saved document (the 'edits lost after reload' regression)."""
    # File already has binary state from prior editing.
    seed_doc = Doc()
    st = seed_doc.get("text", type=Text)
    with seed_doc.transaction():
        st += SENTINEL
    store.source = SENTINEL
    store.ydoc_state = seed_doc.get_update()

    client = YDocClient(file_id=1, websocket_url="ws://x", debounce_ms=99999)
    _fresh_client_doc(client)  # fresh empty Doc, as on reconnect to empty room

    await _restore(client)

    assert str(client.text) == SENTINEL
    assert str(client.text).count("# Manuscript") == 1


@pytest.mark.asyncio
async def test_load_prefers_ydoc_state_and_ignores_stale_source(store):
    """When ydoc_state is present the loader restores from it and IGNORES source.

    Binary state is authoritative; a divergent/stale plaintext source must never
    be re-typed into a live Doc (doing so is the non-idempotent seed that
    duplicated content).
    """
    seed = Doc()
    st = seed.get("text", type=Text)
    with seed.transaction():
        st += "# Authoritative\n\nbinary content"
    store.ydoc_state = seed.get_update()
    store.source = "# Stale\n\nplaintext that must be ignored on load"

    client = YDocClient(file_id=1, websocket_url="ws://x", debounce_ms=99999)
    _fresh_client_doc(client)
    await _restore(client)

    assert str(client.text) == "# Authoritative\n\nbinary content"
    assert "Stale" not in str(client.text)


@pytest.mark.asyncio
async def test_backslash_content_roundtrips_through_real_save_load(store):
    """Backslash-heavy LaTeX survives the real _save_to_db/_load_from_db cycle
    without doubling backslashes or content (historical mechanism 4)."""
    latex = "$$\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$"
    store.source = latex
    store.ydoc_state = None  # legacy row: seed once from source

    client = YDocClient(file_id=1, websocket_url="ws://x", debounce_ms=99999)
    _fresh_client_doc(client)
    await _restore(client)  # seeds from source, persists ydoc_state
    assert str(client.text) == latex
    assert store.ydoc_state is not None

    # Reconnect now restores from the binary state, still byte-exact.
    _fresh_client_doc(client)
    await _restore(client)
    assert str(client.text) == latex
    assert str(client.text).count("\\int") == 1
    assert "\\\\" not in str(client.text)
