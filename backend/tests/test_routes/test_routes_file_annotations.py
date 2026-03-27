"""Test annotation routes — CRUD, privacy filters, ownership rules, shared constraints."""

from httpx import AsyncClient


ANCHOR_DATA = {
    "node_id": "para-1",
    "element_id": "el-1",
    "start_offset": 0,
    "end_offset": 10,
}


async def _create_file(client: AsyncClient, headers: dict, user_id: int) -> int:
    resp = await client.post(
        "/files",
        headers=headers,
        json={"title": "Test", "owner_id": user_id, "source": "content"},
    )
    assert resp.status_code == 200
    return resp.json()["id"]


async def _share_file(
    client: AsyncClient, headers: dict, file_id: int, user_id: int, role: str = "COMMENTER"
) -> None:
    resp = await client.post(
        f"/files/{file_id}/permissions",
        headers=headers,
        json={"user_id": user_id, "role": role},
    )
    assert resp.status_code in (200, 201)


async def _create_annotation(
    client: AsyncClient,
    headers: dict,
    file_id: int,
    *,
    color: str = "purple",
    visibility: str = "private",
    selected_text: str = "hello",
) -> dict:
    resp = await client.post(
        "/annotations/",
        headers=headers,
        json={
            "file_id": file_id,
            "color": color,
            "anchor_data": ANCHOR_DATA,
            "selected_text": selected_text,
            "visibility": visibility,
        },
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


async def test_create_annotation_without_auth(client: AsyncClient):
    response = await client.post("/annotations/", json={})
    assert response.status_code == 401


async def test_list_annotations_without_auth(client: AsyncClient):
    response = await client.get("/annotations/")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def test_create_annotation(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    assert ann["file_id"] == file_id
    assert ann["color"] == "purple"
    assert ann["visibility"] == "private"
    assert ann["selected_text"] == "hello"
    assert ann["owner_id"] == authenticated_user["user_id"]
    assert ann["messages"] == []


async def test_create_shared_annotation(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id, visibility="shared")
    assert ann["visibility"] == "shared"


# ---------------------------------------------------------------------------
# List (privacy filter)
# ---------------------------------------------------------------------------


async def test_list_annotations_returns_own_private(
    client: AsyncClient, authenticated_user
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    await _create_annotation(client, headers, file_id)

    resp = await client.get("/annotations/", headers=headers, params={"file_id": file_id})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_list_annotations_hides_other_users_private(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    """User2 cannot see user1's private annotations."""
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    await _create_annotation(client, h1, file_id)

    resp = await client.get("/annotations/", headers=h2, params={"file_id": file_id})
    assert resp.status_code == 200
    assert len(resp.json()) == 0


async def test_list_annotations_shows_shared_to_others(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    """User2 can see user1's shared annotations."""
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    await _create_annotation(client, h1, file_id, visibility="shared")

    resp = await client.get("/annotations/", headers=h2, params={"file_id": file_id})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_list_annotations_empty(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])

    resp = await client.get("/annotations/", headers=headers, params={"file_id": file_id})
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# Get single
# ---------------------------------------------------------------------------


async def test_get_annotation(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    resp = await client.get(f"/annotations/{ann['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == ann["id"]


async def test_get_annotation_not_found(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.get("/annotations/99999", headers=headers)
    assert resp.status_code == 404


async def test_get_other_users_private_annotation_returns_404(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    """Privacy filter on single-get: other user's private annotation → 404."""
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    ann = await _create_annotation(client, h1, file_id)

    resp = await client.get(f"/annotations/{ann['id']}", headers=h2)
    assert resp.status_code == 404


async def test_get_shared_annotation_by_other_user(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    ann = await _create_annotation(client, h1, file_id, visibility="shared")

    resp = await client.get(f"/annotations/{ann['id']}", headers=h2)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


async def test_update_annotation_color(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    resp = await client.put(
        f"/annotations/{ann['id']}", headers=headers, json={"color": "blue"}
    )
    assert resp.status_code == 200
    assert resp.json()["color"] == "blue"


async def test_update_annotation_not_owner(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    """Only the owner can update their annotation."""
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    ann = await _create_annotation(client, h1, file_id, visibility="shared")

    resp = await client.put(
        f"/annotations/{ann['id']}", headers=h2, json={"color": "red"}
    )
    assert resp.status_code == 403


async def test_shared_annotation_cannot_be_made_private(
    client: AsyncClient, authenticated_user
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id, visibility="shared")

    resp = await client.put(
        f"/annotations/{ann['id']}",
        headers=headers,
        json={"visibility": "private"},
    )
    assert resp.status_code == 400
    assert "cannot be made private" in resp.json()["detail"]


async def test_private_annotation_can_be_made_shared(
    client: AsyncClient, authenticated_user
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    resp = await client.put(
        f"/annotations/{ann['id']}",
        headers=headers,
        json={"visibility": "shared"},
    )
    assert resp.status_code == 200
    assert resp.json()["visibility"] == "shared"


async def test_update_nonexistent_annotation(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.put(
        "/annotations/99999", headers=headers, json={"color": "red"}
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


async def test_delete_own_annotation(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    resp = await client.delete(f"/annotations/{ann['id']}", headers=headers)
    assert resp.status_code == 204

    # Verify soft-deleted: not in list
    list_resp = await client.get(
        "/annotations/", headers=headers, params={"file_id": file_id}
    )
    assert len(list_resp.json()) == 0


async def test_delete_annotation_not_owner(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    ann = await _create_annotation(client, h1, file_id, visibility="shared")

    resp = await client.delete(f"/annotations/{ann['id']}", headers=h2)
    assert resp.status_code == 403


async def test_file_owner_can_delete_shared_annotation(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    """File owner (MANAGE permission) can delete any shared annotation."""
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    # User2 creates a shared annotation on user1's file
    ann = await _create_annotation(client, h2, file_id, visibility="shared")

    # User1 (file owner) deletes it
    resp = await client.delete(f"/annotations/{ann['id']}", headers=h1)
    assert resp.status_code == 204


async def test_shared_annotation_with_notes_only_file_owner_deletes(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    """Shared annotation with notes: annotation owner cannot delete, file owner can."""
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    ann = await _create_annotation(client, h2, file_id, visibility="shared")

    # Add a message/note
    msg_resp = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=h2,
        json={"content": "A note"},
    )
    assert msg_resp.status_code == 201

    # Annotation owner (user2) cannot delete because shared + has notes
    resp = await client.delete(f"/annotations/{ann['id']}", headers=h2)
    assert resp.status_code == 403
    assert "file owner" in resp.json()["detail"]

    # File owner (user1) can delete
    resp = await client.delete(f"/annotations/{ann['id']}", headers=h1)
    assert resp.status_code == 204


async def test_delete_nonexistent_annotation(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.delete("/annotations/99999", headers=headers)
    assert resp.status_code == 404


async def test_deleted_annotation_excluded_from_list(
    client: AsyncClient, authenticated_user
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    await client.delete(f"/annotations/{ann['id']}", headers=headers)

    resp = await client.get("/annotations/", headers=headers, params={"file_id": file_id})
    assert len(resp.json()) == 0

    # include_deleted=true shows it
    resp = await client.get(
        "/annotations/",
        headers=headers,
        params={"file_id": file_id, "include_deleted": True},
    )
    assert len(resp.json()) == 1


# ---------------------------------------------------------------------------
# Messages (notes) CRUD
# ---------------------------------------------------------------------------


async def test_create_message(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    resp = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "First note"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "First note"
    assert data["annotation_id"] == ann["id"]


async def test_private_annotation_single_note_limit(
    client: AsyncClient, authenticated_user
):
    """Private annotations allow only one note."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    resp1 = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Note 1"},
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Note 2"},
    )
    assert resp2.status_code == 400
    assert "already has a note" in resp2.json()["detail"]


async def test_private_annotation_note_limit_after_delete_and_recreate(
    client: AsyncClient, authenticated_user
):
    """After deleting a note, a new one can be created (soft-delete aware)."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    resp1 = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Original note"},
    )
    assert resp1.status_code == 201
    msg_id = resp1.json()["id"]

    delete_resp = await client.delete(
        f"/annotations/messages/{msg_id}", headers=headers
    )
    assert delete_resp.status_code == 204

    resp2 = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Replacement note"},
    )
    assert resp2.status_code == 201


async def test_shared_annotation_multiple_notes(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    """Shared annotations allow unlimited notes (thread)."""
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    ann = await _create_annotation(client, h1, file_id, visibility="shared")

    resp1 = await client.post(
        f"/annotations/{ann['id']}/messages", headers=h1, json={"content": "Msg 1"}
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/annotations/{ann['id']}/messages", headers=h2, json={"content": "Msg 2"}
    )
    assert resp2.status_code == 201


async def test_create_message_on_nonexistent_annotation(
    client: AsyncClient, authenticated_user
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.post(
        "/annotations/99999/messages",
        headers=headers,
        json={"content": "note"},
    )
    assert resp.status_code == 404


async def test_list_messages(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id, visibility="shared")

    await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Note A"},
    )
    await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Note B"},
    )

    resp = await client.get(f"/annotations/{ann['id']}/messages", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_get_single_message(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    msg = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "My note"},
    )
    msg_id = msg.json()["id"]

    resp = await client.get(f"/annotations/messages/{msg_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["content"] == "My note"


async def test_get_nonexistent_message(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.get("/annotations/messages/99999", headers=headers)
    assert resp.status_code == 404


async def test_update_own_message(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    msg = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Original"},
    )
    msg_id = msg.json()["id"]

    resp = await client.put(
        f"/annotations/messages/{msg_id}",
        headers=headers,
        json={"content": "Updated"},
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == "Updated"


async def test_update_other_users_message(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    ann = await _create_annotation(client, h1, file_id, visibility="shared")

    msg = await client.post(
        f"/annotations/{ann['id']}/messages", headers=h1, json={"content": "Mine"}
    )
    msg_id = msg.json()["id"]

    resp = await client.put(
        f"/annotations/messages/{msg_id}",
        headers=h2,
        json={"content": "Hijack"},
    )
    assert resp.status_code == 403


async def test_update_nonexistent_message(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.put(
        "/annotations/messages/99999",
        headers=headers,
        json={"content": "x"},
    )
    assert resp.status_code == 404


async def test_delete_own_message(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    msg = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Temp note"},
    )
    msg_id = msg.json()["id"]

    resp = await client.delete(f"/annotations/messages/{msg_id}", headers=headers)
    assert resp.status_code == 204

    # Message is soft-deleted — excluded from list
    list_resp = await client.get(f"/annotations/{ann['id']}/messages", headers=headers)
    assert len(list_resp.json()) == 0


async def test_delete_other_users_message(
    client: AsyncClient,
    authenticated_user,
    second_authenticated_user,
):
    h1 = {"Authorization": f"Bearer {authenticated_user['token']}"}
    h2 = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    file_id = await _create_file(client, h1, authenticated_user["user_id"])
    await _share_file(client, h1, file_id, second_authenticated_user["user_id"])
    ann = await _create_annotation(client, h1, file_id, visibility="shared")

    msg = await client.post(
        f"/annotations/{ann['id']}/messages", headers=h1, json={"content": "Mine"}
    )
    msg_id = msg.json()["id"]

    resp = await client.delete(f"/annotations/messages/{msg_id}", headers=h2)
    assert resp.status_code == 403


async def test_delete_nonexistent_message(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    resp = await client.delete("/annotations/messages/99999", headers=headers)
    assert resp.status_code == 404


async def test_update_message_sets_updated_at(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id)

    msg = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Original"},
    )
    msg_data = msg.json()
    assert msg_data["updated_at"] is None

    resp = await client.put(
        f"/annotations/messages/{msg_data['id']}",
        headers=headers,
        json={"content": "Edited"},
    )
    assert resp.status_code == 200
    assert resp.json()["updated_at"] is not None
    assert resp.json()["content"] == "Edited"


async def test_delete_message_blocked_on_shared_annotation(
    client: AsyncClient,
    authenticated_user,
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id, visibility="shared")

    msg = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Shared comment"},
    )
    msg_id = msg.json()["id"]

    resp = await client.delete(f"/annotations/messages/{msg_id}", headers=headers)
    assert resp.status_code == 403
    assert "shared" in resp.json()["detail"].lower()


async def test_delete_message_allowed_on_private_annotation(
    client: AsyncClient,
    authenticated_user,
):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_id = await _create_file(client, headers, authenticated_user["user_id"])
    ann = await _create_annotation(client, headers, file_id, visibility="private")

    msg = await client.post(
        f"/annotations/{ann['id']}/messages",
        headers=headers,
        json={"content": "Private note"},
    )
    msg_id = msg.json()["id"]

    resp = await client.delete(f"/annotations/messages/{msg_id}", headers=headers)
    assert resp.status_code == 204
