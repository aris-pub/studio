"""Guard: every authenticated route must have cross-user (IDOR) test coverage.

The bugs fixed in #453 were not bugs anyone consciously accepted; they were bugs
no test was watching for. A route that let user B read or mutate user A's
resource shipped because nothing asserted otherwise. This module makes that class
of bug fail CI.

It works in two parts:

1. ``test_authenticated_routes_have_cross_user_coverage`` enumerates every route
   whose dependency tree includes the ``current_user`` auth dependency and asserts
   each one is accounted for in exactly one of two registries below. A new
   authenticated route added without an entry fails the test, forcing the author
   to either write a cross-user test or justify why the route is self-scoped.

2. The parametrized ``test_cross_user_*`` tests in this file provide the actual
   "user B cannot touch user A's resource" assertions for the routes that were not
   already covered by the per-route suites (mostly the #453 additions).

Route templates in the registries must match ``APIRoute.path`` exactly; a typo
surfaces as a "stale registry entry" failure.
"""
import pytest
import pytest_asyncio
from fastapi.routing import APIRoute

from aris.deps import current_user
from main import app


# Any of these means "the request was refused"; a cross-user request must never
# reach 2xx. 404 is a valid refusal (several routes hide existence deliberately).
DENIED = {401, 403, 404}


def _dependant_calls(dependant):
    """Every callable in a route's dependency tree, recursively."""
    calls = set()
    if dependant.call is not None:
        calls.add(dependant.call)
    for sub in dependant.dependencies:
        calls |= _dependant_calls(sub)
    return calls


def authenticated_routes():
    """Set of (METHOD, path) for every route that depends on ``current_user``.

    Catches routes that depend on ``current_user`` directly and those that depend
    on it transitively through the ``require_*`` authorization guards.
    """
    routes = set()
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if current_user in _dependant_calls(route.dependant):
            for method in route.methods - {"HEAD", "OPTIONS"}:
                routes.add((method, route.path))
    return routes


