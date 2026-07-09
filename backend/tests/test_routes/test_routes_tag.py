"""Tests for tag routes."""


import pytest
from httpx import AsyncClient


@pytest.fixture
async def sample_tag(client: AsyncClient, authenticated_user):
    """Create a sample tag for testing."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/users/{authenticated_user['user_id']}/tags",
        headers=headers,
        json={
            "name": "Test Tag",
            "color": "#FF0000",
        },
    )
    return {
        "tag": response.json(),
        "user_id": authenticated_user["user_id"],
        "token": authenticated_user["token"],
    }


@pytest.fixture
async def sample_file(client: AsyncClient, authenticated_user):
    """Create a sample file for testing tag assignments."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document",
            "owner_id": authenticated_user["user_id"],
            "source": "test content",
        },
    )
    return response.json()


# Tag CRUD Tests


async def test_create_tag_without_auth(client: AsyncClient):
    """Test that create tag endpoint requires authentication."""
    response = await client.post(
        "/users/1/tags",
        json={
            "name": "Test Tag",
            "color": "#FF0000",
        },
    )
    assert response.status_code == 401


async def test_create_tag_with_auth(client: AsyncClient, authenticated_user):
    """Test creating a tag with authentication."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/users/{authenticated_user['user_id']}/tags",
        headers=headers,
        json={
            "name": "Test Tag",
            "color": "#FF0000",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Tag"
    assert data["color"] == "#FF0000"
    assert data["user_id"] == authenticated_user["user_id"]
    assert "id" in data


async def test_create_tag_nonexistent_user(client: AsyncClient, authenticated_user):
    """Creating a tag under another user's id is forbidden before any user lookup.

    The require_self guard rejects the mismatched path user_id (IDOR), so a caller
    can no longer probe whether an arbitrary user exists via this endpoint.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        "/users/99999/tags",
        headers=headers,
        json={
            "name": "Test Tag",
            "color": "#FF0000",
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden"


async def test_create_tag_invalid_data(client: AsyncClient, authenticated_user):
    """Test creating a tag with invalid data."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/users/{authenticated_user['user_id']}/tags",
        headers=headers,
        json={
            "name": "",  # Empty name
            "color": "#FF0000",
        },
    )
    assert response.status_code == 422


async def test_get_user_tags_without_auth(client: AsyncClient):
    """Test that get user tags endpoint requires authentication."""
    response = await client.get("/users/1/tags")
    assert response.status_code == 401


async def test_get_user_tags_with_auth(client: AsyncClient, authenticated_user):
    """Test getting user tags with authentication."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.get(f"/users/{authenticated_user['user_id']}/tags", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_user_tags_with_existing_tag(client: AsyncClient, sample_tag):
    """Test getting user tags when tags exist."""
    headers = {"Authorization": f"Bearer {sample_tag['token']}"}
    response = await client.get(f"/users/{sample_tag['user_id']}/tags", headers=headers)
    assert response.status_code == 200
    tags = response.json()
    assert len(tags) >= 1
    tag_names = [tag["name"] for tag in tags]
    assert "Test Tag" in tag_names


async def test_update_tag_without_auth(client: AsyncClient):
    """Test that update tag endpoint requires authentication."""
    response = await client.put(
        "/users/1/tags/1",
        json={
            "id": 1,
            "user_id": 1,
            "name": "Updated Tag",
            "color": "#00FF00",
        },
    )
    assert response.status_code == 401


async def test_update_tag_with_auth(client: AsyncClient, sample_tag, authenticated_user):
    """Test updating a tag with authentication."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    tag_data = sample_tag["tag"]
    response = await client.put(
        f"/users/{authenticated_user['user_id']}/tags/{tag_data['id']}",
        headers=headers,
        json={
            "id": tag_data["id"],
            "user_id": authenticated_user["user_id"],
            "name": "Updated Tag",
            "color": "#00FF00",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Tag"
    assert data["color"] == "#00FF00"
    assert data["id"] == tag_data["id"]


async def test_update_nonexistent_tag(client: AsyncClient, authenticated_user):
    """Test updating a tag that doesn't exist."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.put(
        f"/users/{authenticated_user['user_id']}/tags/99999",
        headers=headers,
        json={
            "id": 99999,
            "user_id": authenticated_user["user_id"],
            "name": "Updated Tag",
            "color": "#00FF00",
        },
    )
    assert response.status_code == 404
    assert "Tag with id 99999 not found" == response.json()["detail"]


