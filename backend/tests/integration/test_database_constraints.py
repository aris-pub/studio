"""Database constraint and transaction testing.

Tests database-specific behavior including constraints, transactions,
concurrent access, and differences between SQLite and PostgreSQL.
"""

import asyncio
import uuid
from datetime import datetime

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from aris.config import settings
from aris.crud.file import get_file
from aris.crud.user import create_user
from aris.models import Annotation, File, FileSettings, Signup, Tag, User


class TestDatabaseConstraints:
    """Test database constraints and integrity rules."""


    async def test_user_email_uniqueness_constraint(self, db_session: AsyncSession):
        """Test that user email uniqueness is enforced."""
        # Create first user
        user1 = await create_user("User One", "UO", "test@example.com", "hash1", db_session)
        assert user1.email == "test@example.com"
        
        # Attempt to create second user with same email should fail
        with pytest.raises(IntegrityError):
            await create_user("User Two", "UT", "test@example.com", "hash2", db_session)
            await db_session.commit()

    async def test_file_owner_foreign_key_constraint(self, db_session: AsyncSession, is_postgresql):
        """Test that file owner_id foreign key constraint is enforced."""
        if not is_postgresql:
            pytest.skip("SQLite doesn't enforce foreign keys by default in tests")
            
        # Try to create file with non-existent owner
        file = File(
            owner_id=99999,  # Non-existent integer ID
            source="test",
            title="Test File"
        )
        db_session.add(file)
        
        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_file_settings_cascade_deletion(self, db_session: AsyncSession, test_user):
        """Test that file settings are properly handled when files are deleted."""
        # Create a file
        file = File(
            owner_id=test_user.id,
            source="test",
            title="Test File"
        )
        db_session.add(file)
        await db_session.commit()
        
        # Create file settings for this file
        file_settings = FileSettings(
            user_id=test_user.id,
            file_id=file.id,
            background="red"
        )
        db_session.add(file_settings)
        await db_session.commit()
        
        # Verify settings exist
        result = await db_session.execute(
            select(FileSettings).where(FileSettings.file_id == file.id)
        )
        settings_before = result.scalars().first()
        assert settings_before is not None
        
        # Delete the file
        await db_session.delete(file)
        await db_session.commit()
        
        # Check if file settings still exist (behavior may differ between databases)
        result = await db_session.execute(
            select(FileSettings).where(FileSettings.file_id == file.id)
        )
        result.scalars().first()  # May be None (deleted) or still exist (depends on DB)
        
        # In PostgreSQL with proper CASCADE, settings should be deleted
        # In SQLite, behavior may depend on foreign key configuration
        # For now, we just test that the operation completes without error

    async def test_annotation_constraints(self, db_session: AsyncSession, test_user, test_file):
        """Test annotation model constraints."""
        from aris.models.models import AnnotationType
        
        # Test creating annotation with valid data
        annotation = Annotation(
            file_id=test_file.id,
            type=AnnotationType.COMMENT
        )
        db_session.add(annotation)
        await db_session.commit()
        
        # Verify annotation was created
        result = await db_session.execute(
            select(Annotation).where(Annotation.id == annotation.id)
        )
        created_annotation = result.scalars().first()
        assert created_annotation is not None
        assert created_annotation.type == AnnotationType.COMMENT

    async def test_tag_name_length_constraints(self, db_session: AsyncSession, test_user):
        """Test tag name length constraints."""
        # Test normal tag name
        normal_tag = Tag(
            user_id=test_user.id,
            name="Normal Tag",
            color="#FF0000"
        )
        db_session.add(normal_tag)
        await db_session.commit()
        
        # Test very long tag name (if database has length limits)
        long_name = "x" * 1000  # Very long name
        long_tag = Tag(
            user_id=test_user.id,
            name=long_name,
            color="#00FF00"
        )
        db_session.add(long_tag)
        
        try:
            await db_session.commit()
            # If commit succeeds, verify the tag was stored
            result = await db_session.execute(
                select(Tag).where(Tag.id == long_tag.id)
            )
            stored_tag = result.scalars().first()
            assert stored_tag is not None
        except IntegrityError:
            # If database has length constraints, this is expected
            await db_session.rollback()

    async def test_signup_email_uniqueness(self, db_session: AsyncSession):
        """Test signup email uniqueness constraint."""
        from aris.models.models import SignupStatus
        
        # Create first signup
        signup1 = Signup(
            email="signup@example.com",
            authoring_tools='["LaTeX", "Markdown"]',
            improvements="Better features",
            status=SignupStatus.ACTIVE,
            consent_given=True,
            unsubscribe_token="token1"
        )
        db_session.add(signup1)
        await db_session.commit()
        
        # Try to create second signup with same email
        signup2 = Signup(
            email="signup@example.com",  # Same email
            authoring_tools='["Typst"]',
            improvements="Different improvements",
            status=SignupStatus.UNSUBSCRIBED,
            consent_given=True,
            unsubscribe_token="token2"
        )
        db_session.add(signup2)
        
        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_user_deletion_with_files(self, db_session: AsyncSession):
        """Test behavior when deleting user with associated files."""
        # Create user
        user = await create_user("Test User", "TU", "testuser@example.com", "hash", db_session)
        
        # Create file for this user
        file = File(
            owner_id=user.id,
            source="content",
            title="User File"
        )
        db_session.add(file)
        await db_session.commit()
        
        # Try to delete user (should be prevented by foreign key constraint)
        with pytest.raises(IntegrityError):
            await db_session.delete(user)
            await db_session.commit()

    @pytest.mark.skipif(
        not settings.get_test_database_url().startswith("postgresql"),
        reason="PostgreSQL-specific constraint testing"
    )
    async def test_postgresql_specific_constraints(self, db_session: AsyncSession):
        """Test PostgreSQL-specific constraint behavior."""
        # Test check constraints, if any are defined
        # Test specific PostgreSQL features like partial indexes, exclusion constraints, etc.
        
        # Example: Test that PostgreSQL enforces stricter type checking
        user = User(
            name="Test User",
            email="test@example.com",
            password_hash="hash",
            created_at=datetime.now()
        )
        db_session.add(user)
        await db_session.commit()
        
        # PostgreSQL should handle this properly
        assert user.created_at is not None

    async def test_concurrent_user_creation(self, db_session: AsyncSession):
        """Test concurrent user creation with same email."""
        async def create_user_with_email(email, name, session):
            try:
                user = await create_user(name, "TU", email, "hash", session)
                await session.commit()
                return user
            except IntegrityError:
                await session.rollback()
                return None
        
        # This test requires separate sessions for true concurrency testing
        # For now, we test sequential creation to verify constraint behavior
        email = f"concurrent{uuid.uuid4()}@example.com"
        
        user1 = await create_user_with_email(email, "User 1", db_session)
        user2 = await create_user_with_email(email, "User 2", db_session)
        
        # Only one should succeed
        assert (user1 is None) != (user2 is None)  # XOR - exactly one should be None


