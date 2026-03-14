"""Tests for forgot-password and reset-password flows."""


import pytest


@pytest.mark.asyncio
async def test_forgot_password_sends_token(client, db_session, authenticated_user):
    """POST /forgot-password with a valid email stores a reset token."""
    response = await client.post(
        "/forgot-password",
        json={"email": authenticated_user["email"]},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "If that email is registered, a reset link has been sent."


@pytest.mark.asyncio
async def test_forgot_password_unknown_email_returns_same_message(client):
    """Unknown emails get the same 200 response to prevent enumeration."""
    response = await client.post(
        "/forgot-password",
        json={"email": "nobody@example.com"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "If that email is registered, a reset link has been sent."


@pytest.mark.asyncio
async def test_forgot_password_invalid_email_format(client):
    """Invalid email format returns 422."""
    response = await client.post(
        "/forgot-password",
        json={"email": "not-an-email"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_reset_password_valid_token(client, db_session, authenticated_user):
    """POST /reset-password with a valid token resets the password."""
    # Request a reset token
    await client.post(
        "/forgot-password",
        json={"email": authenticated_user["email"]},
    )

    # Retrieve the token from the database
    from sqlalchemy import select

    from aris.models import User

    result = await db_session.execute(
        select(User).where(User.email == authenticated_user["email"])
    )
    user = result.scalars().first()
    token = user.password_reset_token

    assert token is not None

    # Reset the password
    new_password = "brand_new_pass_123"
    response = await client.post(
        "/reset-password",
        json={"token": token, "new_password": new_password},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Password has been reset."

    # Verify the new password works for login
    login_response = await client.post(
        "/login",
        json={"email": authenticated_user["email"], "password": new_password},
    )
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client):
    """Invalid token returns 400."""
    response = await client.post(
        "/reset-password",
        json={"token": "bogus-token", "new_password": "newpass12345"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired reset token."


@pytest.mark.asyncio
async def test_reset_password_too_short(client, db_session, authenticated_user):
    """New password must be at least 8 characters."""
    await client.post(
        "/forgot-password",
        json={"email": authenticated_user["email"]},
    )

    from sqlalchemy import select

    from aris.models import User

    result = await db_session.execute(
        select(User).where(User.email == authenticated_user["email"])
    )
    user = result.scalars().first()
    token = user.password_reset_token

    response = await client.post(
        "/reset-password",
        json={"token": token, "new_password": "short"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_reset_token_is_single_use(client, db_session, authenticated_user):
    """After a successful reset, the same token cannot be reused."""
    await client.post(
        "/forgot-password",
        json={"email": authenticated_user["email"]},
    )

    from sqlalchemy import select

    from aris.models import User

    result = await db_session.execute(
        select(User).where(User.email == authenticated_user["email"])
    )
    user = result.scalars().first()
    token = user.password_reset_token

    # First reset succeeds
    await client.post(
        "/reset-password",
        json={"token": token, "new_password": "first_reset_pass"},
    )

    # Second attempt with same token fails
    response = await client.post(
        "/reset-password",
        json={"token": token, "new_password": "second_reset_pass"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_forgot_password_soft_deleted_user(client, db_session, authenticated_user):
    """Soft-deleted users should not receive reset tokens."""
    from datetime import UTC, datetime

    from sqlalchemy import select

    from aris.models import User

    result = await db_session.execute(
        select(User).where(User.email == authenticated_user["email"])
    )
    user = result.scalars().first()
    user.deleted_at = datetime.now(UTC)
    await db_session.commit()

    response = await client.post(
        "/forgot-password",
        json={"email": authenticated_user["email"]},
    )
    # Same message to prevent enumeration
    assert response.status_code == 200

    await db_session.refresh(user)
    assert user.password_reset_token is None
