"""Tests for the per-file event endpoint and the asset-change publishes.

GET /files/{id}/events streams a file's events (from FileEventBroker) to an
authorized viewer. The streaming behaviour (subscribe -> ": connected" -> data
lines) is covered directly against sse_event_stream in
tests/test_services/test_file_events.py, because httpx's ASGI transport buffers
the whole response and cannot consume an endless SSE stream here. These tests
cover the require_view gate and that the asset routes publish an "asset-changed"
event.
"""

import asyncio

from aris.crud.file import create_file
from aris.services.file_events import get_event_broker


_ASSET = {"filename": "a.txt", "mime_type": "text/plain", "content": "hi"}


async def _make_file(authenticated_user, db_session) -> int:
    file = await create_file(
        source="# T", owner_id=authenticated_user["user_id"], db=db_session
    )
    return file.id


async def test_file_events_requires_authentication(client, test_file):
    async with client.stream("GET", f"/files/{test_file.id}/events") as response:
        assert response.status_code in (401, 403)


async def test_file_events_forbidden_without_view_permission(
    authenticated_client2, test_file
):
    # test_file is owned by test_user; test_user2 has no permission on it.
    async with authenticated_client2.stream(
        "GET", f"/files/{test_file.id}/events"
    ) as response:
        assert response.status_code == 403


async def test_creating_an_asset_publishes_asset_changed(
    authenticated_client, authenticated_user, db_session
):
    file_id = await _make_file(authenticated_user, db_session)
    async with get_event_broker().subscribe(file_id) as q:
        resp = await authenticated_client.post(f"/files/{file_id}/assets", json=_ASSET)
        assert resp.status_code in (200, 201)
        event = await asyncio.wait_for(q.get(), timeout=2)
        assert event["type"] == "asset-changed"


async def test_updating_an_asset_publishes_asset_changed(
    authenticated_client, authenticated_user, db_session
):
    file_id = await _make_file(authenticated_user, db_session)
    created = await authenticated_client.post(f"/files/{file_id}/assets", json=_ASSET)
    asset_id = created.json()["id"]
    # subscribe only around the update, so the create's own publish is not counted
    async with get_event_broker().subscribe(file_id) as q:
        resp = await authenticated_client.put(
            f"/files/{file_id}/assets/{asset_id}", json={"filename": "renamed.txt"}
        )
        assert resp.status_code == 200
        event = await asyncio.wait_for(q.get(), timeout=2)
        assert event["type"] == "asset-changed"


async def test_deleting_an_asset_publishes_asset_changed(
    authenticated_client, authenticated_user, db_session
):
    file_id = await _make_file(authenticated_user, db_session)
    created = await authenticated_client.post(f"/files/{file_id}/assets", json=_ASSET)
    asset_id = created.json()["id"]
    async with get_event_broker().subscribe(file_id) as q:
        resp = await authenticated_client.delete(
            f"/files/{file_id}/assets/{asset_id}"
        )
        assert resp.status_code == 200
        event = await asyncio.wait_for(q.get(), timeout=2)
        assert event["type"] == "asset-changed"
