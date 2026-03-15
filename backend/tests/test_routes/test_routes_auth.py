"""Test auth_router routes."""

from httpx import AsyncClient


async def test_register_new_user(client: AsyncClient):
    """Test successful user registration."""
    response = await client.post(
        "/register",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "initials": "TU",
            "password": "testpass123",
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Check response structure
    assert "access_token" in data
    assert "refresh_token" in data
    assert "token_type" in data
    assert data["token_type"] == "bearer"
    assert "user" in data

    # Check user data
    user = data["user"]
    assert user["email"] == "test@example.com"
    assert user["name"] == "Test User"
    assert user["initials"] == "TU"
    assert "id" in user
    assert "created_at" in user


async def test_register_duplicate_email(client: AsyncClient):
    """Test registration with already existing email."""
    # First registration
    await client.post(
        "/register",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "initials": "TU",
            "password": "testpass123",
        },
    )

    # Second registration with same email
    response = await client.post(
        "/register",
        json={
            "email": "test@example.com",
            "name": "Another User",
            "initials": "AU",
            "password": "anotherpass123",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered."


async def test_register_password_too_short(client: AsyncClient):
    """Test registration rejects passwords shorter than 8 characters."""
    response = await client.post(
        "/register",
        json={
            "email": "shortpw@example.com",
            "name": "Short PW",
            "initials": "SP",
            "password": "abc",
        },
    )

    assert response.status_code == 422
    assert "8 characters" in response.json()["detail"][0]["msg"]


async def test_register_invalid_email(client: AsyncClient):
    """Test registration with invalid email format."""
    response = await client.post(
        "/register",
        json={
            "email": "invalid-email",
            "name": "Test User",
            "initials": "TU",
            "password": "testpass123",
        },
    )

    assert response.status_code == 422  # Validation error


async def test_login_valid_credentials(client: AsyncClient):
    """Test login with valid credentials."""
    # First register a user
    await client.post(
        "/register",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "initials": "TU",
            "password": "testpass123",
        },
    )

    # Then login
    response = await client.post(
        "/login", json={"email": "test@example.com", "password": "testpass123"}
    )

    assert response.status_code == 200
    data = response.json()

    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_login_invalid_email(client: AsyncClient):
    """Test login with non-existent email."""
    response = await client.post(
        "/login", json={"email": "nonexistent@example.com", "password": "testpass123"}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid credentials"


async def test_login_invalid_password(client: AsyncClient):
    """Test login with wrong password."""
    # First register a user
    await client.post(
        "/register",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "initials": "TU",
            "password": "testpass123",
        },
    )

    # Then login with wrong password
    response = await client.post(
        "/login", json={"email": "test@example.com", "password": "wrongpassword"}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid credentials"


async def test_e2e_test_user_login(client: AsyncClient, db_session):
    """Test that the E2E test user can login successfully."""
    # First create the test user in the database
    from aris.models import User
    
    test_user = User(
        name="Test User",
        email="testuser@aris.pub",
        password_hash="$2b$12$TVuqGqn6SWbVFres301hUu6BtCWQHa.xpGPK4EwAKZo8mw50WXKBW",
    )
    db_session.add(test_user)
    await db_session.commit()
    
    # Now attempt to login
    login_response = await client.post(
        "/login",
        json={
            "email": "testuser@aris.pub",
            "password": "eIrdA38eW1guWTVpJNlS3VwP6eszUIGOiWqj1re3inM",
        },
    )

    print(login_response.json())

    assert login_response.status_code == 200
    data = login_response.json()

    # Verify token structure
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    # Verify user info
    user_response = await client.get(
        "/me", headers={"Authorization": f"Bearer {data['access_token']}"}
    )
    assert user_response.status_code == 200
    user_data = user_response.json()
    assert user_data["email"] == "testuser@aris.pub"
    assert user_data["name"] == "Test User"


async def test_me_endpoint_with_valid_token(client: AsyncClient):
    """Test /me endpoint with valid authentication."""
    # Register and get token
    register_response = await client.post(
        "/register",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "initials": "TU",
            "password": "testpass123",
        },
    )

    token = register_response.json()["access_token"]

    # Use token to access /me endpoint
    response = await client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    data = response.json()

    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert data["initials"] == "TU"
    assert "id" in data
    assert "created_at" in data
    assert "avatar_color" in data


async def test_me_endpoint_without_token(client: AsyncClient):
    """Test /me endpoint without authentication."""
    response = await client.get("/me")

    assert response.status_code == 401  # Unauthorized


async def test_me_endpoint_with_invalid_token(client: AsyncClient):
    """Test /me endpoint with invalid token."""
    response = await client.get("/me", headers={"Authorization": "Bearer invalid_token"})

    assert response.status_code == 401  # Unauthorized


async def test_register_without_initials(client: AsyncClient):
    """Test registration without initials (should auto-generate from name)."""
    response = await client.post(
        "/register",
        json={"email": "test@example.com", "name": "Test User", "password": "testpass123"},
    )

    assert response.status_code == 200
    data = response.json()

    user = data["user"]
    assert user["initials"] == "TU"  # Auto-generated from "Test User"


async def test_login_missing_fields(client: AsyncClient):
    """Test login with missing required fields."""
    response = await client.post(
        "/login",
        json={
            "email": "test@example.com"
            # Missing password
        },
    )

    assert response.status_code == 422  # Validation error


# --- Deploy preview restriction tests ---

DEPLOY_PREVIEW_ORIGIN_SITE = "https://deploy-preview-42--rsm-studio-site.netlify.app"
DEPLOY_PREVIEW_ORIGIN_FRONTEND = "https://deploy-preview-246--rsm-studio-frontend.netlify.app"


async def test_deploy_preview_login_rejects_non_test_user(client: AsyncClient):
    """Deploy preview origins can only log in as the test user."""
    response = await client.post(
        "/login",
        json={"email": "hacker@evil.com", "password": "whatever"},
        headers={"origin": DEPLOY_PREVIEW_ORIGIN_SITE},
    )
    assert response.status_code == 403
    assert "test account" in response.json()["detail"].lower()


async def test_deploy_preview_login_allows_test_user(client: AsyncClient, db_session):
    """Deploy preview origins can log in as the test user."""
    from aris.config import settings
    from aris.models import User
    from aris.security import hash_password

    test_user = User(
        email=settings.TEST_USER_EMAIL,
        name="Test User",
        password_hash=hash_password("testpass123"),
    )
    db_session.add(test_user)
    await db_session.commit()

    response = await client.post(
        "/login",
        json={"email": settings.TEST_USER_EMAIL, "password": "testpass123"},
        headers={"origin": DEPLOY_PREVIEW_ORIGIN_SITE},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_deploy_preview_register_blocked(client: AsyncClient):
    """Deploy preview origins cannot register new accounts."""
    response = await client.post(
        "/register",
        json={
            "email": "new@example.com",
            "name": "New User",
            "initials": "NU",
            "password": "testpass123",
        },
        headers={"origin": DEPLOY_PREVIEW_ORIGIN_SITE},
    )
    assert response.status_code == 403
    assert "deploy preview" in response.json()["detail"].lower()


async def test_deploy_preview_frontend_origin_rejects_non_test_user(client: AsyncClient):
    """Frontend deploy preview origins are also restricted."""
    response = await client.post(
        "/login",
        json={"email": "hacker@evil.com", "password": "whatever"},
        headers={"origin": DEPLOY_PREVIEW_ORIGIN_FRONTEND},
    )
    assert response.status_code == 403
    assert "test account" in response.json()["detail"].lower()


async def test_non_preview_origin_login_unrestricted(client: AsyncClient):
    """Non-deploy-preview origins are not restricted to test user."""
    await client.post(
        "/register",
        json={
            "email": "normal@example.com",
            "name": "Normal User",
            "initials": "NU",
            "password": "testpass123",
        },
    )
    response = await client.post(
        "/login",
        json={"email": "normal@example.com", "password": "testpass123"},
        headers={"origin": "https://app.rsm.studio"},
    )
    assert response.status_code == 200