# Routes with a cross-user attack surface, each mapped to the test that proves
# user B cannot reach user A's resource. Entries pointing at "test_cross_user_*"
# are covered by the parametrized tests in THIS file; the rest reference the
# per-route suites (most added in #453).
CROSS_USER_TESTED: dict[tuple[str, str], str] = {
    # --- covered by the parametrized tests in this file ---
    ("GET", "/files/{file_id}/assets"): "test_cross_user_file_scoped_denied",
    ("GET", "/files/{file_id}/assets/by-name/{filename:path}"): "test_cross_user_file_scoped_denied",
    ("GET", "/files/{file_id}/content"): "test_cross_user_file_scoped_denied",
    ("GET", "/files/{file_id}/content/{section_name}"): "test_cross_user_file_scoped_denied",
    ("GET", "/files/{file_id}/versions"): "test_cross_user_file_scoped_denied",
    ("GET", "/files/{file_id}/versions/{version_id}/preview"): "test_cross_user_file_scoped_denied",
    ("POST", "/files/{file_id}/duplicate"): "test_cross_user_file_scoped_denied",
    ("PUT", "/files/{file_id}/assets/{asset_id}"): "test_cross_user_file_scoped_denied",
    ("DELETE", "/files/{file_id}"): "test_cross_user_file_scoped_denied",
    ("DELETE", "/files/{file_id}/assets/{asset_id}"): "test_cross_user_file_scoped_denied",
    ("DELETE", "/files/{file_id}/permissions/{permission_id}"): "test_cross_user_file_scoped_denied",
    ("DELETE", "/files/{file_id}/versions/{version_id}"): "test_cross_user_file_scoped_denied",
    ("GET", "/reactions/"): "test_cross_user_reactions_denied",
    ("PUT", "/reactions/"): "test_cross_user_reactions_denied",
    ("DELETE", "/reactions/"): "test_cross_user_reactions_denied",
    ("POST", "/annotations/"): "test_cross_user_annotations_denied",
    ("POST", "/annotations/{annotation_id}/messages"): "test_cross_user_annotations_denied",
    ("DELETE", "/annotations/{annotation_id}"): "test_cross_user_annotations_denied",
    ("DELETE", "/annotations/messages/{message_id}"): "test_cross_user_annotations_denied",
    ("GET", "/users/{user_id}/export"): "test_cross_user_user_scoped_denied",
    ("DELETE", "/users/{user_id}/files/{file_id}/tags/{tag_id}"): "test_cross_user_user_scoped_denied",
    # --- covered by the per-route suites (mostly #453) ---
    ("GET", "/files/{file_id}"): "test_routes_file.py::test_file_permissions",
    ("PUT", "/files/{file_id}"): "test_routes_file.py::test_file_permissions",
    ("POST", "/files/{file_id}/download"): "test_routes_file.py::test_download_file_permission_denied",
    ("POST", "/files/{file_id}/download/pdf"): "test_routes_file.py::test_download_pdf_permission_denied",
    ("POST", "/files/{file_id}/assets"): "test_routes_file_assets.py::test_upload_asset_viewer_forbidden",
    ("POST", "/files/{file_id}/collab/start"): "test_routes_collab.py::test_collab_start_forbidden_for_user_without_permission_row",
    ("POST", "/files/{file_id}/collab/stop"): "test_routes_collab.py::test_collab_stop_forbidden_for_user_without_permission",
    ("POST", "/files/{file_id}/collab/flush"): "test_routes_collab.py::test_collab_flush_forbidden_for_user_without_permission",
    ("POST", "/files/{file_id}/versions/named"): "test_routes_versions.py::test_create_version_unauthorized",
    ("PUT", "/files/{file_id}/versions/{version_id}"): "test_routes_versions.py::test_rename_version_unauthorized",
    ("GET", "/files/{file_id}/permissions"): "test_routes_permissions.py::test_list_collaborators_as_editor_forbidden",
    ("POST", "/files/{file_id}/permissions"): "test_routes_permissions.py::test_add_collaborator_as_editor_forbidden",
    ("PUT", "/files/{file_id}/permissions/{permission_id}"): "test_routes_permissions.py::test_update_collaborator_role_as_editor_forbidden",
    ("POST", "/render/private"): "test_render_private.py::test_render_private_forbidden_without_access",
    ("POST", "/settings/{file_id}"): "test_routes_file_settings.py::test_upsert_file_settings_access_denied",
    ("GET", "/annotations/"): "test_routes_file_annotations.py::test_list_annotations_hides_other_users_private",
    ("GET", "/annotations/{annotation_id}"): "test_routes_file_annotations.py::test_get_other_users_private_annotation_returns_404",
    ("GET", "/annotations/{annotation_id}/messages"): "test_routes_file_annotations.py::test_list_messages_of_other_users_private_annotation_returns_404",
    ("GET", "/annotations/messages/{message_id}"): "test_routes_file_annotations.py::test_get_single_message_of_other_users_private_annotation_returns_404",
    ("PUT", "/annotations/{annotation_id}"): "test_routes_file_annotations.py::test_update_annotation_not_owner",
    ("PUT", "/annotations/messages/{message_id}"): "test_routes_file_annotations.py::test_update_other_users_message",
    ("GET", "/users/{user_id}"): "test_routes_user.py::test_get_user_cross_user_forbidden",
    ("PUT", "/users/{user_id}"): "test_routes_user.py::test_update_user_cross_user_forbidden",
    ("DELETE", "/users/{user_id}"): "test_routes_user.py::test_soft_delete_cross_user_forbidden",
    ("GET", "/users/{user_id}/avatar"): "test_routes_user.py::test_get_profile_picture_unauthorized",
    ("POST", "/users/{user_id}/avatar"): "test_routes_user.py::test_upload_profile_picture_unauthorized",
    ("DELETE", "/users/{user_id}/avatar"): "test_routes_user.py::test_delete_profile_picture_unauthorized",
    ("POST", "/users/{user_id}/change-password"): "test_routes_user.py::test_change_password_cross_user_forbidden",
    ("POST", "/users/{user_id}/send-verification"): "test_routes_user.py::test_send_verification_cross_user_forbidden",
    ("GET", "/users/{user_id}/files"): "test_routes_user.py::test_get_user_files_cross_user_forbidden",
    ("GET", "/users/{user_id}/files/{file_id}"): "test_routes_user.py::test_get_user_file_cross_user_forbidden",
    ("GET", "/users/{user_id}/tags"): "test_routes_tag.py::test_get_user_tags_cross_user_forbidden",
    ("POST", "/users/{user_id}/tags"): "test_routes_tag.py::test_create_tag_cross_user_forbidden",
    ("PUT", "/users/{user_id}/tags/{_id}"): "test_routes_tag.py::test_update_tag_cross_user_forbidden",
    ("DELETE", "/users/{user_id}/tags/{tag_id}"): "test_routes_tag.py::test_delete_tag_cross_user_forbidden",
    ("GET", "/users/{user_id}/files/{file_id}/tags"): "test_routes_tag.py::test_get_user_file_tags_cross_user_forbidden",
    ("POST", "/users/{user_id}/files/{file_id}/tags/{tag_id}"): "test_routes_tag.py::test_add_tag_to_file_cross_user_forbidden",
}

