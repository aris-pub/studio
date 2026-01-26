"""Tests for signup route endpoints."""

import logging
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from aris.crud.signup import get_signup_by_email
from aris.models.models import SignupStatus


class TestCreateSignupEndpoint:
    """Test POST /signup/ endpoint."""

    async def test_create_signup_success(self, client: AsyncClient):
        """Test successful signup creation."""
        signup_data = {
            "email": "newuser@example.com",
            "authoring_tools": ["LaTeX", "Markdown"],
            "improvements": "Better collaboration features",
        }

        response = await client.post("/signup/", json=signup_data)

        assert response.status_code == 200
        data = response.json()

        assert data["email"] == "newuser@example.com"
        assert data["authoring_tools"] == ["LaTeX", "Markdown"]
        assert data["improvements"] == "Better collaboration features"
        assert data["status"] == "active"
        assert "id" in data
        assert "created_at" in data
        assert "unsubscribe_token" in data
        assert len(data["unsubscribe_token"]) > 10  # Token should be reasonably long

    async def test_create_signup_minimal_data(self, client: AsyncClient):
        """Test signup creation with minimal required data."""
        signup_data = {"email": "minimal@example.com"}

        response = await client.post("/signup/", json=signup_data)

        assert response.status_code == 200
        data = response.json()

        assert data["email"] == "minimal@example.com"
        assert data["authoring_tools"] is None
        assert data["improvements"] is None
        assert data["status"] == "active"
        assert "unsubscribe_token" in data

    async def test_create_signup_duplicate_email(self, client: AsyncClient):
        """Test signup creation with duplicate email."""
        # First signup
        signup_data = {"email": "duplicate@example.com"}
        response = await client.post("/signup/", json=signup_data)
        assert response.status_code == 200

        # Second signup with same email
        signup_data = {"email": "duplicate@example.com"}
        response = await client.post("/signup/", json=signup_data)

        assert response.status_code == 409
        data = response.json()
        assert data["detail"]["error"] == "duplicate_email"
        assert "already registered" in data["detail"]["message"]

    async def test_create_signup_invalid_email(self, client: AsyncClient):
        """Test signup creation with invalid email format."""
        signup_data = {"email": "invalid-email"}

        response = await client.post("/signup/", json=signup_data)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        assert "email" in str(data).lower()

    async def test_create_signup_missing_required_fields(self, client: AsyncClient):
        """Test signup creation with missing required fields."""
        # Missing email - this should actually work now with minimal data
        signup_data = {"authoring_tools": ["LaTeX"]}
        response = await client.post("/signup/", json=signup_data)
        assert response.status_code == 422  # Email is required

        # Empty request body
        response = await client.post("/signup/", json={})
        assert response.status_code == 422  # Email is required

    async def test_create_signup_invalid_authoring_tools(self, client: AsyncClient):
        """Test signup creation with invalid authoring tools format."""
        signup_data = {
            "email": "test@example.com",
            "authoring_tools": "not_a_list",  # Should be a list
        }

        response = await client.post("/signup/", json=signup_data)

        assert response.status_code == 422

    async def test_create_signup_xss_protection(self, client: AsyncClient):
        """Test that XSS attempts are sanitized."""
        signup_data = {
            "email": "xss@example.com",
            "authoring_tools": ["LaTeX<script>alert('xss')</script>", "Normal Tool"],
            "improvements": "Better features<script>evil()</script> please!",
        }

        response = await client.post("/signup/", json=signup_data)

        assert response.status_code == 200
        data = response.json()

        # Check that HTML tags are escaped in improvements
        assert "<script>" not in data["improvements"]
        assert "&lt;script&gt;" in data["improvements"]
        # Authoring tools are stored as-is in JSON, but would be sanitized by frontend

    async def test_create_signup_empty_strings(self, client: AsyncClient):
        """Test signup creation with empty string values."""
        signup_data = {
            "email": "empty@example.com",
            "authoring_tools": [],  # Empty list
            "improvements": "",     # Empty string
        }

        response = await client.post("/signup/", json=signup_data)

        # Should succeed with empty optional fields
        assert response.status_code == 200
        data = response.json()
        assert data["authoring_tools"] == []
        assert data["improvements"] == ""


class TestCheckSignupStatusEndpoint:
    """Test GET /signup/status endpoint."""

    async def test_check_signup_status_exists(self, client: AsyncClient):
        """Test status check for existing email."""
        # Create signup first
        signup_data = {"email": "exists@example.com"}
        await client.post("/signup/", json=signup_data)

        # Check status
        response = await client.get("/signup/status?email=exists@example.com")

        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is True

    async def test_check_signup_status_not_exists(self, client: AsyncClient):
        """Test status check for non-existent email."""
        response = await client.get("/signup/status?email=notexists@example.com")

        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is False

    async def test_check_signup_status_invalid_email(self, client: AsyncClient):
        """Test status check with invalid email format."""
        response = await client.get("/signup/status?email=invalid-email")

        # Query parameter validation is less strict, so this might return 200 with exists=False
        # But it should not crash the application
        assert response.status_code in [200, 422]
        if response.status_code == 200:
            data = response.json()
            assert "exists" in data

    async def test_check_signup_status_missing_email(self, client: AsyncClient):
        """Test status check without email parameter."""
        response = await client.get("/signup/status")

        assert response.status_code == 422


