"""Tests for signup model functionality."""

import json

from aris.models import Signup, SignupStatus


class TestSignupModel:
    """Test Signup model behavior."""

    def test_signup_model_creation(self):
        """Test basic signup model creation."""
        authoring_tools_json = json.dumps(["LaTeX", "Markdown"])
        
        signup = Signup(
            email="test@example.com",
            authoring_tools=authoring_tools_json,
            improvements="Better collaboration features",
            status=SignupStatus.ACTIVE,
            source="website",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            consent_given=True,
        )

        assert signup.email == "test@example.com"
        assert signup.authoring_tools == authoring_tools_json
        assert signup.improvements == "Better collaboration features"
        assert signup.status == SignupStatus.ACTIVE
        assert signup.source == "website"
        assert signup.ip_address == "192.168.1.1"
        assert signup.user_agent == "Mozilla/5.0"
        assert signup.consent_given is True

    def test_signup_model_defaults(self):
        """Test signup model default values."""
        signup = Signup(
            email="defaults@example.com",
            unsubscribe_token="test-token-123"
        )

        # Check that defaults are set correctly
        # Note: SQLAlchemy defaults are only applied when persisted to DB
        assert signup.status is None  # Default only applied on DB insert
        assert signup.consent_given is None  # Default only applied on DB insert
        assert signup.authoring_tools is None
        assert signup.improvements is None
        assert signup.source is None
        assert signup.ip_address is None
        assert signup.user_agent is None

    def test_signup_model_optional_fields(self):
        """Test signup model with optional fields set to None."""
        signup = Signup(
            email="optional@example.com",
            authoring_tools=None,
            improvements=None,
            source=None,
            ip_address=None,
            user_agent=None,
        )

        assert signup.email == "optional@example.com"
        assert signup.authoring_tools is None
        assert signup.improvements is None
        assert signup.source is None
        assert signup.ip_address is None
        assert signup.user_agent is None


class TestAuthoringToolsField:
    """Test authoring_tools JSON field functionality."""

    def test_authoring_tools_json_storage(self):
        """Test that authoring tools are stored as JSON."""
        tools = ["LaTeX", "Markdown", "Typst"]
        tools_json = json.dumps(tools)
        
        signup = Signup(
            email="tools@example.com",
            authoring_tools=tools_json
        )
        
        assert signup.authoring_tools == tools_json
        # Verify we can parse it back
        parsed_tools = json.loads(signup.authoring_tools)
        assert parsed_tools == tools

    def test_authoring_tools_with_other_tool(self):
        """Test authoring tools including 'other' option."""
        tools = ["LaTeX", "Custom Tool"]
        tools_json = json.dumps(tools)
        
        signup = Signup(
            email="custom@example.com",
            authoring_tools=tools_json
        )
        
        parsed_tools = json.loads(signup.authoring_tools)
        assert "Custom Tool" in parsed_tools
        assert len(parsed_tools) == 2

    def test_empty_authoring_tools(self):
        """Test empty authoring tools list."""
        tools_json = json.dumps([])
        
        signup = Signup(
            email="empty@example.com",
            authoring_tools=tools_json
        )
        
        parsed_tools = json.loads(signup.authoring_tools)
        assert parsed_tools == []
        assert len(parsed_tools) == 0


class TestSignupStatusEnum:
    """Test SignupStatus enum."""

    def test_signup_status_values(self):
        """Test that all signup status values are correct."""
        assert SignupStatus.ACTIVE.value == "active"
        assert SignupStatus.UNSUBSCRIBED.value == "unsubscribed"
        assert SignupStatus.CONVERTED.value == "converted"

    def test_signup_status_enum_members(self):
        """Test that all expected enum members exist."""
        expected_members = ["ACTIVE", "UNSUBSCRIBED", "CONVERTED"]
        actual_members = [member.name for member in SignupStatus]

        assert set(actual_members) == set(expected_members)
        assert len(actual_members) == len(expected_members)

    def test_signup_status_string_conversion(self):
        """Test string representation of signup statuses."""
        assert str(SignupStatus.ACTIVE) == "SignupStatus.ACTIVE"
        assert SignupStatus.ACTIVE.value == "active"


class TestSignupModelValidation:
    """Test signup model field validation and constraints."""

    def test_signup_with_different_tool_combinations(self):
        """Test signup creation with different authoring tool combinations."""
        tool_combinations = [
            ["LaTeX"],
            ["Markdown", "Typst"],
            ["MS Word", "Google Docs", "Quarto"],
            ["LaTeX", "Markdown", "Typst", "Custom Tool"],
        ]
        
        for i, tools in enumerate(tool_combinations):
            tools_json = json.dumps(tools)
            signup = Signup(
                email=f"combo{i}@example.com",
                authoring_tools=tools_json,
            )
            parsed_tools = json.loads(signup.authoring_tools)
            assert parsed_tools == tools

    def test_signup_with_all_statuses(self):
        """Test signup creation with each status."""
        for status in SignupStatus:
            signup = Signup(
                email=f"{status.value}@example.com",
                status=status,
            )
            assert signup.status == status

    def test_signup_boolean_fields(self):
        """Test boolean field behavior."""
        # Test True
        signup_true = Signup(
            email="true@example.com", consent_given=True
        )
        assert signup_true.consent_given is True

        # Test False
        signup_false = Signup(
            email="false@example.com", consent_given=False
        )
        assert signup_false.consent_given is False

    def test_signup_string_fields_with_special_chars(self):
        """Test string fields with special characters."""
        tools_with_special = ["LaTeX (Overleaf)", "R&D Tools", "Custom/Special"]
        tools_json = json.dumps(tools_with_special)
        
        signup = Signup(
            email="special@münchen.de",
            authoring_tools=tools_json,
            improvements="Better collaboration & real-time editing features!",
            source="website/referral",
            user_agent="Mozilla/5.0 (compatible; special-chars)",
        )

        assert "ü" in signup.email
        parsed_tools = json.loads(signup.authoring_tools)
        assert "LaTeX (Overleaf)" in parsed_tools
        assert "&" in signup.improvements
        assert "/" in signup.source
        assert ";" in signup.user_agent

    def test_signup_long_string_fields(self):
        """Test signup with very long string values."""
        long_tools = ["Tool" + str(i) for i in range(50)]  # Many tools
        long_tools_json = json.dumps(long_tools)
        long_improvements = "I" * 1000  # Very long improvements text
        long_user_agent = "D" * 1000

        signup = Signup(
            email="long@example.com",
            authoring_tools=long_tools_json,
            improvements=long_improvements,
            user_agent=long_user_agent,
        )

        parsed_tools = json.loads(signup.authoring_tools)
        assert len(parsed_tools) == 50
        assert len(signup.improvements) == 1000
        assert len(signup.user_agent) == 1000

    def test_signup_empty_string_fields(self):
        """Test signup with empty string values."""
        signup = Signup(
            email="empty@example.com",
            authoring_tools="",  # Empty authoring tools JSON
            improvements="",     # Empty improvements
            source="",
            ip_address="",
            user_agent="",
        )

        # Empty strings should be preserved as-is
        assert signup.authoring_tools == ""
        assert signup.improvements == ""
        assert signup.source == ""
        assert signup.ip_address == ""
        assert signup.user_agent == ""