async def test_delete_tag_without_auth(client: AsyncClient):
    """Test that delete tag endpoint requires authentication."""
    response = await client.delete("/users/1/tags/1")
    assert response.status_code == 401


async def test_delete_tag_with_auth(client: AsyncClient, sample_tag, authenticated_user):
    """Test deleting a tag with authentication."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    tag_data = sample_tag["tag"]
    response = await client.delete(
        f"/users/{authenticated_user['user_id']}/tags/{tag_data['id']}",
        headers=headers,
    )
    assert response.status_code == 204


async def test_delete_nonexistent_tag(client: AsyncClient, authenticated_user):
    """Test deleting a tag that doesn't exist."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.delete(
        f"/users/{authenticated_user['user_id']}/tags/99999",
        headers=headers,
    )
    assert response.status_code == 404
    assert "Tag with id 99999 not found" == response.json()["detail"]


# File-Tag Association Tests


async def test_get_user_file_tags_without_auth(client: AsyncClient):
    """Test that get user file tags endpoint requires authentication."""
    response = await client.get("/users/1/files/1/tags")
    assert response.status_code == 401


async def test_get_user_file_tags_with_auth(client: AsyncClient, authenticated_user, sample_file):
    """Test getting user file tags with authentication."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.get(
        f"/users/{authenticated_user['user_id']}/files/{sample_file['id']}/tags",
        headers=headers,
    )
    assert response.status_code == 200


async def test_get_user_file_tags_invalid_file(client: AsyncClient, authenticated_user):
    """Test getting tags for a nonexistent file."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.get(
        f"/users/{authenticated_user['user_id']}/files/99999/tags",
        headers=headers,
    )
    assert response.status_code == 400
    assert "Error fetching tags for file" in response.json()["detail"]


async def test_add_tag_to_file_without_auth(client: AsyncClient):
    """Test that add tag to file endpoint requires authentication."""
    response = await client.post("/users/1/files/1/tags/1")
    assert response.status_code == 401


async def test_add_tag_to_file_with_auth(
    client: AsyncClient, authenticated_user, sample_file, sample_tag
):
    """Test adding a tag to a file with authentication."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    tag_data = sample_tag["tag"]
    response = await client.post(
        f"/users/{authenticated_user['user_id']}/files/{sample_file['id']}/tags/{tag_data['id']}",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Tag added successfully"


async def test_add_tag_to_file_invalid_data(client: AsyncClient, authenticated_user):
    """Test adding a tag to a file with invalid data."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        f"/users/{authenticated_user['user_id']}/files/99999/tags/99999",
        headers=headers,
    )
    assert response.status_code == 400
    assert "Error adding tag" in response.json()["detail"]


async def test_remove_tag_from_file_without_auth(client: AsyncClient):
    """Test that remove tag from file endpoint requires authentication."""
    response = await client.delete("/users/1/files/1/tags/1")
    assert response.status_code == 401


async def test_remove_tag_from_file_with_auth(
    client: AsyncClient, authenticated_user, sample_file, sample_tag
):
    """Test removing a tag from a file with authentication."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    tag_data = sample_tag["tag"]

    # First add the tag
    await client.post(
        f"/users/{authenticated_user['user_id']}/files/{sample_file['id']}/tags/{tag_data['id']}",
        headers=headers,
    )

    # Then remove it
    response = await client.delete(
        f"/users/{authenticated_user['user_id']}/files/{sample_file['id']}/tags/{tag_data['id']}",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Tag removed successfully"


async def test_remove_tag_from_file_invalid_data(client: AsyncClient, authenticated_user):
    """Test removing a tag from a file with invalid data."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.delete(
        f"/users/{authenticated_user['user_id']}/files/99999/tags/99999",
        headers=headers,
    )
    assert response.status_code == 400
    assert "Error removing tag" in response.json()["detail"]


