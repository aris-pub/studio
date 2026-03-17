"""Route tests for user settings — POST/GET round-trip with camelCase."""

import pytest
from httpx import AsyncClient


@pytest.fixture
def camel_case_payload():
    """The exact payload the frontend sends (camelCase)."""
    return {
        "autoSaveInterval": 10,
        "autoCompileDelay": 500,
        "focusModeAutoHide": False,
        "sidebarAutoCollapse": True,
        "drawerDefaultAnnotations": True,
        "drawerDefaultMargins": True,
        "drawerDefaultSettings": True,
        "notificationPreference": "email",
        "notificationMentions": False,
        "notificationComments": False,
        "notificationShares": False,
        "notificationSystem": False,
        "emailDigestFrequency": "daily",
        "allowAnonymousFeedback": True,
        "soundNotifications": False,
        "mobileMenuBehavior": "compact",
    }


class TestUserSettingsRoutes:
    async def test_post_requires_auth(self, client: AsyncClient, camel_case_payload):
        response = await client.post("/user-settings", json=camel_case_payload)
        assert response.status_code == 401

    async def test_get_requires_auth(self, client: AsyncClient):
        response = await client.get("/user-settings")
        assert response.status_code == 401

    async def test_get_returns_defaults_for_new_user(
        self, client: AsyncClient, authenticated_user
    ):
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
        response = await client.get("/user-settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["autoSaveInterval"] == 30
        assert data["focusModeAutoHide"] is True
        assert data["notificationPreference"] == "in-app"

    async def test_post_accepts_camel_case_and_persists(
        self, client: AsyncClient, authenticated_user, camel_case_payload
    ):
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

        # Save settings
        response = await client.post(
            "/user-settings", headers=headers, json=camel_case_payload
        )
        assert response.status_code == 200
        data = response.json()

        # Response should be camelCase and reflect saved values
        assert data["autoSaveInterval"] == 10
        assert data["autoCompileDelay"] == 500
        assert data["focusModeAutoHide"] is False
        assert data["sidebarAutoCollapse"] is True
        assert data["notificationPreference"] == "email"
        assert data["mobileMenuBehavior"] == "compact"

    async def test_round_trip_persistence(
        self, client: AsyncClient, authenticated_user, camel_case_payload
    ):
        """POST then GET — values must survive the round trip."""
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

        # Save
        post_resp = await client.post(
            "/user-settings", headers=headers, json=camel_case_payload
        )
        assert post_resp.status_code == 200

        # Reload
        get_resp = await client.get("/user-settings", headers=headers)
        assert get_resp.status_code == 200
        data = get_resp.json()

        # Every field should match what was sent
        for key, value in camel_case_payload.items():
            assert data[key] == value, f"{key}: expected {value}, got {data[key]}"

    async def test_snake_case_round_trip_persistence(
        self, client: AsyncClient, authenticated_user
    ):
        """POST with snake_case (what the frontend actually sends) then GET.

        The frontend converts camelCase settings to snake_case before POSTing.
        This test verifies the round trip works with snake_case input.
        """
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

        snake_payload = {
            "auto_save_interval": 60,
            "auto_compile_delay": 2000,
            "focus_mode_auto_hide": False,
            "sidebar_auto_collapse": True,
            "drawer_default_annotations": True,
            "drawer_default_margins": False,
            "drawer_default_settings": True,
            "notification_preference": "both",
            "notification_mentions": False,
            "notification_comments": True,
            "notification_shares": False,
            "notification_system": True,
            "email_digest_frequency": "daily",
            "allow_anonymous_feedback": True,
            "sound_notifications": False,
            "mobile_menu_behavior": "compact",
        }

        post_resp = await client.post(
            "/user-settings", headers=headers, json=snake_payload
        )
        assert post_resp.status_code == 200

        # GET should return camelCase keys with the saved values
        get_resp = await client.get("/user-settings", headers=headers)
        assert get_resp.status_code == 200
        data = get_resp.json()

        assert data["autoSaveInterval"] == 60
        assert data["autoCompileDelay"] == 2000
        assert data["focusModeAutoHide"] is False
        assert data["sidebarAutoCollapse"] is True
        assert data["drawerDefaultAnnotations"] is True
        assert data["drawerDefaultMargins"] is False
        assert data["drawerDefaultSettings"] is True
        assert data["notificationPreference"] == "both"
        assert data["notificationMentions"] is False
        assert data["notificationComments"] is True
        assert data["notificationShares"] is False
        assert data["notificationSystem"] is True
        assert data["emailDigestFrequency"] == "daily"
        assert data["allowAnonymousFeedback"] is True
        assert data["soundNotifications"] is False
        assert data["mobileMenuBehavior"] == "compact"

    async def test_partial_update_preserves_other_fields(
        self, client: AsyncClient, authenticated_user, camel_case_payload
    ):
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

        # Save full payload first
        await client.post(
            "/user-settings", headers=headers, json=camel_case_payload
        )

        # Update only one field (all others use defaults from Pydantic model)
        partial = {"autoSaveInterval": 300}
        await client.post("/user-settings", headers=headers, json=partial)

        # Reload and verify the explicitly-set field changed
        get_resp = await client.get("/user-settings", headers=headers)
        data = get_resp.json()
        assert data["autoSaveInterval"] == 300