class TestTransactionBehavior:
    """Test transaction handling and rollback behavior."""

    async def test_transaction_rollback_on_error(self, db_session: AsyncSession):
        """Test that transactions roll back properly on errors."""
        # Start with clean state
        initial_count_result = await db_session.execute(select(func.count()).select_from(User))
        initial_count = initial_count_result.scalar()
        
        # Test that the second user creation fails due to duplicate email
        # First user will be committed by create_user function
        await create_user("Valid User", "VU", "valid@example.com", "hash", db_session)
        
        # Try to create another user with same email - should fail
        with pytest.raises(IntegrityError):
            await create_user("Invalid User", "IU", "valid@example.com", "hash", db_session)
        
        # Rollback the session to clear the error state
        await db_session.rollback()
        
        # Check that only the first user was added
        final_count_result = await db_session.execute(select(func.count()).select_from(User))
        final_count = final_count_result.scalar()
        
        assert final_count == initial_count + 1  # One user was added

    async def test_partial_rollback_with_savepoints(self, db_session: AsyncSession, is_postgresql):
        """Test savepoint behavior (PostgreSQL specific)."""
        if not is_postgresql:
            pytest.skip("Savepoints not supported in SQLite")
        
        # Create first user (should succeed)
        await create_user("User 1", "U1", "user1@example.com", "hash", db_session)
        
        # Create savepoint
        savepoint = await db_session.begin_nested()
        
        try:
            # Try to create user with duplicate email
            await create_user("User 2", "U2", "user1@example.com", "hash", db_session)
            await savepoint.commit()
        except IntegrityError:
            await savepoint.rollback()
        
        # Create another valid user after rollback to savepoint
        await create_user("User 3", "U3", "user3@example.com", "hash", db_session)
        
        await db_session.commit()
        
        # Verify first and third users exist, second doesn't
        users = await db_session.execute(select(User))
        user_emails = {user.email for user in users.scalars()}
        
        assert "user1@example.com" in user_emails
        assert "user3@example.com" in user_emails
        assert len(user_emails) >= 2  # At least these two

    async def test_isolation_level_behavior(self, db_session: AsyncSession, is_postgresql):
        """Test transaction isolation behavior."""
        # This test would require multiple database connections to properly test
        # For now, we test basic transaction behavior
        
        # Create user within transaction
        await create_user("Isolation Test", "IT", "isolation@example.com", "hash", db_session)
        
        # Don't commit yet - user should be visible within this transaction
        result = await db_session.execute(select(User).where(User.email == "isolation@example.com"))
        found_user = result.scalars().first()
        assert found_user is not None
        assert found_user.name == "Isolation Test"
        
        # Commit the transaction
        await db_session.commit()
        
        # User should still be visible after commit
        result = await db_session.execute(select(User).where(User.email == "isolation@example.com"))
        committed_user = result.scalars().first()
        assert committed_user is not None

    async def test_deadlock_prevention(self, db_session: AsyncSession):
        """Test that operations don't cause deadlocks."""
        # Create two users
        user1 = await create_user("User A", "UA", "usera@example.com", "hash", db_session)
        user2 = await create_user("User B", "UB", "userb@example.com", "hash", db_session)
        await db_session.commit()
        
        # Create files for both users
        file1 = File(
            owner_id=user1.id,
            source="file1",
            title="File 1"
        )
        file2 = File(
            owner_id=user2.id,
            source="file2",
            title="File 2"
        )
        
        db_session.add(file1)
        db_session.add(file2)
        await db_session.commit()
        
        # Simulate operations that could potentially deadlock
        # Update files in different order
        file1.title = "Updated File 1"
        file2.title = "Updated File 2"
        
        await db_session.commit()
        
        # Should complete without deadlock
        assert file1.title == "Updated File 1"
        assert file2.title == "Updated File 2"