async def test_create_tag_invalid_names(authenticated_user, client: AsyncClient):
    """
    Test creating tags with invalid names:
    - empty string
    - whitespace only
    - too long (>50 chars)
    Expect 422 or 400 validation errors.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    invalid_names = ["", "    ", "a" * 51]

    for name in invalid_names:
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/tags",
            headers=headers,
            json={"name": name},
        )
        assert response.status_code == 422 or response.status_code == 400
        assert "Tag name" in response.text or "value_error" in response.text


async def test_update_tag_not_owned(sample_tag, client: AsyncClient):
    """
    Test updating a tag with a body user_id different from the authenticated user's.
    Expect 403 Forbidden: the body-based ownership check rejects the mismatch (IDOR).
    """
    headers = {"Authorization": f"Bearer {sample_tag['token']}"}
    tag = sample_tag["tag"]

    fake_tag = tag.copy()
    fake_tag["user_id"] = 999999  # Simulate different user

    response = await client.put(
        f"/users/{fake_tag['user_id']}/tags/{fake_tag['id']}",
        headers=headers,
        json=fake_tag,
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized"



async def test_add_tag_to_file_invalid_tag(client: AsyncClient, authenticated_user, sample_file):
    """
    Test adding a tag to a file with an invalid tag ID.
    Expect 400 Bad Request with error message about adding tag.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    invalid_tag_id = 99999999

    response = await client.post(
        f"/users/{authenticated_user['user_id']}/files/{sample_file['id']}/tags/{invalid_tag_id}",
        headers=headers,
    )
    assert response.status_code == 400
    assert "Error adding tag" in response.json()["detail"]


