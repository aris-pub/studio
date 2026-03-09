import io
import os
import sys

import pytest
from httpx import AsyncClient
from PIL import Image


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from conftest import TestConstants

from aris.models import ProfilePicture, User


def create_test_image(format="PNG", size=TestConstants.IMAGE_SIZE, color=TestConstants.IMAGE_COLOR):
    """Create a test image in memory with configurable parameters."""
    img = Image.new("RGB", size, color=color)
    img_bytes = io.BytesIO()
    img.save(img_bytes, format=format)
    img_bytes.seek(0)
    return img_bytes


async def create_test_file(client: AsyncClient, headers: dict, user_id: int):
    """Helper to create a test file and return its ID."""
    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": TestConstants.TEST_FILE_TITLE,
            "abstract": TestConstants.TEST_FILE_ABSTRACT,
            "owner_id": user_id,
            "source": TestConstants.TEST_FILE_SOURCE,
        },
    )
    assert response.status_code == 200, f"File creation failed: {response.json()}"
    return response.json()["id"]


async def upload_profile_picture(client: AsyncClient, headers: dict, user_id: int, format="PNG"):
    """Helper to upload a profile picture and return the response."""
    test_image = create_test_image(format)
    files = {"avatar": (f"test.{format.lower()}", test_image, f"image/{format.lower()}")}
    return await client.post(f"/users/{user_id}/avatar", headers=headers, files=files)


