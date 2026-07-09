"""Regression guard: exactly one place types stored plaintext into a live Doc.

The content-duplication bug (epic std-vopw) came from re-typing stored text into a
CRDT, which mints fresh, mergeable item identity. The fix routes every such
conversion through a single, named, loudly-warned helper (_seed_doc_from_plaintext)
and restores everything else via apply_update(ydoc_state). This guard fails if a
future change reintroduces a text->Doc seed anywhere else in the client, which is
exactly how a 15th timing-guard "fix" would sneak the class back in.
"""

import ast
import inspect

from aris.collaboration import yjs_client


SEED_HELPER = "_seed_doc_from_plaintext"


def _functions_appending_to_text():
    """Return the names of functions containing `self.text += ...`."""
    tree = ast.parse(inspect.getsource(yjs_client))
    offenders = set()

    class Visitor(ast.NodeVisitor):
        def __init__(self):
            self.stack = []

        def visit_FunctionDef(self, node):
            self.stack.append(node.name)
            self.generic_visit(node)
            self.stack.pop()

        visit_AsyncFunctionDef = visit_FunctionDef

        def visit_AugAssign(self, node):
            target = node.target
            if (
                isinstance(target, ast.Attribute)
                and target.attr == "text"
                and isinstance(target.value, ast.Name)
                and target.value.id == "self"
            ):
                if self.stack:
                    offenders.add(self.stack[-1])
            self.generic_visit(node)

    Visitor().visit(tree)
    return offenders


def test_only_seed_helper_types_text_into_doc():
    offenders = _functions_appending_to_text()
    extra = offenders - {SEED_HELPER}
    assert not extra, (
        f"`self.text += ...` types stored plaintext into a live Doc and mints "
        f"fresh CRDT identity — the root cause of the content-duplication class. "
        f"It must live ONLY in {SEED_HELPER}, but was found in: {sorted(extra)}. "
        f"Restore content via self.doc.apply_update(ydoc_state) instead."
    )


def test_seed_helper_still_exists_and_is_the_documented_call_site():
    """If the helper is renamed/removed, this guard must be updated deliberately."""
    assert hasattr(yjs_client.YDocClient, SEED_HELPER), (
        f"{SEED_HELPER} is the single sanctioned text->Doc seed path; if you "
        f"renamed it, update test_yjs_client_seed_guard.py to match."
    )


def test_save_encodes_binary_state_and_load_applies_it():
    """Lock the fix's shape: save must call doc.get_update(); load must call
    doc.apply_update(). Prevents a silent revert to plaintext persistence."""
    save_src = inspect.getsource(yjs_client.YDocClient._save_to_db)
    load_src = inspect.getsource(yjs_client.YDocClient._load_from_db)
    assert "get_update()" in save_src, "_save_to_db must persist encoded CRDT state"
    assert "ydoc_state" in save_src, "_save_to_db must write the ydoc_state column"
    assert "apply_update" in load_src, "_load_from_db must restore via apply_update"