# Routes with NO cross-user attack surface: they only ever act on the caller's
# own data (no external resource id), so there is nothing to cross. Each entry
# carries the reason.
SELF_SCOPED: dict[tuple[str, str], str] = {
    ("GET", "/files"): "lists only the caller's own accessible files",
    ("GET", "/me"): "returns only the caller's own profile",
    ("GET", "/user-settings"): "caller-scoped settings; no external id",
    ("POST", "/user-settings"): "caller-scoped settings; no external id",
    ("GET", "/settings/defaults"): "caller-scoped defaults; no external id",
    ("POST", "/settings/defaults"): "caller-scoped defaults; no external id",
    ("GET", "/settings/{file_id}"): "returns generic defaults keyed to the caller; exposes no per-file data",
    ("POST", "/feedback"): "feedback is attributed to the caller; no external id",
    ("POST", "/files"): "new file is owned by the caller; body owner_id ignored (test_create_file_owner_id_in_body_is_ignored)",
    ("POST", "/files/import"): "imported file is owned by the caller",
    ("POST", "/users/lookup"): "intentional email->public-profile directory lookup, rate-limited; not an ownership boundary",
}


def test_enumeration_finds_known_authenticated_routes():
    """Sanity-check the enumeration helper against known routes."""
    routes = authenticated_routes()
    assert ("GET", "/files/{file_id}") in routes  # require_view
    assert ("PUT", "/users/{user_id}") in routes  # require_self
    assert ("GET", "/me") in routes  # plain current_user
    assert ("GET", "/health") not in routes  # unauthenticated


def test_authenticated_routes_have_cross_user_coverage():
    """Every authenticated route is either cross-user-tested or self-scoped.

    This is the regression guard: a new authenticated route with no entry here
    fails, so the class of IDOR bug from #453 cannot silently ship again.
    """
    actual = authenticated_routes()
    documented = set(CROSS_USER_TESTED) | set(SELF_SCOPED)

    missing = actual - documented
    assert not missing, (
        "Authenticated route(s) with no cross-user coverage entry.\n"
        "Add a 'user B cannot touch user A' test and register it in "
        "CROSS_USER_TESTED, or, if the route only ever touches the caller's own "
        "data, add it to SELF_SCOPED with a reason:\n"
        + "\n".join(f"  {m} {p}" for m, p in sorted(missing))
    )

    stale = documented - actual
    assert not stale, (
        "Registry entries that match no current authenticated route "
        "(renamed/removed/typo?). Fix the path or drop the entry:\n"
        + "\n".join(f"  {m} {p}" for m, p in sorted(stale))
    )

    overlap = set(CROSS_USER_TESTED) & set(SELF_SCOPED)
    assert not overlap, f"Routes listed in both registries: {sorted(overlap)}"


# --------------------------------------------------------------------------- #
# Cross-user assertions for the routes not already covered by the per-route
# suites. user A owns the resources (authenticated_client); user B
# (authenticated_client2) must be refused.
# --------------------------------------------------------------------------- #


