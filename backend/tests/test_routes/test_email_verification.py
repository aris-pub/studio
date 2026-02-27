"""Tests for email verification flow.

Covers registration-triggered verification, the send-verification endpoint,
and the verify-email endpoint. Resend API is always mocked — no real emails sent.
"""

import os
import sys
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from conftest import TestConstants

from aris.models import User


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_resend(monkeypatch):
    """Enable the email service with a fake API key and mock Resend.Emails.send.

    Without this fixture the email service is disabled (RESEND_API_KEY is blank
    in conftest.py), so tests that want to assert emails are sent must use it.
    """
    monkeypatch.setattr("aris.services.email.settings.ENV", "PROD")
    monkeypatch.setattr("aris.services.email.settings.RESEND_API_KEY", "test_key")
    monkeypatch.setattr("aris.routes.auth.settings.FRONTEND_URL", "https://studio.test")
    monkeypatch.setattr("aris.routes.user.settings.FRONTEND_URL", "https://studio.test")
    with patch("resend.Emails.send") as mock_send:
        mock_send.return_value = {"id": "fake-email-id"}
        yield mock_send


async def _register(client: AsyncClient, email: str = TestConstants.DEFAULT_USER_EMAIL) -> dict:
    """Helper: register a user and return the response JSON."""
    response = await client.post(
        "/register",
        json={
            "email": email,
            "name": TestConstants.DEFAULT_USER_NAME,
            "initials": TestConstants.DEFAULT_USER_INITIALS,
            "password": TestConstants.DEFAULT_PASSWORD,
        },
    )
    assert response.status_code == 200, f"Registration failed: {response.json()}"
    return response.json()


# ---------------------------------------------------------------------------
# Registration behaviour
# ---------------------------------------------------------------------------

class TestRegistrationEmailVerification:
    async def test_new_user_email_not_verified(self, client: AsyncClient, db_session):
        """Newly registered users should have email_verified=False."""
        data = await _register(client)
        assert data["user"]["email_verified"] is False

    async def test_registration_generates_verification_token(
        self, client: AsyncClient, db_session
    ):
        """Registration must generate and persist a verification token."""
        data = await _register(client)
        user_id = data["user"]["id"]

        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        assert user is not None
        assert user.email_verification_token is not None
        assert len(user.email_verification_token) > 0
        assert user.email_verification_sent_at is not None

    async def test_registration_sends_verification_email(
        self, client: AsyncClient, db_session, mock_resend
    ):
        """Registration must trigger exactly one verification email."""
        await _register(client)

        mock_resend.assert_called_once()
        call_params = mock_resend.call_args[0][0]
        assert call_params["subject"] == "Confirm your email — RSM Studio"
        assert TestConstants.DEFAULT_USER_EMAIL in call_params["to"]
        assert "/verify-email/" in call_params["html"]

    async def test_registration_verification_link_contains_token(
        self, client: AsyncClient, db_session, mock_resend
    ):
        """The token in the email link must match the stored token."""
        data = await _register(client)
        user_id = data["user"]["id"]

        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        stored_token = user.email_verification_token

        call_params = mock_resend.call_args[0][0]
        assert stored_token in call_params["html"]
        assert stored_token in call_params["text"]

    async def test_registration_no_email_when_service_disabled(
        self, client: AsyncClient, db_session
    ):
        """When RESEND_API_KEY is blank the registration still succeeds — no email attempted."""
        # mock_resend fixture NOT used here; RESEND_API_KEY is "" from conftest.py
        with patch("resend.Emails.send") as mock_send:
            await _register(client)
            mock_send.assert_not_called()


# ---------------------------------------------------------------------------
# Send-verification endpoint
# ---------------------------------------------------------------------------

