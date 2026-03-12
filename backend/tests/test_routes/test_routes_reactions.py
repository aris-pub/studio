"""Test reaction routes."""

from httpx import AsyncClient


async def test_get_reactions_without_auth(client: AsyncClient):
    response = await client.get("/reactions/", params={"file_id": 1})
    assert response.status_code == 401


async def test_get_reactions_empty(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    # Create a file first
    file_resp = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test",
            "owner_id": authenticated_user["user_id"],
            "source": "content",
        },
    )
    file_id = file_resp.json()["id"]

    response = await client.get("/reactions/", headers=headers, params={"file_id": file_id})
    assert response.status_code == 200
    assert response.json() == []


async def test_upsert_reaction_creates(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_resp = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test",
            "owner_id": authenticated_user["user_id"],
            "source": "content",
        },
    )
    file_id = file_resp.json()["id"]

    response = await client.put(
        "/reactions/",
        headers=headers,
        json={"file_id": file_id, "node_id": "para-1", "reaction_type": "bookmark"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["node_id"] == "para-1"
    assert data["reaction_type"] == "bookmark"
    assert data["file_id"] == file_id


async def test_upsert_reaction_updates(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_resp = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test",
            "owner_id": authenticated_user["user_id"],
            "source": "content",
        },
    )
    file_id = file_resp.json()["id"]

    await client.put(
        "/reactions/",
        headers=headers,
        json={"file_id": file_id, "node_id": "para-1", "reaction_type": "bookmark"},
    )
    response = await client.put(
        "/reactions/",
        headers=headers,
        json={"file_id": file_id, "node_id": "para-1", "reaction_type": "star"},
    )
    assert response.status_code == 200
    assert response.json()["reaction_type"] == "star"

    # Should still be only one reaction for this node
    list_resp = await client.get("/reactions/", headers=headers, params={"file_id": file_id})
    assert len(list_resp.json()) == 1


async def test_delete_reaction(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_resp = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test",
            "owner_id": authenticated_user["user_id"],
            "source": "content",
        },
    )
    file_id = file_resp.json()["id"]

    await client.put(
        "/reactions/",
        headers=headers,
        json={"file_id": file_id, "node_id": "para-1", "reaction_type": "heart"},
    )

    response = await client.delete(
        "/reactions/",
        headers=headers,
        params={"file_id": file_id, "node_id": "para-1"},
    )
    assert response.status_code == 204

    list_resp = await client.get("/reactions/", headers=headers, params={"file_id": file_id})
    assert list_resp.json() == []


async def test_delete_nonexistent_reaction(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_resp = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test",
            "owner_id": authenticated_user["user_id"],
            "source": "content",
        },
    )
    file_id = file_resp.json()["id"]

    response = await client.delete(
        "/reactions/",
        headers=headers,
        params={"file_id": file_id, "node_id": "nonexistent"},
    )
    assert response.status_code == 404


async def test_multiple_nodes_independent(client: AsyncClient, authenticated_user):
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    file_resp = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test",
            "owner_id": authenticated_user["user_id"],
            "source": "content",
        },
    )
    file_id = file_resp.json()["id"]

    await client.put(
        "/reactions/",
        headers=headers,
        json={"file_id": file_id, "node_id": "para-1", "reaction_type": "bookmark"},
    )
    await client.put(
        "/reactions/",
        headers=headers,
        json={"file_id": file_id, "node_id": "para-2", "reaction_type": "star"},
    )

    list_resp = await client.get("/reactions/", headers=headers, params={"file_id": file_id})
    data = list_resp.json()
    assert len(data) == 2
    types = {r["node_id"]: r["reaction_type"] for r in data}
    assert types["para-1"] == "bookmark"
    assert types["para-2"] == "star"