@pytest_asyncio.fixture
async def a_file(authenticated_client):
    """A file owned by user A."""
    resp = await authenticated_client.post(
        "/files", json={"title": "A doc", "abstract": "a", "source": "hello"}
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    return body["id"] if "id" in body else body["file"]["id"]


@pytest_asyncio.fixture
async def a_annotation(authenticated_client, a_file):
    """An annotation on user A's file, owned by user A."""
    resp = await authenticated_client.post(
        "/annotations/",
        json={"file_id": a_file, "anchor_data": {}, "selected_text": "x"},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


@pytest_asyncio.fixture
async def a_message(authenticated_client, a_annotation):
    """A message on user A's annotation, owned by user A."""
    resp = await authenticated_client.post(
        f"/annotations/{a_annotation}/messages", json={"content": "hi"}
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


# file_id is the only user-A-owned id these routes gate on: require_view/edit/
# manage runs before any sub-resource (asset/version/permission) lookup, so a
# dummy sub-resource id of 1 is fine; the request must be refused on the file.
_FILE_SCOPED = [
    ("GET", "/files/{fid}/assets", None),
    ("GET", "/files/{fid}/assets/by-name/whatever.png", None),
    ("GET", "/files/{fid}/content", None),
    ("GET", "/files/{fid}/content/minimap", None),
    ("GET", "/files/{fid}/versions", None),
    ("GET", "/files/{fid}/versions/1/preview", None),
    ("POST", "/files/{fid}/duplicate", None),
    ("PUT", "/files/{fid}/assets/1", {"filename": "x.png"}),
    ("DELETE", "/files/{fid}", None),
    ("DELETE", "/files/{fid}/assets/1", None),
    ("DELETE", "/files/{fid}/permissions/1", None),
    ("DELETE", "/files/{fid}/versions/1", None),
]


@pytest.mark.parametrize("method,path_t,body", _FILE_SCOPED)
async def test_cross_user_file_scoped_denied(authenticated_client2, a_file, method, path_t, body):
    """User B (no access to A's file) is refused on every file-scoped route."""
    path = path_t.format(fid=a_file)
    resp = await authenticated_client2.request(method, path, json=body)
    assert resp.status_code in DENIED, (
        f"user B reached {method} {path}: {resp.status_code} {resp.text[:200]}"
    )


async def test_cross_user_reactions_denied(authenticated_client2, a_file):
    """User B cannot list, upsert, or delete reactions on A's file."""
    listed = await authenticated_client2.get(f"/reactions/?file_id={a_file}")
    assert listed.status_code in DENIED, f"GET /reactions/ leaked: {listed.status_code}"

    upsert = await authenticated_client2.put(
        "/reactions/",
        json={"file_id": a_file, "node_id": "n1", "reaction_type": "like"},
    )
    assert upsert.status_code in DENIED, f"PUT /reactions/ leaked: {upsert.status_code}"

    deleted = await authenticated_client2.delete(f"/reactions/?file_id={a_file}&node_id=n1")
    assert deleted.status_code in DENIED, f"DELETE /reactions/ leaked: {deleted.status_code}"


async def test_cross_user_annotations_denied(
    authenticated_client2, a_file, a_annotation, a_message
):
    """User B cannot create annotations/messages on A's file, or delete A's."""
    create = await authenticated_client2.post(
        "/annotations/",
        json={"file_id": a_file, "anchor_data": {}, "selected_text": "x"},
    )
    assert create.status_code in DENIED, f"POST /annotations/ leaked: {create.status_code}"

    msg = await authenticated_client2.post(
        f"/annotations/{a_annotation}/messages", json={"content": "x"}
    )
    assert msg.status_code in DENIED, f"POST message leaked: {msg.status_code}"

    del_ann = await authenticated_client2.delete(f"/annotations/{a_annotation}")
    assert del_ann.status_code in DENIED, f"DELETE annotation leaked: {del_ann.status_code}"

    del_msg = await authenticated_client2.delete(f"/annotations/messages/{a_message}")
    assert del_msg.status_code in DENIED, f"DELETE message leaked: {del_msg.status_code}"


@pytest.mark.parametrize(
    "method,path_t,body",
    [
        ("GET", "/users/{uid}/export", None),
        ("DELETE", "/users/{uid}/files/{fid}/tags/1", None),
    ],
)
async def test_cross_user_user_scoped_denied(
    authenticated_client2, authenticated_user, a_file, method, path_t, body
):
    """User B is refused on require_self routes targeting user A's id."""
    path = path_t.format(uid=authenticated_user["user_id"], fid=a_file)
    resp = await authenticated_client2.request(method, path, json=body)
    assert resp.status_code in DENIED, (
        f"user B reached {method} {path}: {resp.status_code} {resp.text[:200]}"
    )
