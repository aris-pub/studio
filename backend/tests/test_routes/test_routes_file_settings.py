# backend/tests/test_routes/test_file_settings.py
from datetime import datetime
from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.fixture
async def test_file(client: AsyncClient, authenticated_user):
    """Create a test file and return its data."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document for settings",
            "owner_id": authenticated_user["user_id"],
            "source": "test content",
        },
    )
    return response.json()


@pytest.fixture
def sample_settings():
    """Return sample settings data."""
    return {
        "background": "var(--surface-dark)",
        "font_size": "18px",
        "line_height": "1.6",
        "font_family": "Georgia",
        "margin_width": "20px",
        "columns": 2,
    }


class TestDefaultSettings:
    """Test default settings endpoints."""

    async def test_upsert_default_settings_without_auth(self, client: AsyncClient, sample_settings):
        """Test that default settings endpoint requires authentication."""
        response = await client.post("/settings/defaults", json=sample_settings)
        assert response.status_code == 401

    async def test_get_default_settings_without_auth(self, client: AsyncClient):
        """Test that get default settings endpoint requires authentication."""
        response = await client.get("/settings/defaults")
        assert response.status_code == 401

    async def test_create_default_settings(
        self, client: AsyncClient, auth_headers, sample_settings, authenticated_user
    ):
        """Test creating new default settings."""
        response = await client.post(
            "/settings/defaults", headers=auth_headers, json=sample_settings
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all fields are present and correct
        assert data["user_id"] == authenticated_user["user_id"]
        assert data["background"] == sample_settings["background"]
        assert data["font_size"] == sample_settings["font_size"]
        assert data["line_height"] == sample_settings["line_height"]
        assert data["font_family"] == sample_settings["font_family"]
        assert data["margin_width"] == sample_settings["margin_width"]
        assert data["columns"] == sample_settings["columns"]
        assert "created_at" in data
        assert "updated_at" in data

    async def test_update_default_settings(
        self, client: AsyncClient, auth_headers, sample_settings, authenticated_user
    ):
        """Test updating existing default settings."""
        # Create initial settings
        await client.post("/settings/defaults", headers=auth_headers, json=sample_settings)

        # Update settings
        updated_settings = sample_settings.copy()
        updated_settings["font_size"] = "20px"
        updated_settings["columns"] = 3

        response = await client.post(
            "/settings/defaults", headers=auth_headers, json=updated_settings
        )

        assert response.status_code == 200
        data = response.json()

        assert data["user_id"] == authenticated_user["user_id"]
        assert data["font_size"] == "20px"
        assert data["columns"] == 3
        assert data["background"] == sample_settings["background"]  # Unchanged field

    async def test_get_default_settings_none_exist(
        self, client: AsyncClient, auth_headers, authenticated_user
    ):
        """Test getting default settings when none exist."""
        with patch("aris.routes.file_settings.datetime") as mock_datetime:
            mock_now = datetime(2024, 1, 1, 12, 0, 0)
            mock_datetime.now.return_value = mock_now

            response = await client.get("/settings/defaults", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()

            # Should return default values
            assert data["user_id"] == authenticated_user["user_id"]
            assert data["background"] == "var(--surface-page)"
            assert data["font_size"] == "16px"
            assert data["line_height"] == "1.5"
            assert data["font_family"] == "Source Sans 3"
            assert data["margin_width"] == "16px"
            assert data["columns"] == 1

    async def test_get_default_settings_exist(
        self, client: AsyncClient, auth_headers, sample_settings, authenticated_user
    ):
        """Test getting default settings when they exist."""
        # Create settings first
        await client.post("/settings/defaults", headers=auth_headers, json=sample_settings)

        # Get settings
        response = await client.get("/settings/defaults", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert data["user_id"] == authenticated_user["user_id"]
        assert data["background"] == sample_settings["background"]
        assert data["font_size"] == sample_settings["font_size"]
        assert data["columns"] == sample_settings["columns"]

    async def test_upsert_default_settings_partial_data(
        self, client: AsyncClient, auth_headers, authenticated_user
    ):
        """Test upserting default settings with partial data."""
        partial_settings = {"font_size": "22px", "columns": 2}

        response = await client.post(
            "/settings/defaults", headers=auth_headers, json=partial_settings
        )

        assert response.status_code == 200
        data = response.json()

        # Should use provided values and defaults for missing fields
        assert data["font_size"] == "22px"
        assert data["columns"] == 2
        assert data["background"] == "var(--surface-page)"  # Default value
        assert data["font_family"] == "Source Sans 3"  # Default value


class TestFileSettings:
    """Test file-specific settings endpoints."""

    async def test_get_file_settings_without_auth(self, client: AsyncClient):
        """Test that file settings endpoint requires authentication."""
        response = await client.get("/settings/1")
        assert response.status_code == 401

    async def test_upsert_file_settings_without_auth(self, client: AsyncClient, sample_settings):
        """Test that upsert file settings endpoint requires authentication."""
        response = await client.post("/settings/1", json=sample_settings)
        assert response.status_code == 401

    async def test_get_file_settings_none_exist(
        self, client: AsyncClient, auth_headers, test_file, authenticated_user
    ):
        """Test getting file settings when none exist."""
        file_id = test_file["id"]

        with patch("aris.routes.file_settings.datetime") as mock_datetime:
            mock_now = datetime(2024, 1, 1, 12, 0, 0)
            mock_datetime.now.return_value = mock_now

            response = await client.get(f"/settings/{file_id}", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()

            # Should return default values with file_id
            assert data["file_id"] == file_id
            assert data["user_id"] == authenticated_user["user_id"]
            assert data["background"] == "var(--surface-page)"
            assert data["font_size"] == "16px"
            assert data["columns"] == 1

    async def test_upsert_file_settings_file_not_found(
        self, client: AsyncClient, auth_headers, sample_settings
    ):
        """Test upserting settings for non-existent file."""
        non_existent_file_id = 99999

        response = await client.post(
            f"/settings/{non_existent_file_id}", headers=auth_headers, json=sample_settings
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "File not found or access denied"

    async def test_upsert_file_settings_access_denied(self, client: AsyncClient, sample_settings):
        """Test upserting settings for file owned by another user."""
        # Create another user
        response = await client.post(
            "/register",
            json={
                "email": "otheruser@example.com",
                "name": "Other User",
                "initials": "OU",
                "password": "testpass123",
            },
        )
        other_user_token = response.json()["access_token"]
        other_user_id = response.json()["user"]["id"]
        other_headers = {"Authorization": f"Bearer {other_user_token}"}

        # Create file with other user
        file_response = await client.post(
            "/files",
            headers=other_headers,
            json={
                "title": "Other User's Document",
                "abstract": "A document owned by another user",
                "owner_id": other_user_id,
                "source": "other content",
            },
        )
        file_id = file_response.json()["id"]

        # Try to create settings with first user
        first_user_response = await client.post(
            "/register",
            json={
                "email": "firstuser@example.com",
                "name": "First User",
                "initials": "FU",
                "password": "testpass123",
            },
        )
        first_user_token = first_user_response.json()["access_token"]
        first_headers = {"Authorization": f"Bearer {first_user_token}"}

        response = await client.post(
            f"/settings/{file_id}", headers=first_headers, json=sample_settings
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "File not found or access denied"


class TestSettingsIntegration:
    """Integration tests for settings functionality."""

    async def test_settings_isolation_between_users(self, client: AsyncClient, sample_settings):
        """Test that settings are isolated between different users."""
        # Create first user and settings
        user1_response = await client.post(
            "/register",
            json={
                "email": "user1@example.com",
                "name": "User One",
                "initials": "U1",
                "password": "testpass123",
            },
        )
        user1_headers = {"Authorization": f"Bearer {user1_response.json()['access_token']}"}

        await client.post("/settings/defaults", headers=user1_headers, json=sample_settings)

        # Create second user and different settings
        user2_response = await client.post(
            "/register",
            json={
                "email": "user2@example.com",
                "name": "User Two",
                "initials": "U2",
                "password": "testpass123",
            },
        )
        user2_headers = {"Authorization": f"Bearer {user2_response.json()['access_token']}"}

        different_settings = {
            "background": "var(--surface-light)",
            "font_size": "14px",
            "columns": 3,
        }
        await client.post("/settings/defaults", headers=user2_headers, json=different_settings)

        # Verify each user gets their own settings
        user1_settings = await client.get("/settings/defaults", headers=user1_headers)
        user2_settings = await client.get("/settings/defaults", headers=user2_headers)

        assert user1_settings.json()["font_size"] == sample_settings["font_size"]
        assert user2_settings.json()["font_size"] == different_settings["font_size"]
        assert user1_settings.json()["columns"] == sample_settings["columns"]
        assert user2_settings.json()["columns"] == different_settings["columns"]

    async def test_settings_persistence(self, client: AsyncClient, auth_headers, sample_settings):
        """Test that settings persist across requests."""
        # Create settings
        create_response = await client.post(
            "/settings/defaults", headers=auth_headers, json=sample_settings
        )
        created_settings = create_response.json()

        # Get settings multiple times
        for _ in range(3):
            get_response = await client.get("/settings/defaults", headers=auth_headers)
            retrieved_settings = get_response.json()

            # Settings should be identical
            assert retrieved_settings["background"] == created_settings["background"]
            assert retrieved_settings["font_size"] == created_settings["font_size"]
            assert retrieved_settings["columns"] == created_settings["columns"]
            assert retrieved_settings["created_at"] == created_settings["created_at"]