async def test_get_user_tags_empty(client: AsyncClient, authenticated_user):
    """
    Test getting tags for a user who has no tags.
    Expect an empty list in response.
    """
    response = await client.post(
        "/register",
        json={
            "email": "emptytags@example.com",
            "name": "Empty Tags",
            "initials": "ET",
            "password": "password123",
        },
    )
    new_user_id = response.json()["user"]["id"]
    new_token = response.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    response = await client.get(f"/users/{new_user_id}/tags", headers=new_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


async def test_remove_tag_from_file_not_assigned(
    client: AsyncClient, authenticated_user, sample_file, sample_tag
):
    """
    Test removing a tag from a file that does not have the tag assigned.
    Expect 400 Bad Request with error message about removing tag.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    tag_id = sample_tag["tag"]["id"]

    response = await client.delete(
        f"/users/{authenticated_user['user_id']}/files/{sample_file['id']}/tags/{tag_id}",
        headers=headers,
    )
    assert response.status_code == 400
    assert "Error removing tag" in response.json()["detail"]


def test_tagcreate_validate_name():
    """
    Unit test for TagCreate Pydantic model validator on name field:
    - Valid name passes and is stripped
    - Empty or whitespace only names raise ValidationError
    - Too long names (>50 chars) raise ValidationError
    """
    from pydantic import ValidationError

    from aris.routes.tag import TagCreate

    valid_name = "Valid Tag"
    tag = TagCreate(name=valid_name)
    assert tag.name == valid_name.strip()

    with pytest.raises(ValidationError):
        TagCreate(name="")

    with pytest.raises(ValidationError):
        TagCreate(name="    ")

    too_long = "a" * 51
    with pytest.raises(ValidationError):
        TagCreate(name=too_long)


async def test_unauthorized_access(client: AsyncClient):
    """
    Test making a request without Authorization header.
    Expect 401 Unauthorized response.
    """
    response = await client.post(
        "/users/1/tags",
        json={"name": "Unauthorized"},
    )
    assert response.status_code == 401


async def test_create_tag_crud_error(monkeypatch, client: AsyncClient, authenticated_user):
    """
    Test handling of error when CRUD create_tag returns None.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    async def fake_create_tag(user_id, name, color, db):
        return None

    monkeypatch.setattr("aris.routes.tag.crud.create_tag", fake_create_tag)
    response = await client.post(
        f"/users/{authenticated_user['user_id']}/tags",
        headers=headers,
        json={"name": "New Tag", "color": "#ABCDEF"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Error creating tag"


async def test_update_tag_crud_error(
    monkeypatch, client: AsyncClient, authenticated_user, sample_tag
):
    """
    Test handling of error when CRUD update_tag raises ValueError.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    tag_data = sample_tag["tag"]

    async def fake_update_tag(_id, user_id, name, color, db):
        raise ValueError("update failed")

    monkeypatch.setattr("aris.routes.tag.crud.update_tag", fake_update_tag)
    response = await client.put(
        f"/users/{authenticated_user['user_id']}/tags/{tag_data['id']}",
        headers=headers,
        json={
            "id": tag_data["id"],
            "user_id": authenticated_user["user_id"],
            "name": "Updated Name",
            "color": "#123456",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Error updating tag: update failed"


async def test_delete_tag_crud_error(
    monkeypatch, client: AsyncClient, authenticated_user, sample_tag
):
    """
    Test handling of error when CRUD soft_delete_tag returns None.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    tag_data = sample_tag["tag"]

    async def fake_soft_delete(_id, user_id, db):
        return None

    monkeypatch.setattr("aris.routes.tag.crud.soft_delete_tag", fake_soft_delete)
    response = await client.delete(
        f"/users/{authenticated_user['user_id']}/tags/{tag_data['id']}",
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == f"Error deleting tag: {tag_data['id']}"


# Cross-user authorization tests (IDOR / broken object-level authorization)
#
# The router only enforces "logged in", not "acting on your own account". These
# tests assert that user2 cannot read or mutate user1's (test_user) tag resources.
# The require_self guard (and, for update, the body-based ownership check) rejects
# the request with 403 before any object lookup, so the target tag/file id need not
# exist: the 403 can only originate from the authorization guard, which is exactly
# what these tests verify.


async def test_create_tag_cross_user_forbidden(authenticated_client2, test_user):
    """user2 cannot create a tag under another user's id."""
    response = await authenticated_client2.post(
        f"/users/{test_user.id}/tags",
        json={"name": "Evil Tag", "color": "#000000"},
    )
    assert response.status_code == 403


async def test_get_user_tags_cross_user_forbidden(authenticated_client2, test_user):
    """user2 cannot list another user's tags."""
    response = await authenticated_client2.get(f"/users/{test_user.id}/tags")
    assert response.status_code == 403


async def test_update_tag_cross_user_forbidden(authenticated_client2, test_user):
    """user2 cannot update a tag by scoping the request body to another user's id."""
    response = await authenticated_client2.put(
        f"/users/{test_user.id}/tags/1",
        json={
            "id": 1,
            "user_id": test_user.id,
            "name": "Hijacked",
            "color": "#000000",
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized"


async def test_delete_tag_cross_user_forbidden(authenticated_client2, test_user):
    """user2 cannot delete a tag under another user's id."""
    response = await authenticated_client2.delete(f"/users/{test_user.id}/tags/1")
    assert response.status_code == 403


async def test_get_user_file_tags_cross_user_forbidden(
    authenticated_client2, test_user, test_file
):
    """user2 cannot read tags on another user's file."""
    response = await authenticated_client2.get(
        f"/users/{test_user.id}/files/{test_file.id}/tags"
    )
    assert response.status_code == 403


async def test_add_tag_to_file_cross_user_forbidden(
    authenticated_client2, test_user, test_file
):
    """user2 cannot assign a tag on another user's file."""
    response = await authenticated_client2.post(
        f"/users/{test_user.id}/files/{test_file.id}/tags/1"
    )
    assert response.status_code == 403


async def test_remove_tag_from_file_cross_user_forbidden(
    authenticated_client2, test_user, test_file
):
    """user2 cannot remove a tag from another user's file."""
    response = await authenticated_client2.delete(
        f"/users/{test_user.id}/files/{test_file.id}/tags/1"
    )
    assert response.status_code == 403
