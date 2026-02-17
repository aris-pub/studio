"""Reset test user to known state for visual regression tests.

This script resets the test user (testuser@aris.pub) to a known state
with stable test data for visual regression testing.
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text


# Add the backend directory to Python path so we can import aris modules
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Import aris modules after adding to path
from aris.deps import ArisSession  # noqa: E402
from aris.models.models import File, FilePermission, FileRole, FileStatus, Tag, User  # noqa: E402
from aris.security import hash_password  # noqa: E402


# Load environment variables using the same logic as config.py
env_file = backend_dir / ".env"
# Load .env file but don't override existing environment variables
load_dotenv(env_file, override=False)

TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL", "testuser@aris.pub")
TEST_USER_PASSWORD = os.getenv("TEST_USER_PASSWORD")

if not TEST_USER_PASSWORD:
    print("⚠️  TEST_USER_PASSWORD not found in environment variables, using default")
    TEST_USER_PASSWORD = "testpassword123"

print("🔍 [RESET-USER-DEBUG] Starting test user reset script")
print(f"🔍 [RESET-USER-DEBUG] Python path: {sys.path[:3]}...")
print(f"🔍 [RESET-USER-DEBUG] Backend directory: {backend_dir}")
print(f"🔍 [RESET-USER-DEBUG] Environment file: {env_file} (exists: {env_file.exists()})")
print(f"📧 Using test user email: {TEST_USER_EMAIL}")
print(f"🔑 Test password length: {len(TEST_USER_PASSWORD)} characters")
print(f"🔑 Test password starts with: {TEST_USER_PASSWORD[:4]}...")
print("🔍 [RESET-USER-DEBUG] Environment variables check:")
print(f"   - ENV: {os.getenv('ENV', 'UNSET')}")
print(f"   - DB_URL_LOCAL: {os.getenv('DB_URL_LOCAL', 'UNSET')}")
print(f"   - DB_URL_PROD: {os.getenv('DB_URL_PROD', 'UNSET')}")
print(f"   - ALEMBIC_DB_URL_LOCAL: {os.getenv('ALEMBIC_DB_URL_LOCAL', 'UNSET')}")
print(f"   - ALEMBIC_DB_URL_PROD: {os.getenv('ALEMBIC_DB_URL_PROD', 'UNSET')}")


async def reset_test_user():
    """Reset test user and their data to known stable state."""
    print("🔍 [RESET-USER-DEBUG] Initializing database session...")
    
    try:
        session = ArisSession()
        print("✅ [RESET-USER-DEBUG] Database session created successfully")
    except Exception as e:
        print(f"❌ [RESET-USER-DEBUG] Failed to create database session: {e}")
        raise

    try:
        print(f"🔍 [RESET-USER-DEBUG] Searching for existing test user: {TEST_USER_EMAIL}")
        
        # Find or create test user
        existing_user = await session.execute(
            text("SELECT * FROM users WHERE email = :email"), {"email": TEST_USER_EMAIL}
        )
        user_row = existing_user.first()
        print(f"🔍 [RESET-USER-DEBUG] User query result: {'Found' if user_row else 'Not found'}")

        if user_row:
            user_id = user_row.id
            print(f"🔍 [RESET-USER-DEBUG] Found existing user with ID: {user_id}")
            print("🔍 [RESET-USER-DEBUG] Cleaning up existing user data...")
            
            # Delete all existing data for test user
            print("🔍 [RESET-USER-DEBUG] Deleting file_tags...")
            await session.execute(
                text("DELETE FROM file_tags WHERE file_id IN (SELECT id FROM files WHERE owner_id = :user_id)"),
                {"user_id": user_id},
            )
            print("🔍 [RESET-USER-DEBUG] Deleting file_permissions...")
            await session.execute(
                text("DELETE FROM file_permissions WHERE file_id IN (SELECT id FROM files WHERE owner_id = :user_id)"),
                {"user_id": user_id},
            )
            print("🔍 [RESET-USER-DEBUG] Deleting files...")
            await session.execute(
                text("DELETE FROM files WHERE owner_id = :user_id"), {"user_id": user_id}
            )
            print("🔍 [RESET-USER-DEBUG] Deleting tags...")
            await session.execute(text("DELETE FROM tags WHERE user_id = :user_id"), {"user_id": user_id})
            print("🔍 [RESET-USER-DEBUG] Deleting file_settings...")
            await session.execute(
                text("DELETE FROM file_settings WHERE user_id = :user_id"), {"user_id": user_id}
            )

            # Reset file ID sequence to ensure file ID 1 is used
            # Note: SQLite AUTOINCREMENT resets automatically when all rows are deleted
            # PostgreSQL requires explicit sequence reset
            print("🔍 [RESET-USER-DEBUG] Resetting file ID sequence...")
            db_url = os.getenv("DB_URL_LOCAL", "")
            if "postgresql" in db_url or "postgres" in db_url:
                await session.execute(text("ALTER SEQUENCE files_id_seq RESTART WITH 1"))
                print("🔍 [RESET-USER-DEBUG] PostgreSQL sequence reset")
            else:
                # SQLite - AUTOINCREMENT resets when table is empty
                # Delete the sqlite_sequence entry to reset to 1 (if it exists)
                try:
                    await session.execute(text("DELETE FROM sqlite_sequence WHERE name='files'"))
                    print("🔍 [RESET-USER-DEBUG] SQLite sequence reset")
                except Exception:
                    # sqlite_sequence table doesn't exist yet (no AUTOINCREMENT columns used)
                    print("🔍 [RESET-USER-DEBUG] SQLite sequence table not found (will auto-reset)")

            # Update user with fresh password hash
            print("🔍 [RESET-USER-DEBUG] Hashing password...")
            password_hash = hash_password(TEST_USER_PASSWORD)
            print(f"🔍 [RESET-USER-DEBUG] Password hash created (length: {len(password_hash)})")
            print("🔍 [RESET-USER-DEBUG] Updating user with new password...")
            await session.execute(
                text("UPDATE users SET password_hash = :password_hash, name = :name, email = :email WHERE id = :user_id"),
                {"password_hash": password_hash, "name": "Test User", "email": TEST_USER_EMAIL, "user_id": user_id},
            )
            print("🔍 [RESET-USER-DEBUG] Committing user update...")
            await session.commit()
            print("✅ [RESET-USER-DEBUG] Existing user updated successfully")
        else:
            print("🔍 [RESET-USER-DEBUG] No existing user found, creating new user...")
            # Create new test user
            password_hash = hash_password(TEST_USER_PASSWORD)
            print(f"🔍 [RESET-USER-DEBUG] Password hash created (length: {len(password_hash)})")
            user = User(name="Test User", email=TEST_USER_EMAIL, password_hash=password_hash)
            session.add(user)
            print("🔍 [RESET-USER-DEBUG] User added to session, committing...")
            await session.commit()
            user_id = user.id
            print(f"✅ [RESET-USER-DEBUG] New user created with ID: {user_id}")

        # Create stable test files
        print(f"🔍 [RESET-USER-DEBUG] Creating test files for user {user_id}...")
        print(f"🔍 [RESET-USER-DEBUG] FileStatus.DRAFT value: '{FileStatus.DRAFT.value}'")
        print(f"🔍 [RESET-USER-DEBUG] FileStatus.DRAFT enum: {FileStatus.DRAFT}")
        test_files = [
            File(
                title="Test Visual Regression File",
                abstract="Stable test file for visual regression testing.",
                keywords="test, visual, regression",
                status=FileStatus.DRAFT,
                owner_id=user_id,
                source="""# Test Visual Regression File

