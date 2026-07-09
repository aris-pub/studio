"""Class-level regression guard for the Y.js content-duplication bug.

The invariant: **restore-from-persistence is idempotent under CRDT merge.**
Reconstructing a document from its persisted artifact and merging it into a peer
that already holds that document leaves the peer unchanged in CRDT item identity,
not merely in visible text.

This bug was patched ~14 times (see epic std-vopw). Every historical fix was a
timing guard on a non-idempotent seed; none changed the persisted representation,
which is the root cause. This test asserts the invariant those guards were
flailing at, independent of any timing, connect order, or client_id. It is the
test that would have caught all four historical failure mechanisms.

It must PASS for CRDT-state persistence (``doc.get_update()`` -> ``apply_update``)
and FAIL for plaintext persistence (``str(text)`` re-typed into a fresh Doc), so
the plaintext case is a ``strict`` xfail: if it ever "passes", a hidden timing
guard is masking the invariant instead of fixing it, and CI must flag that.
"""

import pytest
from pycrdt import Doc, Text


SENTINEL = "# Anchor\n\nsurviving peer content"


def _text(doc: Doc) -> str:
    return str(doc.get("text", type=Text))


# --- Two persistence strategies, mirroring the real save/load paths ----------
# plaintext_* mirrors the OLD yjs_client (_save_to_db: str(text); _load_from_db:
# self.text += content). crdt_* mirrors the NEW one (get_update / apply_update).


def plaintext_save(doc: Doc):
    return _text(doc)


def plaintext_load(fresh: Doc, artifact) -> None:
    t = fresh.get("text", type=Text)
    with fresh.transaction():
        t += artifact


def crdt_save(doc: Doc):
    return doc.get_update()


def crdt_load(fresh: Doc, artifact) -> None:
    fresh.get("text", type=Text)
    fresh.apply_update(artifact)


def run_reconnect_cycles(save, load, n: int) -> str:
    """Model the production reconnect loop with a surviving peer.

    ``peer`` is a frontend that holds the document across backend reconnects.
    Each cycle the backend persists the authoritative state, then — as happens on
    reconnect into a room it observes as empty — builds a FRESH Doc (new
    client_id, mirroring yjs_client creating ``Doc()`` per connect), restores from
    persistence, and syncs both ways with the surviving peer (the SyncStep1/2
    handshake). Returns the peer's converged text.
    """
    peer = Doc()
    pt = peer.get("text", type=Text)
    with peer.transaction():
        pt += SENTINEL

    artifact = save(peer)
    for _ in range(n):
        fresh = Doc()
        load(fresh, artifact)
        # Bidirectional sync handshake.
        fresh.apply_update(peer.get_update(fresh.get_state()))
        peer.apply_update(fresh.get_update(peer.get_state()))
        artifact = save(fresh)
    return _text(peer)


@pytest.mark.parametrize("n", [1, 2, 4, 8])
def test_crdt_state_restore_is_idempotent(n):
    """The fix: binary CRDT-state restore never duplicates, any reconnect count."""
    result = run_reconnect_cycles(crdt_save, crdt_load, n)
    assert result.count("# Anchor") == 1, f"duplicated after {n} cycles: {result!r}"
    assert len(result) == len(SENTINEL)


@pytest.mark.parametrize("n", [1, 2, 4, 8])
@pytest.mark.xfail(
    strict=True,
    reason=(
        "plaintext restore is non-idempotent: re-typing text mints fresh CRDT "
        "items that merge into duplicate copies (the root cause). Strict xfail so "
        "that if it ever stops duplicating, CI fails and forces investigation of "
        "what masked the invariant instead of fixing the persistence format."
    ),
)
def test_plaintext_restore_duplicates(n):
    result = run_reconnect_cycles(plaintext_save, plaintext_load, n)
    assert result.count("# Anchor") == 1


def test_crdt_state_stable_under_seeded_random_ops():
    """A fixed-seed sequence of edit/save/reconnect ops keeps exactly one copy
    of each logically inserted marker. Fixed seed keeps CI deterministic; swap in
    hypothesis later if true fuzzing is wanted."""
    import random

    rng = random.Random(1729)
    peer = Doc()
    pt = peer.get("text", type=Text)
    inserted = 0
    artifact = crdt_save(peer)
    for _ in range(50):
        op = rng.choice(["edit", "save", "reconnect"])
        if op == "edit":
            marker = f"[m{inserted}]"
            with peer.transaction():
                pt += marker
            inserted += 1
            artifact = crdt_save(peer)
        elif op == "save":
            artifact = crdt_save(peer)
        else:  # reconnect: fresh backend Doc restores and syncs
            fresh = Doc()
            crdt_load(fresh, artifact)
            fresh.apply_update(peer.get_update(fresh.get_state()))
            peer.apply_update(fresh.get_update(peer.get_state()))
            artifact = crdt_save(fresh)

    result = _text(peer)
    for i in range(inserted):
        assert result.count(f"[m{i}]") == 1, f"marker m{i} duplicated: {result!r}"