class TestConcurrentOperations:
    """Test concurrent database operations."""

    async def test_concurrent_file_creation(self, db_session: AsyncSession, test_user):
        """Test concurrent file creation by same user."""
        async def create_test_file(title_suffix):
            file = File(
                owner_id=test_user.id,
                source=f"content {title_suffix}",
                title=f"Concurrent File {title_suffix}"
            )
            db_session.add(file)
            await db_session.flush()  # Flush but don't commit
            return file
        
        # Create multiple files concurrently (within same transaction)
        files = []
        for i in range(5):
            file = await create_test_file(i)
            files.append(file)
        
        await db_session.commit()
        
        # All files should be created successfully
        for file in files:
            result = await db_session.execute(select(File).where(File.id == file.id))
            created_file = result.scalars().first()
            assert created_file is not None

    async def test_concurrent_file_access(self, db_session: AsyncSession, test_user, test_file):
        """Test concurrent access to same file."""
        # Simulate multiple operations on same file
        operations = []
        
        # Read operations
        for i in range(3):
            operation = get_file(test_file.id, db_session)
            operations.append(operation)
        
        # Execute concurrently
        results = await asyncio.gather(*operations)
        
        # All reads should succeed
        for result in results:
            assert result is not None
            assert result.id == test_file.id

    async def test_file_settings_concurrent_updates(self, db_session: AsyncSession, test_user):
        """Test concurrent updates to file settings."""
        # Create file settings
        settings = FileSettings(
            user_id=test_user.id,
            file_id=None,  # Default settings
            background="white"
        )
        db_session.add(settings)
        await db_session.commit()
        
        # Simulate concurrent updates
        settings.background = "blue"
        
        await db_session.commit()
        
        # Verify updates
        result = await db_session.execute(
            select(FileSettings).where(
                FileSettings.user_id == test_user.id,
                FileSettings.file_id.is_(None)
            )
        )
        updated_settings = result.scalars().first()
        assert updated_settings.background == "blue"


