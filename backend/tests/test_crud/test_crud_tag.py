from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import insert, select
from sqlalchemy.exc import SQLAlchemyError

from aris.crud.tag import (
    add_tag_to_file,
    create_tag,
    get_user_file_tags,
    get_user_tags,
    remove_tag_from_file,
    soft_delete_tag,
    update_tag,
)
from aris.models import File, FilePermission, Tag, file_tags
from aris.models.models import FileRole


async def test_create_tag_success(db_session, test_user):
    tag = await create_tag(test_user.id, "TestTag", "blue", db_session)
    assert tag.name == "TestTag"
    assert tag.color == "blue"
    assert tag.user_id == test_user.id


async def test_create_tag_user_not_found(db_session):
    with pytest.raises(ValueError, match="User not found"):
        await create_tag(9999, "Name", "color", db_session)


async def test_get_user_tags(db_session, test_user):
    await create_tag(test_user.id, "A", "red", db_session)
    await create_tag(test_user.id, "B", "green", db_session)

    tags = await get_user_tags(test_user.id, db_session)
    assert len(tags) == 2
    assert tags[0]["name"] == "A"
    assert tags[1]["name"] == "B"


async def test_update_tag(db_session, test_user):
    tag = Tag(name="Old", color="gray", user_id=test_user.id)
    db_session.add(tag)
    await db_session.commit()
    await db_session.refresh(tag)

    updated = await update_tag(tag.id, test_user.id, "New", "blue", db_session)
    assert updated.name == "New"
    assert updated.color == "blue"


async def test_soft_delete_tag(db_session, test_user):
    tag = Tag(name="Softie", color="orange", user_id=test_user.id)
    db_session.add(tag)
    await db_session.commit()
    await db_session.refresh(tag)

    resp = await soft_delete_tag(tag.id, test_user.id, db_session)
    assert resp == {"message": "Tag deleted successfully"}

    result = await db_session.execute(select(Tag).where(Tag.id == tag.id))
    deleted = result.scalar_one()
    assert deleted.deleted_at is not None


async def test_add_and_remove_tag_from_file(db_session, test_user):
    file = File(owner_id=test_user.id)
    tag = Tag(name="linked", color="purple", user_id=test_user.id)
    db_session.add_all([file, tag])
    await db_session.commit()

    await add_tag_to_file(test_user.id, file.id, tag.id, db_session)

    link_result = await db_session.execute(
        select(file_tags).where(file_tags.c.file_id == file.id, file_tags.c.tag_id == tag.id)
    )
    assert link_result.first()

    await remove_tag_from_file(test_user.id, file.id, tag.id, db_session)

    post = await db_session.execute(
        select(file_tags).where(file_tags.c.file_id == file.id, file_tags.c.tag_id == tag.id)
    )
    assert post.first() is None


async def test_get_user_file_tags(db_session, test_user):
    file = File(owner_id=test_user.id)
    tag1 = Tag(name="T1", color="red", user_id=test_user.id)
    tag2 = Tag(name="T2", color="green", user_id=test_user.id)
    db_session.add_all([file, tag1, tag2])
    await db_session.commit()
    await db_session.refresh(file)

    # Create OWNER permission for the file
    permission = FilePermission(
        file_id=file.id,
        user_id=test_user.id,
        role=FileRole.OWNER,
        granted_by=test_user.id,
    )
    db_session.add(permission)
    await db_session.commit()

    await add_tag_to_file(test_user.id, file.id, tag1.id, db_session)
    await add_tag_to_file(test_user.id, file.id, tag2.id, db_session)

    tags = await get_user_file_tags(test_user.id, file.id, db_session)
    tag_names = {t.name for t in tags}
    assert tag_names == {"T1", "T2"}




async def test_create_tag_without_name_raises(db_session, test_user):
    with pytest.raises(ValueError, match="Name not provided"):
        await create_tag(test_user.id, "", "red", db_session)


