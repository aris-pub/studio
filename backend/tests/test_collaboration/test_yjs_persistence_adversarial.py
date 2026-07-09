"""Adversarial property tests: no sequence of collaboration events duplicates content.

test_yjs_persistence_invariant proves idempotency for fixed reconnect counts.
This generalizes it: many randomized sequences of the events that historically
caused duplication — edits, saves, empty-room reconnects, reconnects while peers
survive, room teardowns (code 4000), peers joining and leaving — each asserting
that every logically inserted marker appears exactly once everywhere. Fixed seeds
keep CI deterministic.

The plaintext strategy is a ``strict`` xfail: if the harness ever fails to catch
the bug under plaintext, it proves nothing, and CI must flag that. This is the
guard for the whole class, including interleavings nobody has thought of yet.
"""

import random

import pytest
from pycrdt import Doc, Text


def _text(doc: Doc) -> str:
    return str(doc.get("text", type=Text))


def _sync(a: Doc, b: Doc) -> None:
    """One SyncStep1/2 exchange in both directions."""
    a.apply_update(b.get_update(a.get_state()))
    b.apply_update(a.get_update(b.get_state()))


def _converge(members) -> None:
    """Full-mesh sync so every connected member holds every item (what the relay does)."""
    for i in range(len(members)):
        for j in range(i + 1, len(members)):
            _sync(members[i], members[j])


class CrdtStore:
    """Authoritative CRDT-state persistence (the fix)."""

    def __init__(self):
        self.state = None

    def save(self, doc: Doc) -> None:
        self.state = doc.get_update()

    def restore(self, doc: Doc) -> None:
        if self.state is not None:
            doc.apply_update(self.state)


class PlaintextStore:
    """Plaintext persistence re-typed on load (the OLD, buggy design)."""

    def __init__(self):
        self.state = None

    def save(self, doc: Doc) -> None:
        self.state = _text(doc)

    def restore(self, doc: Doc) -> None:
        if self.state:
            t = doc.get("text", type=Text)
            with doc.transaction():
                t += self.state


def run_sequence(store_cls, seed: int, n_ops: int = 80) -> None:
    """Drive a randomized collaboration session and assert no duplication throughout.

    The room holds a backend member (which persists) plus zero or more peers. Each
    op mutates the world, the connected members converge, the backend persists, and
    we assert every inserted marker appears exactly once in every connected member
    and in the persisted+restored state.
    """
    rng = random.Random(seed)
    store = store_cls()

    backend = Doc()
    backend.get("text", type=Text)
    peers = [Doc()]
    peers[0].get("text", type=Text)

    inserted = 0

    def connected():
        return [backend] + peers

    def assert_no_dup(where):
        for i in range(inserted):
            marker = f"<m{i}>"
            for m in connected():
                c = _text(m).count(marker)
                assert c == 1, f"{where}: marker {marker} appears {c}x in a member: {_text(m)!r}"
        # Persisted-then-restored state must also hold exactly one of each.
        probe = Doc()
        probe.get("text", type=Text)
        store.restore(probe)
        for i in range(inserted):
            marker = f"<m{i}>"
            c = _text(probe).count(marker)
            assert c == 1, f"{where}: marker {marker} appears {c}x in restored store: {_text(probe)!r}"

    # Seed the room once (as a legacy file would seed, or a first edit).
    _converge(connected())
    store.save(backend)

    for _ in range(n_ops):
        op = rng.choice(
            ["edit", "save", "reconnect", "teardown_reconnect", "peer_join", "peer_leave"]
        )

        if op == "edit" and peers:
            p = rng.choice(peers)
            marker = f"<m{inserted}>"
            t = p.get("text", type=Text)
            with p.transaction():
                t += marker
            inserted += 1
            _converge(connected())
            store.save(backend)

        elif op == "save":
            store.save(backend)

        elif op == "reconnect":
            # Backend drops and reconnects into a room where peers survive.
            backend = Doc()
            backend.get("text", type=Text)
            store.restore(backend)
            _converge(connected())
            store.save(backend)

        elif op == "teardown_reconnect":
            # Room torn down (code 4000): backend reconnects to an EMPTY room,
            # restores from the store, persists. Peers rejoin afterwards.
            surviving = peers
            peers = []
            backend = Doc()
            backend.get("text", type=Text)
            store.restore(backend)
            store.save(backend)
            peers = surviving
            _converge(connected())

        elif op == "peer_join":
            newp = Doc()
            newp.get("text", type=Text)
            peers.append(newp)
            _converge(connected())

        elif op == "peer_leave" and len(peers) > 1:
            peers.pop(rng.randrange(len(peers)))

        assert_no_dup(op)


SEEDS = [1, 7, 42, 99, 256, 1024, 4095, 8191, 31337, 65535]


@pytest.mark.parametrize("seed", SEEDS)
def test_crdt_persistence_never_duplicates_under_adversarial_ops(seed):
    """The fix survives every randomized interleaving."""
    run_sequence(CrdtStore, seed)


@pytest.mark.parametrize("seed", SEEDS)
@pytest.mark.xfail(
    strict=True,
    reason=(
        "plaintext persistence duplicates under adversarial reconnect/peer "
        "interleavings. Strict xfail proves the harness can actually catch the "
        "bug; if it stops failing, the harness (or a hidden guard) is masking it."
    ),
)
def test_plaintext_persistence_duplicates_under_adversarial_ops(seed):
    run_sequence(PlaintextStore, seed)


# ---------------------------------------------------------------------------
# Round-trip fidelity — the encoded state must reproduce content byte-exactly,
# including the characters behind the "backslash doubling" mechanism (#4).
# ---------------------------------------------------------------------------

FIDELITY_CONTENT = [
    "plain ascii text",
    "backslashes: \\ \\\\ \\int_0^\\infty \\frac{a}{b} \\\\[2mm]",
    "unicode: café — naïve — 数学 — 𝕏 — ​ zero-width",
    "newlines\nand\ttabs\r\nmixed",
    "# RSM\n\n:author: {:email: a@b.com}\n\n$$\\sum_{i=0}^n x_i$$",
    "",
]


@pytest.mark.parametrize("content", FIDELITY_CONTENT)
def test_crdt_state_roundtrip_is_byte_exact(content):
    """Restore via get_update/apply_update reproduces content exactly, and doing
    it repeatedly (reconnects) never mutates or doubles it."""
    src = Doc()
    st = src.get("text", type=Text)
    with src.transaction():
        st += content
    state = src.get_update()

    for _ in range(5):
        restored = Doc()
        restored.get("text", type=Text)
        restored.apply_update(state)
        assert _text(restored) == content
        state = restored.get_update()  # re-persist, as a save cycle would


def test_backslash_content_survives_reconnect_with_peer():
    """Backslash-heavy LaTeX (the historical mechanism-4 doubling) stays intact
    and single-copy across reconnects with a surviving peer."""
    latex = "$$\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$"
    store = CrdtStore()
    peer = Doc()
    pt = peer.get("text", type=Text)
    with peer.transaction():
        pt += latex
    store.save(peer)

    for _ in range(6):
        backend = Doc()
        backend.get("text", type=Text)
        store.restore(backend)
        _sync(backend, peer)
        store.save(backend)
        assert _text(peer) == latex
        assert _text(peer).count("\\int") == 1
        assert "\\\\" not in _text(peer)  # no doubled backslashes