class TestUnsubscribeEndpoint:
    """Test DELETE /signup/unsubscribe/{token} endpoint."""

    async def test_unsubscribe_success(self, client: AsyncClient, db_session):
        """Test successful unsubscribe with valid token."""
        # Create signup first
        signup_data = {"email": "unsubscribe@example.com"}
        create_response = await client.post("/signup/", json=signup_data)
        assert create_response.status_code == 200

        # Extract unsubscribe token from response
        signup_data = create_response.json()
        unsubscribe_token = signup_data["unsubscribe_token"]

        # Unsubscribe using token
        response = await client.delete(f"/signup/unsubscribe/{unsubscribe_token}")

        assert response.status_code == 200
        data = response.json()
        assert "Successfully unsubscribed" in data["message"]

        # Verify unsubscribed_at timestamp is set
        signup = await get_signup_by_email("unsubscribe@example.com", db_session)
        assert signup.status == SignupStatus.UNSUBSCRIBED
        assert signup.unsubscribed_at is not None

    async def test_unsubscribe_invalid_token(self, client: AsyncClient):
        """Test unsubscribe with invalid/non-existent token."""
        invalid_token = "invalid-token-123"
        response = await client.delete(f"/signup/unsubscribe/{invalid_token}")

        assert response.status_code == 404
        data = response.json()
        assert data["detail"]["error"] == "invalid_token"
        assert "Invalid or expired unsubscribe token" in data["detail"]["message"]

    async def test_unsubscribe_already_unsubscribed(
        self, client: AsyncClient, db_session
    ):
        """Test unsubscribe with token for already unsubscribed user."""
        # Create signup
        signup_data = {
            "email": "already_unsubscribed@example.com",
        }
        create_response = await client.post("/signup/", json=signup_data)
        unsubscribe_token = create_response.json()["unsubscribe_token"]

        # First unsubscribe
        response1 = await client.delete(f"/signup/unsubscribe/{unsubscribe_token}")
        assert response1.status_code == 200

        # Verify unsubscribed_at is set
        signup = await get_signup_by_email(
            "already_unsubscribed@example.com", db_session
        )
        assert signup.unsubscribed_at is not None
        first_unsubscribe_time = signup.unsubscribed_at

        # Second unsubscribe attempt
        response2 = await client.delete(f"/signup/unsubscribe/{unsubscribe_token}")
        assert response2.status_code == 400
        data = response2.json()
        assert data["detail"]["error"] == "already_unsubscribed"

        # Verify unsubscribed_at timestamp didn't change
        signup = await get_signup_by_email(
            "already_unsubscribed@example.com", db_session
        )
        assert signup.unsubscribed_at == first_unsubscribe_time

    async def test_unsubscribe_empty_token(self, client: AsyncClient):
        """Test unsubscribe with empty token."""
        response = await client.delete("/signup/unsubscribe/")

        # Should return 404 or 405 depending on route matching
        assert response.status_code in [404, 405]