async def test_create_tag_with_no_color_assigns_next_color(db_session, test_user):
    tag = await create_tag(test_user.id, "AutoColorTag", None, db_session)
    assert tag.color in ("red", "purple", "green", "orange")


async def test_create_tag_commit_failure_rolls_back(db_session, test_user):
    # Patch db.commit to raise SQLAlchemyError to test rollback and None return
    with patch.object(db_session, "commit", new_callable=AsyncMock) as mock_commit:
        mock_commit.side_effect = SQLAlchemyError()
        tag = await create_tag(test_user.id, "failtag", "red", db_session)
        assert tag is None


async def test_update_tag_not_found_raises(db_session, test_user):
    with pytest.raises(ValueError, match="Tag not found"):
        await update_tag(999999, test_user.id, "NewName", "blue", db_session)


async def test_update_tag_with_partial_update(db_session, test_user):
    tag = Tag(name="Partial", color="gray", user_id=test_user.id)
    db_session.add(tag)
    await db_session.commit()
    await db_session.refresh(tag)

    # Only update name
    updated = await update_tag(tag.id, test_user.id, "UpdatedName", None, db_session)
    assert updated.name == "UpdatedName"
    assert updated.color == "gray"

    # Only update color
    updated = await update_tag(tag.id, test_user.id, None, "blue", db_session)
    assert updated.name == "UpdatedName"
    assert updated.color == "blue"


async def test_soft_delete_tag_not_found_raises(db_session, test_user):
    with pytest.raises(ValueError, match="Tag not found"):
        await soft_delete_tag(999999, test_user.id, db_session)


async def test_get_user_file_tags_file_not_found_raises(db_session, test_user):
    with pytest.raises(ValueError, match="File with id 9999 not found or user .* has no permission"):
        await get_user_file_tags(test_user.id, 9999, db_session)


async def test_add_tag_to_file_errors(db_session, test_user):
    # file not found
    with pytest.raises(ValueError, match="Unauthorized or file not found"):
        await add_tag_to_file(test_user.id, 99999, 1, db_session)

    # prepare file but tag not found
    file = File(owner_id=test_user.id)
    db_session.add(file)
    await db_session.commit()
    await db_session.refresh(file)

    with pytest.raises(ValueError, match="Unauthorized or tag not found"):
        await add_tag_to_file(test_user.id, file.id, 99999, db_session)


async def test_add_tag_to_file_already_assigned(db_session, test_user):
    file = File(owner_id=test_user.id)
    tag = Tag(name="dup", color="red", user_id=test_user.id)
    db_session.add_all([file, tag])
    await db_session.commit()
    await db_session.refresh(file)
    await db_session.refresh(tag)

    # Manually insert file_tag link
    await db_session.execute(insert(file_tags).values(file_id=file.id, tag_id=tag.id))
    await db_session.commit()

    with pytest.raises(ValueError, match="Tag already assigned"):
        await add_tag_to_file(test_user.id, file.id, tag.id, db_session)


async def test_remove_tag_from_file_errors(db_session, test_user):
    # file not found
    with pytest.raises(ValueError, match="Unauthorized or file not found"):
        await remove_tag_from_file(test_user.id, 99999, 1, db_session)

    # prepare file but tag not found
    file = File(owner_id=test_user.id)
    db_session.add(file)
    await db_session.commit()
    await db_session.refresh(file)

    with pytest.raises(ValueError, match="Unauthorized or tag not found"):
        await remove_tag_from_file(test_user.id, file.id, 99999, db_session)


async def test_remove_tag_from_file_tag_not_assigned(db_session, test_user):
    file = File(owner_id=test_user.id)
    tag = Tag(name="notassigned", color="blue", user_id=test_user.id)
    db_session.add_all([file, tag])
    await db_session.commit()
    await db_session.refresh(file)
    await db_session.refresh(tag)

    with pytest.raises(ValueError, match="Tag not assigned to this file"):
        await remove_tag_from_file(test_user.id, file.id, tag.id, db_session)
