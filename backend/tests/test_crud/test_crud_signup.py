"""Tests for signup CRUD operations."""

import json

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from aris.crud.signup import (
    DuplicateEmailError,
    create_signup,
    email_exists,
    get_active_signups_count,
    get_signup_by_email,
    get_signup_by_id,
    unsubscribe_signup,
    update_signup_status,
)
from aris.models import SignupStatus


class TestCreateSignup:
    """Test signup creation."""

    async def test_create_signup_success(self, db_session: AsyncSession):
        """Test successful signup creation."""
        authoring_tools = ["LaTeX", "Markdown"]
        signup = await create_signup(
            email="test@example.com",
            db=db_session,
            authoring_tools=authoring_tools,
            improvements="Better collaboration features",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            source="website",
        )
        
        assert signup.id is not None
        assert signup.email == "test@example.com"
        # Parse JSON to verify authoring_tools
        parsed_tools = json.loads(signup.authoring_tools)
        assert parsed_tools == authoring_tools
        assert signup.improvements == "Better collaboration features"
        assert signup.status == SignupStatus.ACTIVE
        assert signup.ip_address == "192.168.1.1"
        assert signup.user_agent == "Mozilla/5.0"
        assert signup.source == "website"
        assert signup.consent_given is True
        assert signup.created_at is not None
        assert signup.updated_at is not None

    async def test_create_signup_minimal_data(self, db_session: AsyncSession):
        """Test signup creation with minimal required data."""
        signup = await create_signup(
            email="minimal@example.com",
            db=db_session
        )
        
        assert signup.id is not None
        assert signup.email == "minimal@example.com"
        assert signup.authoring_tools is None
        assert signup.improvements is None
        assert signup.status == SignupStatus.ACTIVE
        assert signup.source == "website"  # Default value
        assert signup.consent_given is True

    async def test_create_signup_duplicate_email(self, db_session: AsyncSession):
        """Test that duplicate email raises DuplicateEmailError."""
        # Create first signup
        await create_signup(
            email="duplicate@example.com",
            db=db_session
        )
        
        # Try to create second signup with same email
        with pytest.raises(DuplicateEmailError) as exc_info:
            await create_signup(
                email="duplicate@example.com",
                db=db_session
            )
        
        assert "duplicate@example.com" in str(exc_info.value)


class TestGetSignup:
    """Test signup retrieval operations."""

    async def test_get_signup_by_email_exists(self, db_session: AsyncSession):
        """Test retrieving existing signup by email."""
        # Create signup
        created_signup = await create_signup(
            email="find@example.com",
            db=db_session
        )
        
        # Retrieve by email
        found_signup = await get_signup_by_email("find@example.com", db_session)
        
        assert found_signup is not None
        assert found_signup.id == created_signup.id
        assert found_signup.email == "find@example.com"
        assert found_signup.authoring_tools is None

    async def test_get_signup_by_email_not_exists(self, db_session: AsyncSession):
        """Test retrieving non-existent signup by email."""
        signup = await get_signup_by_email("nonexistent@example.com", db_session)
        assert signup is None

    async def test_get_signup_by_id_exists(self, db_session: AsyncSession):
        """Test retrieving existing signup by ID."""
        # Create signup
        created_signup = await create_signup(
            email="findbyid@example.com",
            db=db_session
        )
        
        # Retrieve by ID
        found_signup = await get_signup_by_id(created_signup.id, db_session)
        
        assert found_signup is not None
        assert found_signup.id == created_signup.id
        assert found_signup.email == "findbyid@example.com"

    async def test_get_signup_by_id_not_exists(self, db_session: AsyncSession):
        """Test retrieving non-existent signup by ID."""
        signup = await get_signup_by_id(999999, db_session)
        assert signup is None