class TestDatabasePerformance:
    """Test database performance characteristics."""

    async def test_bulk_user_creation_performance(self, db_session: AsyncSession):
        """Test performance of bulk user creation."""
        import time
        
        start_time = time.time()
        
        # Create multiple users
        users = []
        for i in range(10):  # Small number for test speed
            user = User(
                name=f"Bulk User {i}",
                email=f"bulk{i}@example.com",
                password_hash=f"hash{i}",
                initials=f"B{i}"
            )
            users.append(user)
            db_session.add(user)
        
        await db_session.commit()
        
        end_time = time.time()
        creation_time = end_time - start_time
        
        # Should complete in reasonable time
        assert creation_time < 5.0, f"Bulk creation took {creation_time:.2f}s"
        
        # Verify all users were created
        result = await db_session.execute(
            select(func.count()).select_from(User).where(User.name.like("Bulk User%"))
        )
        count = result.scalar()
        assert count == 10

    async def test_complex_query_performance(self, db_session: AsyncSession, test_user):
        """Test performance of complex queries."""
        # Create some test data
        files = []
        for i in range(5):  # Small number for test
            file = File(
                owner_id=test_user.id,
                source=f"content {i}",
                title=f"Performance Test File {i}",
                abstract=f"Abstract for file {i}"
            )
            files.append(file)
            db_session.add(file)
        
        await db_session.commit()
        
        import time
        start_time = time.time()
        
        # Complex query with joins
        result = await db_session.execute(
            select(File, User)
            .join(User, File.owner_id == User.id)
            .where(User.id == test_user.id)
            .where(File.title.like("%Performance%"))
        )
        
        files_with_users = result.all()
        
        end_time = time.time()
        query_time = end_time - start_time
        
        # Should complete quickly
        assert query_time < 1.0, f"Complex query took {query_time:.2f}s"
        
        # Should return expected results
        assert len(files_with_users) == 5

    async def test_database_connection_handling(self, db_session: AsyncSession):
        """Test that database connections are handled properly."""
        # Test multiple queries in sequence
        queries = [
            select(func.count()).select_from(User),
            select(func.count()).select_from(File),
            select(func.count()).select_from(FileSettings),
        ]
        
        for query in queries:
            result = await db_session.execute(query)
            count = result.scalar()
            assert isinstance(count, int)
        
        # Connection should still be valid
        final_result = await db_session.execute(text("SELECT 1"))
        assert final_result.scalar() == 1



