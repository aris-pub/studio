"""Tests for the feedback submission endpoint."""

from unittest.mock import AsyncMock, patch

import pytest
from conftest import TestConstants


@pytest.mark.asyncio
class TestSubmitFeedback:
    """POST /feedback"""

    async def test_submit_feedback_success(self, client, authenticated_user, db_session):
        token = authenticated_user["token"]
        response = await client.post(
            "/feedback",
            json={"message": "Great product!"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        assert response.json() == {"status": "ok"}

        # Verify row was persisted
        from sqlalchemy import text

        result = await db_session.execute(text("SELECT message, user_id FROM feedback"))
        row = result.fetchone()
        assert row is not None
        assert row.message == "Great product!"
        assert row.user_id == authenticated_user["user_id"]

    async def test_submit_feedback_unauthenticated(self, client):
        response = await client.post(
            "/feedback",
            json={"message": "Hello"},
        )
        assert response.status_code == 401

    async def test_submit_feedback_empty_message(self, client, authenticated_user):
        token = authenticated_user["token"]
        response = await client.post(
            "/feedback",
            json={"message": "   "},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_submit_feedback_missing_message(self, client, authenticated_user):
        token = authenticated_user["token"]
        response = await client.post(
            "/feedback",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    @patch("aris.routes.feedback.get_email_service")
    async def test_submit_feedback_sends_email(
        self, mock_get_email, client, authenticated_user
    ):
        mock_service = AsyncMock()
        mock_service.send_feedback_notification = AsyncMock(return_value=True)
        mock_get_email.return_value = mock_service

        token = authenticated_user["token"]
        response = await client.post(
            "/feedback",
            json={"message": "Love it!"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

        mock_service.send_feedback_notification.assert_called_once_with(
            user_email=TestConstants.DEFAULT_USER_EMAIL,
            user_name=TestConstants.DEFAULT_USER_NAME,
            message="Love it!",
        )

    @patch("aris.routes.feedback.get_email_service")
    async def test_submit_feedback_email_failure_does_not_fail_request(
        self, mock_get_email, client, authenticated_user
    ):
        mock_service = AsyncMock()
        mock_service.send_feedback_notification = AsyncMock(
            side_effect=Exception("SMTP down")
        )
        mock_get_email.return_value = mock_service

        token = authenticated_user["token"]
        response = await client.post(
            "/feedback",
            json={"message": "Still works"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