This file is used for visual regression testing.
Content should remain stable.

## Section 1
Lorem ipsum test content.

## Section 2
More stable test content here.
""",
            ),
            File(
                title="Another Test File",
                abstract="Second stable test file.",
                keywords="test, stable, visual",
                status=FileStatus.DRAFT,
                owner_id=user_id,
                source="""# Another Test File

This is another stable test file for visual tests.
""",
            ),
        ]

        session.add_all(test_files)
        print("🔍 [RESET-USER-DEBUG] Committing test files...")
        await session.commit()
        print(f"✅ [RESET-USER-DEBUG] Created {len(test_files)} test files")

        # Create OWNER permissions for test files
        print("🔍 [RESET-USER-DEBUG] Creating OWNER permissions for test files...")
        for test_file in test_files:
            permission = FilePermission(
                file_id=test_file.id,
                user_id=user_id,
                role=FileRole.OWNER,
                granted_by=user_id,
            )
            session.add(permission)
        await session.commit()
        print(f"✅ [RESET-USER-DEBUG] Created OWNER permissions for {len(test_files)} files")

        # Create stable test tags
        print("🔍 [RESET-USER-DEBUG] Creating test tags...")
        test_tags = [
            Tag(name="Visual Testing", user_id=user_id, color="BLUE"),
            Tag(name="Regression", user_id=user_id, color="GREEN"),
        ]

        session.add_all(test_tags)
        print("🔍 [RESET-USER-DEBUG] Committing test tags...")
        await session.commit()
        print(f"✅ [RESET-USER-DEBUG] Created {len(test_tags)} test tags")

        print(f"✅ Test user {TEST_USER_EMAIL} reset successfully")
        print(f"   - User ID: {user_id}")
        print(f"   - Files created: {len(test_files)}")
        print(f"   - Tags created: {len(test_tags)}")
        
        # Final verification
        print("🔍 [RESET-USER-DEBUG] Final verification - querying user again...")
        verification_user = await session.execute(
            text("SELECT id, email, name FROM users WHERE email = :email"), {"email": TEST_USER_EMAIL}
        )
        verify_row = verification_user.first()
        if verify_row:
            print(f"✅ [RESET-USER-DEBUG] Verification successful - user exists: ID={verify_row.id}, email={verify_row.email}, name={verify_row.name}")
        else:
            print("❌ [RESET-USER-DEBUG] Verification FAILED - user not found after creation!")

    except Exception as e:
        print(f"❌ [RESET-USER-DEBUG] Exception occurred: {e}")
        print(f"❌ [RESET-USER-DEBUG] Exception type: {type(e).__name__}")
        print("❌ [RESET-USER-DEBUG] Rolling back transaction...")
        await session.rollback()
        print(f"❌ Error resetting test user: {e}")
        raise
    finally:
        print("🔍 [RESET-USER-DEBUG] Closing database session...")
        await session.close()
        print("🔍 [RESET-USER-DEBUG] Session closed")


if __name__ == "__main__":
    asyncio.run(reset_test_user())