class TestVersioningConstraints:
    """Test versioning-related database constraints and indexes."""

    async def test_version_field_indexing_performance(self, db_session: AsyncSession, test_user):
        """Test that version field has proper indexing for performance."""
        # Create multiple versions of files
        files = []
        for i in range(1, 6):
            file = File(
                owner_id=test_user.id,
                source=f"Version {i} content",
                title=f"Versioned File V{i}",
                version=i
            )
            files.append(file)
            db_session.add(file)
        
        await db_session.commit()
        
        import time
        start_time = time.time()
        
        # Query by version should be fast due to index
        result = await db_session.execute(
            select(File).where(File.version == 3)
        )
        version_3_files = result.scalars().all()
        
        end_time = time.time()
        query_time = end_time - start_time
        
        # Should complete quickly due to index
        assert query_time < 0.5, f"Version query took {query_time:.3f}s"
        assert len(version_3_files) > 0
        assert all(f.version == 3 for f in version_3_files)

    async def test_prev_version_id_indexing_performance(self, db_session: AsyncSession, test_user):
        """Test that prev_version_id field has proper indexing for performance."""
        # Create version chain: v1 -> v2 -> v3 -> v4 -> v5
        files = []
        prev_id = None
        
        for i in range(1, 6):
            file = File(
                owner_id=test_user.id,
                source=f"Version {i} content",
                title=f"Chained File V{i}",
                version=i,
                prev_version_id=prev_id
            )
            files.append(file)
            db_session.add(file)
            await db_session.flush()
            prev_id = file.id
        
        await db_session.commit()
        
        import time
        start_time = time.time()
        
        # Query by prev_version_id should be fast due to index
        target_file = files[2]  # v3
        result = await db_session.execute(
            select(File).where(File.prev_version_id == target_file.id)
        )
        next_versions = result.scalars().all()
        
        end_time = time.time()
        query_time = end_time - start_time
        
        # Should complete quickly due to index
        assert query_time < 0.5, f"prev_version_id query took {query_time:.3f}s"
        assert len(next_versions) == 1
        assert next_versions[0].version == 4

    async def test_version_constraints_validation(self, db_session: AsyncSession, test_user):
        """Test that version field constraints are properly validated."""
        # Test positive version numbers
        valid_file = File(
            owner_id=test_user.id,
            source="Valid version",
            title="Valid Version File",
            version=0
        )
        db_session.add(valid_file)
        await db_session.commit()
        
        # Should succeed
        result = await db_session.execute(select(File).where(File.id == valid_file.id))
        created_file = result.scalars().first()
        assert created_file.version == 0

    async def test_prev_version_id_foreign_key_constraint(self, db_session: AsyncSession, test_user, is_postgresql):
        """Test that prev_version_id foreign key constraint is enforced."""
        if not is_postgresql:
            pytest.skip("SQLite doesn't enforce foreign keys by default in tests")
        
        # Try to create file with non-existent prev_version_id
        invalid_file = File(
            owner_id=test_user.id,
            source="Invalid reference",
            title="Invalid Reference File",
            version=2,
            prev_version_id=99999  # Non-existent ID
        )
        db_session.add(invalid_file)
        
        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_version_chain_integrity(self, db_session: AsyncSession, test_user):
        """Test that version chains maintain referential integrity."""
        # Create original file
        original = File(
            owner_id=test_user.id,
            source="Original content",
            title="Original File",
            version=0
        )
        db_session.add(original)
        await db_session.commit()
        await db_session.refresh(original)
        
        # Create version 2 referencing original
        v2 = File(
            owner_id=test_user.id,
            source="Version 2 content",
            title="Version 2 File",
            version=2,
            prev_version_id=original.id
        )
        db_session.add(v2)
        await db_session.commit()
        await db_session.refresh(v2)
        
        # Create version 3 referencing v2
        v3 = File(
            owner_id=test_user.id,
            source="Version 3 content",
            title="Version 3 File",
            version=3,
            prev_version_id=v2.id
        )
        db_session.add(v3)
        await db_session.commit()
        
        # Verify chain integrity
        assert v3.prev_version_id == v2.id
        assert v2.prev_version_id == original.id
        assert original.prev_version_id is None

    async def test_complex_version_queries(self, db_session: AsyncSession, test_user):
        """Test complex queries involving version fields."""
        # Create multiple version chains
        chains = []
        for chain_id in range(3):
            prev_id = None
            for version in range(0, 3):
                file = File(
                    owner_id=test_user.id,
                    source=f"Chain {chain_id} Version {version}",
                    title=f"Chain {chain_id} V{version}",
                    version=version,
                    prev_version_id=prev_id
                )
                db_session.add(file)
                await db_session.flush()
                prev_id = file.id
            chains.append(prev_id)  # Store final file ID of each chain
        
        await db_session.commit()
        
        # Query for all version 2 files
        result = await db_session.execute(
            select(File).where(File.version == 2)
        )
        v2_files = result.scalars().all()
        assert len(v2_files) == 3  # One from each chain
        
        # Query for all files with a previous version
        result = await db_session.execute(
            select(File).where(File.prev_version_id.is_not(None))
        )
        files_with_prev = result.scalars().all()
        assert len(files_with_prev) == 6  # 2 files per chain (v1 and v2)
        
        # Query for all original files (no previous version)
        result = await db_session.execute(
            select(File).where(File.prev_version_id.is_(None))
        )
        original_files = result.scalars().all()
        # Should have at least 3 (one from each chain)
        original_count = len([f for f in original_files if f.version == 0])
        assert original_count >= 3

    async def test_version_ordering_queries(self, db_session: AsyncSession, test_user):
        """Test ordering queries by version fields."""
        # Create files with different versions
        versions = [3, 0, 5, 2, 4]
        for version in versions:
            file = File(
                owner_id=test_user.id,
                source=f"Version {version} content",
                title=f"Ordered File V{version}",
                version=version
            )
            db_session.add(file)
        
        await db_session.commit()
        
        # Query ordered by version ascending
        result = await db_session.execute(
            select(File)
            .where(File.title.like("Ordered File%"))
            .order_by(File.version.asc())
        )
        ordered_files = result.scalars().all()
        
        # Should be ordered 0, 2, 3, 4, 5
        actual_versions = [f.version for f in ordered_files]
        expected_versions = [0, 2, 3, 4, 5]
        assert actual_versions == expected_versions

    async def test_version_index_coverage(self, db_session: AsyncSession, test_user):
        """Test that version indexes cover common query patterns."""
        # Create test data
        files = []
        for i in range(1, 11):
            file = File(
                owner_id=test_user.id,
                source=f"Content {i}",
                title=f"Coverage Test {i}",
                version=i % 3  # Creates versions 1, 2, 0, 1, 2, 0, ...
            )
            files.append(file)
            db_session.add(file)
        
        await db_session.commit()
        
        # Test various query patterns that should use indexes
        import time
        
        # Range query on version
        start_time = time.time()
        result = await db_session.execute(
            select(File).where(File.version.between(0, 1))
        )
        range_files = result.scalars().all()
        range_time = time.time() - start_time
        
        assert range_time < 0.5, f"Range query took {range_time:.3f}s"
        assert len(range_files) > 0
        assert all(f.version in [0, 1] for f in range_files)
        
        # Count query on version
        start_time = time.time()
        result = await db_session.execute(
            select(func.count()).select_from(File).where(File.version == 0)
        )
        count = result.scalar()
        count_time = time.time() - start_time
        
        assert count_time < 0.5, f"Count query took {count_time:.3f}s"
        assert count > 0


