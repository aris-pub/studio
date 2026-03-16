"""Tests for user settings CRUD — camelCase alias support."""

from datetime import UTC, datetime

from aris.crud.user_settings import UserSettingsBase, UserSettingsResponse


class TestUserSettingsBase:
    def test_accepts_snake_case_fields(self):
        settings = UserSettingsBase(auto_save_interval=60, focus_mode_auto_hide=False)
        assert settings.auto_save_interval == 60
        assert settings.focus_mode_auto_hide is False

    def test_accepts_camel_case_fields(self):
        settings = UserSettingsBase(autoSaveInterval=60, focusModeAutoHide=False)
        assert settings.auto_save_interval == 60
        assert settings.focus_mode_auto_hide is False

    def test_model_dump_returns_snake_case(self):
        """model_dump() should return snake_case for DB column mapping."""
        settings = UserSettingsBase(autoSaveInterval=60)
        dumped = settings.model_dump()
        assert "auto_save_interval" in dumped
        assert "autoSaveInterval" not in dumped
        assert dumped["auto_save_interval"] == 60

    def test_model_dump_by_alias_returns_camel_case(self):
        settings = UserSettingsBase(auto_save_interval=60)
        dumped = settings.model_dump(by_alias=True)
        assert "autoSaveInterval" in dumped
        assert "auto_save_interval" not in dumped

    def test_accepts_full_camel_case_payload(self):
        """Simulates the exact payload the frontend sends."""
        payload = {
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
        settings = UserSettingsBase(**payload)
        assert settings.auto_save_interval == 10
        assert settings.auto_compile_delay == 500
        assert settings.notification_preference == "email"
        assert settings.mobile_menu_behavior == "compact"


class TestUserSettingsResponse:
    def test_serializes_to_camel_case(self):
        response = UserSettingsResponse(
            user_id=1,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
            updated_at=datetime(2026, 1, 1, tzinfo=UTC),
            auto_save_interval=60,
        )
        dumped = response.model_dump(by_alias=True)
        assert "autoSaveInterval" in dumped
        assert "userId" in dumped
        assert dumped["autoSaveInterval"] == 60

    def test_model_dump_snake_case_for_db(self):
        response = UserSettingsResponse(
            user_id=1,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
            updated_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        dumped = response.model_dump()
        assert "auto_save_interval" in dumped
        assert "user_id" in dumped