class TestUpdateSignupStatus:
    """Test signup status updates."""

    async def test_update_signup_status_success(self, db_session: AsyncSession):
        """Test successful status update."""
        # Create signup
        await create_signup(
            email="update@example.com",
            db=db_session
        )
        
        # Update status
        updated_signup = await update_signup_status(
            "update@example.com",
            SignupStatus.UNSUBSCRIBED,
            db_session
        )
        
        assert updated_signup is not None
        assert updated_signup.status == SignupStatus.UNSUBSCRIBED
        assert updated_signup.updated_at is not None

    async def test_update_signup_status_not_exists(self, db_session: AsyncSession):
        """Test status update for non-existent email."""
        result = await update_signup_status(
            "nonexistent@example.com",
            SignupStatus.UNSUBSCRIBED,
            db_session
        )
        assert result is None

    async def test_unsubscribe_signup_success(self, db_session: AsyncSession):
        """Test successful unsubscribe."""
        # Create signup
        await create_signup(
            email="unsubscribe@example.com",
            db=db_session
        )
        
        # Unsubscribe
        updated_signup = await unsubscribe_signup("unsubscribe@example.com", db_session)
        
        assert updated_signup is not None
        assert updated_signup.status == SignupStatus.UNSUBSCRIBED

    async def test_unsubscribe_signup_not_exists(self, db_session: AsyncSession):
        """Test unsubscribe for non-existent email."""
        result = await unsubscribe_signup("nonexistent@example.com", db_session)
        assert result is None


class TestEmailExists:
    """Test email existence checking."""

    async def test_email_exists_true(self, db_session: AsyncSession):
        """Test email existence check returns True for existing email."""
        # Create signup
        await create_signup(
            email="exists@example.com",
            db=db_session
        )
        
        # Check existence
        exists = await email_exists("exists@example.com", db_session)
        assert exists is True

    async def test_email_exists_false(self, db_session: AsyncSession):
        """Test email existence check returns False for non-existent email."""
        exists = await email_exists("notexists@example.com", db_session)
        assert exists is False


class TestGetActiveSignupsCount:
    """Test active signups counting."""

    async def test_get_active_signups_count_empty(self, db_session: AsyncSession):
        """Test count when no signups exist."""
        count = await get_active_signups_count(db_session)
        assert count == 0

    async def test_get_active_signups_count_with_signups(self, db_session: AsyncSession):
        """Test count with various signup statuses."""
        # Create active signups
        await create_signup(email="active1@example.com", db=db_session)
        await create_signup(email="active2@example.com", db=db_session)
        
        # Create and then unsubscribe one
        await create_signup(email="unsub@example.com", db=db_session)
        await unsubscribe_signup("unsub@example.com", db_session)
        
        # Count should only include active ones
        count = await get_active_signups_count(db_session)
        assert count == 2


class TestSignupValidation:
    """Test data validation and edge cases."""

    async def test_create_signup_with_special_characters(self, db_session: AsyncSession):
        """Test signup creation with special characters in fields."""
        tools_with_special = ["LaTeX (Overleaf)", "R&D Tools"]
        signup = await create_signup(
            email="special@example.com",
            db=db_session,
            authoring_tools=tools_with_special,
            improvements="Better collaboration & real-time editing!",
        )
        
        parsed_tools = json.loads(signup.authoring_tools)
        assert parsed_tools == tools_with_special
        assert signup.improvements == "Better collaboration & real-time editing!"

    async def test_create_signup_with_long_fields(self, db_session: AsyncSession):
        """Test signup creation with long field values."""
        long_tools = [f"Tool{i}" for i in range(20)]  # Many tools
        long_improvements = "I" * 1000  # 1000 characters
        
        signup = await create_signup(
            email="long@example.com",
            db=db_session,
            authoring_tools=long_tools,
            improvements=long_improvements,
        )
        
        parsed_tools = json.loads(signup.authoring_tools)
        assert parsed_tools == long_tools
        assert len(parsed_tools) == 20
        assert signup.improvements == long_improvements
        assert len(signup.improvements) == 1000

    async def test_create_signup_with_different_tool_combinations(self, db_session: AsyncSession):
        """Test signup creation with different authoring tool combinations."""
        tool_combinations = [
            ["LaTeX"],
            ["Markdown", "Typst"],
            ["MS Word", "Google Docs", "Quarto"],
            ["LaTeX", "Custom Tool", "Another Tool"],
        ]
        
        for i, tools in enumerate(tool_combinations):
            signup = await create_signup(
                email=f"tools{i}@example.com",
                db=db_session,
                authoring_tools=tools,
            )
            parsed_tools = json.loads(signup.authoring_tools)
            assert parsed_tools == tools