class TestSendVerificationEndpoint:
    async def test_send_verification_requires_auth(self, client: AsyncClient):
        response = await client.post("/users/999/send-verification")
        assert response.status_code == 401

    async def test_send_verification_success(
        self, client: AsyncClient, db_session, mock_resend
    ):
        """Endpoint must generate token, persist it, and send email."""
        data = await _register(client)
        user_id = data["user"]["id"]
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        # Clear token so we can detect regeneration
        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        user.email_verification_token = None
        await db_session.commit()

        mock_resend.reset_mock()
        response = await client.post(f"/users/{user_id}/send-verification", headers=headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Verification email sent successfully"

        await db_session.refresh(user)
        assert user.email_verification_token is not None
        mock_resend.assert_called_once()

    async def test_send_verification_already_verified(
        self, client: AsyncClient, db_session
    ):
        """Returns 400 when the user's email is already verified."""
        data = await _register(client)
        user_id = data["user"]["id"]
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        user.email_verified = True
        await db_session.commit()

        response = await client.post(f"/users/{user_id}/send-verification", headers=headers)
        assert response.status_code == 400
        assert "already verified" in response.json()["detail"].lower()

    async def test_send_verification_user_not_found(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        response = await client.post(
            f"/users/{TestConstants.NONEXISTENT_ID}/send-verification",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_send_verification_no_email_when_service_disabled(
        self, client: AsyncClient, db_session
    ):
        """Token is still generated even when email service is disabled."""
        data = await _register(client)
        user_id = data["user"]["id"]
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        user.email_verification_token = None
        await db_session.commit()

        with patch("resend.Emails.send") as mock_send:
            response = await client.post(f"/users/{user_id}/send-verification", headers=headers)
            assert response.status_code == 200
            mock_send.assert_not_called()

        await db_session.refresh(user)
        assert user.email_verification_token is not None


# ---------------------------------------------------------------------------
# Verify-email endpoint
# ---------------------------------------------------------------------------

class TestVerifyEmailEndpoint:
    async def test_verify_email_success(self, client: AsyncClient, db_session):
        """Valid token marks user as verified and clears the token."""
        data = await _register(client)
        user_id = data["user"]["id"]

        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        token = user.email_verification_token
        assert token is not None

        response = await client.post(f"/users/verify-email/{token}")
        assert response.status_code == 200
        assert response.json()["message"] == "Email verified successfully"

        await db_session.refresh(user)
        assert user.email_verified is True
        assert user.email_verification_token is None
        assert user.email_verification_sent_at is None

    async def test_verify_email_invalid_token(self, client: AsyncClient):
        response = await client.post("/users/verify-email/totally-bogus-token")
        assert response.status_code == 404
        assert "invalid" in response.json()["detail"].lower()

    async def test_verify_email_already_verified(self, client: AsyncClient, db_session):
        """Returns 400 when email is already verified."""
        data = await _register(client)
        user_id = data["user"]["id"]

        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        token = user.email_verification_token
        user.email_verified = True
        await db_session.commit()

        response = await client.post(f"/users/verify-email/{token}")
        assert response.status_code == 400
        assert "already verified" in response.json()["detail"].lower()

    async def test_verify_email_is_public_endpoint(self, client: AsyncClient, db_session):
        """verify-email must work without an auth token (unauthenticated user clicking link)."""
        data = await _register(client)
        user_id = data["user"]["id"]

        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        token = user.email_verification_token

        # No Authorization header
        response = await client.post(f"/users/verify-email/{token}")
        assert response.status_code == 200

    async def test_verify_email_token_consumed(self, client: AsyncClient, db_session):
        """Using the same token twice should fail on the second attempt."""
        data = await _register(client)
        user_id = data["user"]["id"]

        result = await db_session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        token = user.email_verification_token

        first = await client.post(f"/users/verify-email/{token}")
        assert first.status_code == 200

        second = await client.post(f"/users/verify-email/{token}")
        # Token is cleared after first use — now invalid (404) or already verified (400)
        assert second.status_code in (400, 404)