class TestUserEndpoints:
    """Test class for user-related endpoints."""

    async def test_get_user_without_auth(self, client: AsyncClient):
        """Test that user endpoint requires authentication."""
        response = await client.get("/users/1")
        assert response.status_code == 401

    async def test_get_user_success(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test getting user details with authentication."""
        response = await client.get(f"/users/{authenticated_user['user_id']}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == authenticated_user["user_id"]
        assert data["email"] == TestConstants.DEFAULT_USER_EMAIL
        assert data["name"] == TestConstants.DEFAULT_USER_NAME
        assert data["initials"] == TestConstants.DEFAULT_USER_INITIALS

    async def test_get_user_not_found(self, client: AsyncClient, auth_headers):
        """Test getting non-existent user."""
        response = await client.get(f"/users/{TestConstants.NONEXISTENT_ID}", headers=auth_headers)
        assert response.status_code == 404
        assert response.json()["detail"] == f"User with id {TestConstants.NONEXISTENT_ID} not found"

    async def test_update_user_success(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test updating user details."""
        update_data = {
            "name": TestConstants.UPDATED_NAME,
            "initials": TestConstants.UPDATED_INITIALS,
            "email": TestConstants.UPDATED_EMAIL,
        }
        response = await client.put(
            f"/users/{authenticated_user['user_id']}", headers=auth_headers, json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == TestConstants.UPDATED_NAME
        assert data["initials"] == TestConstants.UPDATED_INITIALS
        assert data["email"] == TestConstants.UPDATED_EMAIL


    async def test_get_user_includes_email_verification_status(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test that get user includes email verification status."""
        response = await client.get(f"/users/{authenticated_user['user_id']}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "email_verified" in data
        assert isinstance(data["email_verified"], bool)
        # New users should start unverified
        assert data["email_verified"] is False


class TestPasswordChange:
    """Test class for password change functionality."""

    async def test_change_password_success(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test successful password change."""
        password_data = {
            "current_password": TestConstants.TEST_PASSWORD,
            "new_password": "newpassword456"
        }
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/change-password", 
            headers=auth_headers, 
            json=password_data
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Password changed successfully"

    async def test_change_password_wrong_current(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test password change with wrong current password."""
        password_data = {
            "current_password": "wrongpassword",
            "new_password": "newpassword456"
        }
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/change-password", 
            headers=auth_headers, 
            json=password_data
        )
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    async def test_change_password_weak_password(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test password change with weak password."""
        password_data = {
            "current_password": TestConstants.TEST_PASSWORD,
            "new_password": "123"
        }
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/change-password", 
            headers=auth_headers, 
            json=password_data
        )
        assert response.status_code == 422

    async def test_change_password_missing_fields(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test password change with missing fields."""
        password_data = {
            "current_password": TestConstants.TEST_PASSWORD
            # Missing new_password
        }
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/change-password", 
            headers=auth_headers, 
            json=password_data
        )
        assert response.status_code == 422

    async def test_change_password_user_not_found(self, client: AsyncClient, auth_headers):
        """Test password change for non-existent user."""
        password_data = {
            "current_password": TestConstants.TEST_PASSWORD,
            "new_password": "newpassword456"
        }
        response = await client.post(
            f"/users/{TestConstants.NONEXISTENT_ID}/change-password", 
            headers=auth_headers, 
            json=password_data
        )
        assert response.status_code == 404

    async def test_change_password_unauthorized(self, client: AsyncClient, authenticated_user):
        """Test password change without authentication."""
        password_data = {
            "current_password": TestConstants.TEST_PASSWORD,
            "new_password": "newpassword456"
        }
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/change-password", 
            json=password_data
        )
        assert response.status_code == 401


class TestEmailVerification:
    """Test class for email verification functionality."""

    async def test_send_verification_email_success(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test successful verification email sending."""
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/send-verification",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "verification email sent" in response.json()["message"].lower()

    async def test_send_verification_email_user_not_found(self, client: AsyncClient, auth_headers):
        """Test sending verification email for non-existent user."""
        response = await client.post(
            f"/users/{TestConstants.NONEXISTENT_ID}/send-verification",
            headers=auth_headers
        )
        assert response.status_code == 404

    async def test_send_verification_email_already_verified(self, client: AsyncClient, authenticated_user, auth_headers, db_session):
        """Test sending verification email when already verified."""
        # First manually verify the user
        from aris.crud.user import get_user
        user = await get_user(authenticated_user['user_id'], db_session)
        user.email_verified = True
        await db_session.commit()
        
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/send-verification",
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "already verified" in response.json()["detail"].lower()

    async def test_send_verification_email_unauthorized(self, client: AsyncClient, authenticated_user):
        """Test sending verification email without authentication."""
        response = await client.post(
            f"/users/{authenticated_user['user_id']}/send-verification"
        )
        assert response.status_code == 401

    async def test_verify_email_valid_token(self, client: AsyncClient, authenticated_user, auth_headers, db_session):
        """Test email verification with valid token."""
        # First generate a token
        from aris.crud.user import get_user
        user = await get_user(authenticated_user['user_id'], db_session)
        token = user.generate_verification_token()
        await db_session.commit()
        
        response = await client.post(f"/users/verify-email/{token}")
        assert response.status_code == 200
        assert "verified successfully" in response.json()["message"].lower()
        
        # Check that user is now verified
        await db_session.refresh(user)
        assert user.email_verified is True

    async def test_verify_email_invalid_token(self, client: AsyncClient):
        """Test email verification with invalid token."""
        response = await client.post("/users/verify-email/invalid-token-12345")
        assert response.status_code == 404
        assert "invalid" in response.json()["detail"].lower()

    async def test_verify_email_token_already_used(self, client: AsyncClient, authenticated_user, auth_headers, db_session):
        """Test using token after email is already verified."""
        # Generate token and verify
        from aris.crud.user import get_user
        user = await get_user(authenticated_user['user_id'], db_session)
        token = user.generate_verification_token()
        user.email_verified = True
        await db_session.commit()
        
        response = await client.post(f"/users/verify-email/{token}")
        assert response.status_code == 400
        assert "already verified" in response.json()["detail"].lower()

    async def test_verify_email_empty_token(self, client: AsyncClient):
        """Test email verification with empty token."""
        response = await client.post("/users/verify-email")
        assert response.status_code == 405  # Method not allowed - route needs token parameter

    async def test_verification_token_generation_unique(self, db_session):
        """Test that verification tokens are unique."""
        from aris.models.models import User
        
        user1 = User(name="User 1", email="user1@test.com", password_hash="hash1")
        user2 = User(name="User 2", email="user2@test.com", password_hash="hash2")
        
        token1 = user1.generate_verification_token()
        token2 = user2.generate_verification_token()
        
        assert token1 != token2
        assert len(token1) == 32
        assert len(token2) == 32


class TestUserEndpoints2:
    """Additional test class for user endpoints."""

    async def test_update_user_not_found(self, client: AsyncClient, auth_headers):
        """Test updating non-existent user."""
        update_data = {
            "name": TestConstants.UPDATED_NAME,
            "initials": TestConstants.UPDATED_INITIALS,
            "email": TestConstants.UPDATED_EMAIL,
        }
        response = await client.put(
            f"/users/{TestConstants.NONEXISTENT_ID}", headers=auth_headers, json=update_data
        )
        assert response.status_code == 404
        assert response.json()["detail"] == f"User with id {TestConstants.NONEXISTENT_ID} not found"

    async def test_update_user_without_auth(self, client: AsyncClient):
        """Test updating user without authentication."""
        response = await client.put(
            "/users/1",
            json={"name": "Name", "initials": "NN", "email": "email@example.com"},
        )
        assert response.status_code == 401

    async def test_soft_delete_user_success(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test soft deleting user."""
        response = await client.delete(
            f"/users/{authenticated_user['user_id']}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == f"User {authenticated_user['user_id']} soft deleted"

    async def test_soft_delete_user_not_found(self, client: AsyncClient, auth_headers):
        """Test soft deleting non-existent user."""
        response = await client.delete(
            f"/users/{TestConstants.NONEXISTENT_ID}", headers=auth_headers
        )
        assert response.status_code == 404
        assert response.json()["detail"] == f"User with id {TestConstants.NONEXISTENT_ID} not found"

    async def test_soft_delete_user_without_auth(self, client: AsyncClient):
        """Test soft deleting user without authentication."""
        response = await client.delete("/users/1")
        assert response.status_code == 401


class TestUserFiles:
    """Test class for user file-related endpoints."""

    async def test_get_user_files_success(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test getting user files."""
        response = await client.get(
            f"/users/{authenticated_user['user_id']}/files", headers=auth_headers
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_get_user_files_with_params(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test getting user files with query parameters."""
        response = await client.get(
            f"/users/{authenticated_user['user_id']}/files?with_tags=false", headers=auth_headers
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_get_user_files_without_auth(self, client: AsyncClient):
        """Test getting user files without authentication."""
        response = await client.get("/users/1/files")
        assert response.status_code == 401

    async def test_get_user_files_user_not_found(self, client: AsyncClient, auth_headers):
        """Test getting files for non-existent user."""
        response = await client.get(
            f"/users/{TestConstants.NONEXISTENT_ID}/files", headers=auth_headers
        )
        assert response.status_code == 404
        assert response.json()["detail"] == f"User with id {TestConstants.NONEXISTENT_ID} not found"

    async def test_get_user_file_success(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test getting specific user file."""
        file_id = await create_test_file(client, auth_headers, authenticated_user["user_id"])

        response = await client.get(
            f"/users/{authenticated_user['user_id']}/files/{file_id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == file_id

    async def test_get_user_file_with_params(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test getting user file with query parameters."""
        file_id = await create_test_file(client, auth_headers, authenticated_user["user_id"])

        response = await client.get(
            f"/users/{authenticated_user['user_id']}/files/{file_id}?with_tags=false&with_minimap=false",
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_get_user_file_without_auth(self, client: AsyncClient):
        """Test getting user file without authentication."""
        response = await client.get("/users/1/files/1")
        assert response.status_code == 401

    async def test_get_user_file_user_not_found(self, client: AsyncClient, auth_headers):
        """Test getting file for non-existent user."""
        response = await client.get(
            f"/users/{TestConstants.NONEXISTENT_ID}/files/1", headers=auth_headers
        )
        assert response.status_code == 404
        assert response.json()["detail"] == f"User with id {TestConstants.NONEXISTENT_ID} not found"

    async def test_get_user_file_file_not_found(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test getting non-existent file."""
        response = await client.get(
            f"/users/{authenticated_user['user_id']}/files/{TestConstants.NONEXISTENT_ID}",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert response.json()["detail"] == f"File with id {TestConstants.NONEXISTENT_ID} not found"


class TestProfilePicture:
    """Test class for profile picture endpoints."""

    async def test_upload_profile_picture_success(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test uploading profile picture successfully."""
        response = await upload_profile_picture(client, auth_headers, authenticated_user["user_id"])
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Profile picture uploaded successfully"
        assert "picture_id" in data

    async def test_upload_profile_picture_unauthorized(
        self, client: AsyncClient, second_authenticated_user, auth_headers
    ):
        """Test uploading profile picture for another user (unauthorized)."""
        response = await upload_profile_picture(
            client, auth_headers, second_authenticated_user["user_id"]
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized to update this profile"

    async def test_upload_profile_picture_invalid_type(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test uploading profile picture with invalid file type."""
        text_content = io.BytesIO(b"This is not an image")
        files = {"avatar": ("test.txt", text_content, "text/plain")}

        response = await client.post(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers, files=files
        )
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    async def test_upload_profile_picture_too_large(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test uploading profile picture that's too large."""
        large_content = b"x" * TestConstants.LARGE_FILE_SIZE
        files = {"avatar": ("large.png", io.BytesIO(large_content), "image/png")}

        response = await client.post(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers, files=files
        )
        assert response.status_code == 400
        assert "File size too large" in response.json()["detail"]

    async def test_get_profile_picture_success(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test getting profile picture successfully."""
        upload_response = await upload_profile_picture(
            client, auth_headers, authenticated_user["user_id"]
        )
        assert upload_response.status_code == 200

        response = await client.get(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert "Content-Disposition" in response.headers
        assert "Cache-Control" in response.headers

    async def test_get_profile_picture_unauthorized(
        self, client: AsyncClient, second_authenticated_user, auth_headers
    ):
        """Test getting profile picture for another user (unauthorized)."""
        response = await client.get(
            f"/users/{second_authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized to retrieve this profile"

    async def test_get_profile_picture_not_found(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test getting non-existent profile picture."""
        response = await client.get(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Profile picture not found"

    async def test_get_profile_picture_wrong_user(self, client: AsyncClient, auth_headers):
        """Test getting profile picture for non-existent user."""
        response = await client.get(
            f"/users/{TestConstants.NONEXISTENT_ID}/avatar", headers=auth_headers
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized to retrieve this profile"

    async def test_delete_profile_picture_success(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test deleting profile picture successfully."""
        upload_response = await upload_profile_picture(
            client, auth_headers, authenticated_user["user_id"]
        )
        assert upload_response.status_code == 200

        response = await client.delete(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Profile picture deleted successfully"

    async def test_delete_profile_picture_unauthorized(
        self, client: AsyncClient, second_authenticated_user, auth_headers
    ):
        """Test deleting profile picture for another user (unauthorized)."""
        response = await client.delete(
            f"/users/{second_authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized to delete this profile"

    async def test_delete_profile_picture_not_found(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test deleting non-existent profile picture."""
        response = await client.delete(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Profile picture not found"

    async def test_delete_profile_picture_wrong_user(self, client: AsyncClient, auth_headers):
        """Test deleting profile picture for non-existent user."""
        response = await client.delete(
            f"/users/{TestConstants.NONEXISTENT_ID}/avatar", headers=auth_headers
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized to delete this profile"

    async def test_upload_profile_picture_replace_existing(
        self, client: AsyncClient, authenticated_user, auth_headers
    ):
        """Test uploading profile picture when one already exists (should replace)."""
        # Upload first profile picture
        response1 = await upload_profile_picture(
            client, auth_headers, authenticated_user["user_id"], "PNG"
        )
        assert response1.status_code == 200
        first_picture_id = response1.json()["picture_id"]

        # Upload second profile picture (should replace first)
        response2 = await upload_profile_picture(
            client, auth_headers, authenticated_user["user_id"], "JPEG"
        )
        assert response2.status_code == 200
        second_picture_id = response2.json()["picture_id"]

        # Should be different IDs
        assert first_picture_id != second_picture_id

        # Getting avatar should return the new one
        get_response = await client.get(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert get_response.status_code == 200
        assert get_response.headers["content-type"] == "image/jpeg"

    @pytest.mark.parametrize(
        "format_name,mime_type",
        [
            ("PNG", "image/png"),
            ("JPEG", "image/jpeg"),
            ("GIF", "image/gif"),
            ("WEBP", "image/webp"),
        ],
    )
    async def test_multiple_file_formats(
        self, client: AsyncClient, authenticated_user, auth_headers, format_name, mime_type
    ):
        """Test uploading different valid image formats."""
        response = await upload_profile_picture(
            client, auth_headers, authenticated_user["user_id"], format_name
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Profile picture uploaded successfully"


class TestErrorHandling:
    """Test class for error handling scenarios."""

    async def test_get_profile_picture_invalid_data(
        self, client: AsyncClient, authenticated_user, auth_headers, db_session
    ):
        """Test getting profile picture with corrupted data."""
        # Upload a valid profile picture
        upload_response = await upload_profile_picture(
            client, auth_headers, authenticated_user["user_id"]
        )
        assert upload_response.status_code == 200

        # Corrupt the stored content to be invalid base64
        pic_id = upload_response.json()["picture_id"]
        pp = await db_session.get(ProfilePicture, pic_id)
        pp.content = "not_base64!"
        await db_session.commit()

        # Attempt to retrieve the corrupted profile picture
        response = await client.get(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 500
        assert response.json()["detail"] == "Invalid image data"

    async def test_upload_profile_picture_user_not_found(
        self, client: AsyncClient, authenticated_user, auth_headers, db_session
    ):
        """Test uploading profile picture for a user that was deleted."""
        # Delete the user first
        user = await db_session.get(User, authenticated_user["user_id"])
        await db_session.delete(user)
        await db_session.commit()

        response = await upload_profile_picture(client, auth_headers, authenticated_user["user_id"])
        assert response.status_code == 401

    async def test_upload_profile_picture_db_error(
        self, client: AsyncClient, authenticated_user, auth_headers, db_session, monkeypatch
    ):
        """Test uploading profile picture when a database error occurs."""

        async def bad_flush(*args, **kwargs):
            raise TypeError("Database error")

        monkeypatch.setattr(db_session, "flush", bad_flush)

        response = await upload_profile_picture(client, auth_headers, authenticated_user["user_id"])
        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to upload profile picture"

    async def test_get_profile_picture_user_not_found_after_deletion(
        self, client: AsyncClient, authenticated_user, auth_headers, db_session
    ):
        """Test retrieving profile picture for a user that was deleted."""
        # Delete the user
        user = await db_session.get(User, authenticated_user["user_id"])
        await db_session.delete(user)
        await db_session.commit()

        response = await client.get(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 401

    async def test_delete_profile_picture_user_not_found_after_deletion(
        self, client: AsyncClient, authenticated_user, auth_headers, db_session
    ):
        """Test deleting profile picture when the user was deleted."""
        # Delete the user
        user = await db_session.get(User, authenticated_user["user_id"])
        await db_session.delete(user)
        await db_session.commit()

        response = await client.delete(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 401

    async def test_delete_profile_picture_db_error(
        self, client: AsyncClient, authenticated_user, auth_headers, db_session, monkeypatch
    ):
        """Test deleting profile picture when a database error occurs."""
        # First upload a profile picture
        upload_resp = await upload_profile_picture(
            client, auth_headers, authenticated_user["user_id"]
        )
        assert upload_resp.status_code == 200

        # Mock database error
        async def bad_commit(*args, **kwargs):
            raise ValueError("Database commit failed")

        monkeypatch.setattr(db_session, "commit", bad_commit)

        response = await client.delete(
            f"/users/{authenticated_user['user_id']}/avatar", headers=auth_headers
        )
        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to delete profile picture"


class TestUserLookup:
    """Test class for POST /users/lookup endpoint."""

    async def test_lookup_user_success(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test successful lookup returns user_id, name, initials, avatar_color."""
        response = await client.post(
            "/users/lookup",
            headers=auth_headers,
            json={"email": TestConstants.DEFAULT_USER_EMAIL},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == authenticated_user["user_id"]
        assert data["name"] == TestConstants.DEFAULT_USER_NAME
        assert data["initials"] == TestConstants.DEFAULT_USER_INITIALS
        assert "avatar_color" in data

    async def test_lookup_user_not_found(self, client: AsyncClient, auth_headers):
        """Test 404 for non-existent email."""
        response = await client.post(
            "/users/lookup",
            headers=auth_headers,
            json={"email": "nonexistent@example.com"},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "No account found for this email"

    async def test_lookup_user_case_insensitive(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test case-insensitive email matching."""
        response = await client.post(
            "/users/lookup",
            headers=auth_headers,
            json={"email": TestConstants.DEFAULT_USER_EMAIL.upper()},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == authenticated_user["user_id"]

    async def test_lookup_user_rate_limited(self, client: AsyncClient, authenticated_user, auth_headers):
        """Test rate limiting: 10 requests OK, 11th returns 429."""
        from aris.routes.user import _lookup_timestamps
        _lookup_timestamps.clear()

        for _ in range(10):
            response = await client.post(
                "/users/lookup",
                headers=auth_headers,
                json={"email": TestConstants.DEFAULT_USER_EMAIL},
            )
            assert response.status_code == 200

        response = await client.post(
            "/users/lookup",
            headers=auth_headers,
            json={"email": TestConstants.DEFAULT_USER_EMAIL},
        )
        assert response.status_code == 429
        assert "too many" in response.json()["detail"].lower()

    async def test_lookup_user_requires_auth(self, client: AsyncClient):
        """Test that lookup requires authentication (401 without token)."""
        response = await client.post(
            "/users/lookup",
            json={"email": "someone@example.com"},
        )
        assert response.status_code == 401
