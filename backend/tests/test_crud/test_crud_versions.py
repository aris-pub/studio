"""Test CRUD operations for file versions.

Following TDD approach: Write tests first, implement to make them pass.
"""

from sqlalchemy import select

from aris.crud.versions import (
    create_version,
    delete_version,
    get_version,
    get_versions_for_file,
    rename_version,
)
from aris.models import FileVersion


async def test_create_version(db_session, test_user, test_file):
    """Test creating a named version of a file."""
    version = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Before review",
        db=db_session,
    )

    assert version.id is not None
    assert version.file_id == test_file.id
    assert version.version_number == 1
    assert version.version_name == "Before review"
    assert version.rsm_content == test_file.source
    assert version.title == test_file.title
    assert version.created_by == test_user.id


async def test_create_multiple_versions_sequential_numbers(db_session, test_user, test_file):
    """Test that version numbers increment sequentially."""
    v1 = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Version 1",
        db=db_session,
    )
    v2 = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Version 2",
        db=db_session,
    )
    v3 = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Version 3",
        db=db_session,
    )

    assert v1.version_number == 1
    assert v2.version_number == 2
    assert v3.version_number == 3


async def test_get_versions_for_file(db_session, test_user, test_file):
    """Test retrieving all versions for a file."""
    await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Draft",
        db=db_session,
    )
    await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Final",
        db=db_session,
    )

    versions = await get_versions_for_file(test_file.id, db=db_session)

    assert len(versions) == 2
    assert versions[0].version_name == "Final"  # Newest first
    assert versions[1].version_name == "Draft"


async def test_get_version_by_id(db_session, test_user, test_file):
    """Test retrieving a specific version by ID."""
    created = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Test Version",
        db=db_session,
    )

    fetched = await get_version(created.id, db=db_session)

    assert fetched.id == created.id
    assert fetched.version_name == "Test Version"


async def test_get_nonexistent_version_returns_none(db_session):
    """Test that getting a non-existent version returns None."""
    version = await get_version(99999, db=db_session)
    assert version is None


async def test_rename_version(db_session, test_user, test_file):
    """Test renaming a version."""
    version = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Old Name",
        db=db_session,
    )

    updated = await rename_version(
        version.id,
        new_name="New Name",
        db=db_session,
    )

    assert updated.id == version.id
    assert updated.version_name == "New Name"


async def test_delete_version_soft_delete(db_session, test_user, test_file):
    """Test soft deleting a version."""
    version = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="To Delete",
        db=db_session,
    )

    await delete_version(version.id, db=db_session)

    # Version should not be returned by normal queries
    fetched = await get_version(version.id, db=db_session)
    assert fetched is None

    # But should still exist in DB with deleted_at set
    result = await db_session.execute(
        select(FileVersion).where(FileVersion.id == version.id)
    )
    deleted_version = result.scalar_one_or_none()
    assert deleted_version is not None
    assert deleted_version.deleted_at is not None


async def test_version_cascade_delete_with_file(db_session, test_user, test_file):
    """Test that versions are cascade deleted when parent file is hard deleted."""
    # Create versions
    v1 = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="V1",
        db=db_session,
    )
    v2 = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="V2",
        db=db_session,
    )

    # Hard delete file (not soft delete)
    await db_session.delete(test_file)
    await db_session.commit()

    # Versions should be cascade deleted (ondelete='CASCADE' in foreign key)
    v1_check = await get_version(v1.id, db=db_session, include_deleted=True)
    v2_check = await get_version(v2.id, db=db_session, include_deleted=True)

    assert v1_check is None
    assert v2_check is None


async def test_version_captures_file_metadata(db_session, test_user, test_file):
    """Test that version captures file title and abstract at creation time."""
    # Update file metadata
    test_file.title = "Updated Title"
    test_file.abstract = "Updated Abstract"
    await db_session.commit()

    # Create version - should capture current state
    version = await create_version(
        file_id=test_file.id,
        user_id=test_user.id,
        version_name="Snapshot",
        db=db_session,
    )

    assert version.title == "Updated Title"
    assert version.abstract == "Updated Abstract"

    # Change file again
    test_file.title = "New Title"
    await db_session.commit()

    # Version should still have old title
    fetched = await get_version(version.id, db=db_session)
    assert fetched.title == "Updated Title"  # Not "New Title"