class TestSignupEndpointIntegration:
    """Integration tests for signup endpoints."""

    async def test_complete_signup_flow(self, client: AsyncClient):
        """Test complete signup and unsubscribe flow."""
        email = "flow@example.com"

        # 1. Check email doesn't exist
        response = await client.get(f"/signup/status?email={email}")
        assert response.json()["exists"] is False

        # 2. Create signup
        signup_data = {
            "email": email,
            "authoring_tools": ["LaTeX", "Markdown"],
            "improvements": "Better collaboration features",
        }
        response = await client.post("/signup/", json=signup_data)
        assert response.status_code == 200
        signup_data = response.json()
        unsubscribe_token = signup_data["unsubscribe_token"]

        # 3. Check email now exists
        response = await client.get(f"/signup/status?email={email}")
        assert response.json()["exists"] is True

        # 4. Unsubscribe using token
        response = await client.delete(f"/signup/unsubscribe/{unsubscribe_token}")
        assert response.status_code == 200

        # 5. Email still exists (soft delete/unsubscribe)
        response = await client.get(f"/signup/status?email={email}")
        assert response.json()["exists"] is True

    async def test_signup_with_all_fields(self, client: AsyncClient):
        """Test signup with all possible fields filled."""
        signup_data = {
            "email": "complete@example.com",
            "authoring_tools": ["LaTeX", "Markdown", "Typst"],
            "improvements": "Better collaboration and real-time editing features would be amazing!",
        }

        response = await client.post("/signup/", json=signup_data)

        assert response.status_code == 200
        data = response.json()

        # Verify all fields are preserved
        for key, value in signup_data.items():
            assert data[key] == value

        # Verify computed fields
        assert data["status"] == "active"
        assert isinstance(data["id"], int)
        assert data["created_at"] is not None

    async def test_multiple_signups_different_emails(self, client: AsyncClient):
        """Test creating multiple signups with different emails."""
        emails = ["user1@example.com", "user2@example.com", "user3@example.com"]

        created_ids = []

        for i, email in enumerate(emails):
            signup_data = {
                "email": email,
                "authoring_tools": [["LaTeX"], ["Markdown"], ["Typst"]][i],
                "improvements": f"Improvements from user {i + 1}",
            }

            response = await client.post("/signup/", json=signup_data)
            assert response.status_code == 200

            data = response.json()
            created_ids.append(data["id"])

            # Verify unique IDs
            assert data["id"] not in created_ids[:-1]

    async def test_error_response_format(self, client: AsyncClient):
        """Test that error responses follow the expected format."""
        # Test duplicate email error format
        signup_data = {"email": "error@example.com"}
        await client.post("/signup/", json=signup_data)  # Create first

        response = await client.post("/signup/", json=signup_data)  # Duplicate
        assert response.status_code == 409

        data = response.json()
        assert "detail" in data
        assert "error" in data["detail"]
        assert "message" in data["detail"]
        assert "details" in data["detail"]


class TestSignupEndpointEmailIntegration:
    """Test signup endpoint email integration."""

    @patch('aris.routes.signup.get_email_service')
    async def test_signup_sends_confirmation_email(self, mock_get_email_service, client: AsyncClient):
        """Test that successful signup sends confirmation email."""
        # Mock email service
        mock_email_service = AsyncMock()
        mock_email_service.send_waitlist_confirmation.return_value = True
        mock_get_email_service.return_value = mock_email_service

        signup_data = {
            "email": "emailtest@example.com",
            "authoring_tools": ["LaTeX", "Markdown"],
            "improvements": "Better collaboration features"
        }

        response = await client.post("/signup/", json=signup_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify email service was called
        mock_get_email_service.assert_called_once()
        mock_email_service.send_waitlist_confirmation.assert_called_once_with(
            to_email="emailtest@example.com",
            unsubscribe_token=data["unsubscribe_token"]
        )

    @patch('aris.routes.signup.get_email_service')
    async def test_signup_continues_when_email_fails(self, mock_get_email_service, client: AsyncClient, caplog):
        """Test that signup succeeds even when email sending fails."""
        # Mock email service that fails
        mock_email_service = AsyncMock()
        mock_email_service.send_waitlist_confirmation.side_effect = Exception("Email API error")
        mock_get_email_service.return_value = mock_email_service

        signup_data = {
            "email": "emailfail@example.com",
        }

        with caplog.at_level(logging.ERROR):
            response = await client.post("/signup/", json=signup_data)
        
        # Signup should still succeed
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "emailfail@example.com"
        
        # But email error should be logged (though we can't easily test this with our current setup)
        mock_email_service.send_waitlist_confirmation.assert_called_once()

    @patch('aris.routes.signup.get_email_service')
    async def test_signup_when_email_service_disabled(self, mock_get_email_service, client: AsyncClient):
        """Test that signup works when email service is disabled."""
        # Mock disabled email service
        mock_get_email_service.return_value = None

        signup_data = {
            "email": "noemail@example.com",
        }

        response = await client.post("/signup/", json=signup_data)
        
        # Signup should succeed without email
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "noemail@example.com"
        
        mock_get_email_service.assert_called_once()

    @patch('aris.routes.signup.get_email_service')
    async def test_email_called_with_correct_parameters(self, mock_get_email_service, client: AsyncClient):
        """Test that email service is called with sanitized and correct data."""
        mock_email_service = AsyncMock()
        mock_email_service.send_waitlist_confirmation.return_value = True
        mock_get_email_service.return_value = mock_email_service

        signup_data = {
            "email": "parameterstest@example.com",
            "authoring_tools": ["LaTeX", "Markdown"],
            "improvements": "Dr. Jane <script>alert('xss')</script> needs better features",  # Test XSS sanitization
        }

        response = await client.post("/signup/", json=signup_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify email called with correct parameters
        mock_email_service.send_waitlist_confirmation.assert_called_once()
        call_args = mock_email_service.send_waitlist_confirmation.call_args

        assert call_args.kwargs["to_email"] == "parameterstest@example.com"
        assert call_args.kwargs["unsubscribe_token"] == data["unsubscribe_token"]
        
        # Verify XSS was sanitized in improvements field
        assert "<script>" not in data["improvements"]
        assert "&lt;script&gt;" in data["improvements"]
        assert "Dr. Jane" in data["improvements"]
