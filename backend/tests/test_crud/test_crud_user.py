"""Tests for user CRUD operations."""

from datetime import datetime
from unittest.mock import patch

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from aris.crud.user import (
    create_user,
    get_user,
    get_user_file,
    get_user_files,
    soft_delete_user,
    update_user,
)
from aris.models import FileSettings


async def test_get_user_returns_correct_user(db_session, test_user):
    fetched = await get_user(test_user.id, db_session)
    assert fetched.id == test_user.id
    assert fetched.email == test_user.email


async def test_create_user_sets_defaults(db_session):
    user = await create_user("Alice Example", "", "alice@example.com", "hashed", db_session)
    assert user.initials == "AE"
    assert user.email == "alice@example.com"

    query = select(func.count()).where(
        FileSettings.user_id == user.id, FileSettings.file_id.is_(None)
    )
    result = await db_session.execute(query)
    count = result.scalar_one()
    assert count == 1


async def test_update_user_fields(db_session, test_user):
    updated = await update_user(test_user.id, "New Name", "NN", "new@example.com", db_session)
    assert updated.name == "New Name"
    assert updated.initials == "NN"
    assert updated.email == "new@example.com"


async def test_soft_delete_user_sets_deleted_at(db_session, test_user):
    deleted = await soft_delete_user(test_user.id, db_session)
    assert isinstance(deleted.deleted_at, datetime)


async def test_get_user_files_returns_sorted_file_list(db_session, test_user):
    from aris.crud.file import create_file

    await create_file("a", test_user.id, "Z", db=db_session)
    await create_file("b", test_user.id, "A", db=db_session)

    with patch("aris.crud.user.extract_title", side_effect=lambda f: f.title):
        result = await get_user_files(test_user.id, with_tags=False, db=db_session)

    assert [f["title"] for f in result] == ["A", "Z"]  # last_edited_at same, so source is used


async def test_get_user_file_full_bundle(db_session, test_user):
    from aris.crud.file import create_file

    file = await create_file("source content", test_user.id, "Doc", db=db_session)

    with (
        patch("aris.crud.user.extract_title", return_value="Mocked Title"),
        patch("aris.crud.user.get_user_file_tags", return_value=["physics", "ML"]),
        patch("aris.crud.user.get_file_section", return_value="Mocked Minimap"),
    ):
        result = await get_user_file(
            user_id=test_user.id,
            file_id=file.id,
            with_tags=True,
            with_minimap=True,
            db=db_session,
        )

    assert result["title"] == "Mocked Title"
    assert result["tags"] == ["physics", "ML"]
    assert result["minimap"] == "Mocked Minimap"



async def test_get_user_returns_none_for_missing_user(db_session):
    user = await get_user(999999, db_session)
    assert user is None


async def test_update_user_returns_none_for_missing_user(db_session):
    updated = await update_user(999999, "Name", "NN", "email@example.com", db_session)
    assert updated is None


async def test_soft_delete_user_returns_none_for_missing_user(db_session):
    deleted = await soft_delete_user(999999, db_session)
    assert deleted is None


async def test_create_user_initials_from_name_with_spaces(db_session):
    user = await create_user("  Bob   Marley  ", "", "bob@example.com", "hash", db_session)
    assert user.initials == "BM"


async def test_create_user_initials_explicit(db_session):
    user = await create_user("Charlie Brown", "CB", "charlie@example.com", "hash", db_session)
    assert user.initials == "CB"


async def test_get_user_files_raises_for_missing_user(db_session):
    with pytest.raises(ValueError) as excinfo:
        await get_user_files(999999, with_tags=False, db=db_session)
    assert "User 999999 not found" in str(excinfo.value)


async def test_get_user_file_raises_for_missing_user(db_session, test_file):
    with pytest.raises(ValueError) as excinfo:
        await get_user_file(
            999999, test_file.id, with_tags=False, with_minimap=False, db=db_session
        )
    assert "User 999999 not found" in str(excinfo.value)


async def test_get_user_file_raises_for_missing_file(db_session, test_user):
    with pytest.raises(ValueError) as excinfo:
        await get_user_file(
            test_user.id, 999999, with_tags=False, with_minimap=False, db=db_session
        )
    assert "File 999999 not found" in str(excinfo.value)


async def test_update_user_no_changes(db_session, test_user):
    # Update with same values should still return user unchanged
    updated = await update_user(
        test_user.id, test_user.name, test_user.initials, test_user.email, db_session
    )
    assert updated.id == test_user.id
    assert updated.name == test_user.name


async def test_soft_delete_user_sets_deleted_at_value(db_session, test_user):
    deleted = await soft_delete_user(test_user.id, db_session)
    assert deleted.deleted_at is not None
    assert isinstance(deleted.deleted_at, datetime)


async def test_get_user_files_includes_abstract_and_keywords(db_session, test_user):
    from unittest.mock import patch

    from aris.crud.file import create_file

    file = await create_file(
        "source", test_user.id, "Title", abstract="My abstract", db=db_session
    )
    file.keywords = "quantum, physics"
    await db_session.flush()

    with patch("aris.crud.user.extract_title", return_value="Title"):
        files = await get_user_files(test_user.id, with_tags=False, db=db_session)

    assert files[0]["abstract"] == "My abstract"
    assert files[0]["keywords"] == "quantum, physics"


async def test_get_user_files_with_tags_returns_tags(db_session, test_user):
    from unittest.mock import patch

    from aris.crud.file import create_file

    _file = await create_file("source", test_user.id, "Title", db=db_session)

    with (
        patch("aris.crud.user.extract_title", return_value="Mock Title"),
        patch("aris.crud.user.get_user_file_tags", return_value=["tag1", "tag2"]),
    ):
        files = await get_user_files(test_user.id, with_tags=True, db=db_session)

    assert files[0]["tags"] == ["tag1", "tag2"]


async def test_get_user_files_without_tags_returns_empty_list(db_session, test_user):
    from unittest.mock import patch

    from aris.crud.file import create_file

    _file = await create_file("source", test_user.id, "Title", db=db_session)

    with patch("aris.crud.user.extract_title", return_value="Mock Title"):
        files = await get_user_files(test_user.id, with_tags=False, db=db_session)

    assert files[0]["tags"] == []


async def test_create_user_with_empty_name_sets_initials_empty(db_session):
    user = await create_user("", "", "emptyname@example.com", "hash", db_session)
    # initials will be empty string as no words in name
    assert user.initials == ""


async def test_create_user_duplicate_email_raises(db_session, test_user):
    with pytest.raises(IntegrityError):
        # Assuming email unique constraint in DB
        await create_user("Another Name", "AN", test_user.email, "hash", db_session)




async def test_create_user_sets_email_verification_defaults(db_session):
    """Test that new users have correct email verification defaults."""
    user = await create_user("Test User", "TU", "test@example.com", "hashed", db_session)
    assert user.email_verified is False
    assert user.email_verification_token is None
    assert user.email_verification_sent_at is None
