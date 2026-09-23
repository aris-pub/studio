"""Test CRUD operations for files."""

from unittest.mock import AsyncMock, patch

from aris.crud.file import (
    create_file,
    duplicate_file,
    get_file,
    get_file_html,
    get_file_section,
    get_files,
    soft_delete_file,
    update_file,
)


@patch("aris.crud.file.extract_title", new_callable=AsyncMock)
async def test_create_and_get_file(mock_extract_title, db_session, test_user):
    mock_extract_title.return_value = "Mocked Title"
    file = await create_file("source", owner_id=test_user.id, title="Test Title", db=db_session)
    assert file.id
    fetched = await get_file(file.id, db_session)
    assert fetched.title == "Mocked Title"


@patch("aris.crud.file.extract_title", new_callable=AsyncMock)
async def test_get_files(mock_extract_title, db_session, test_user):
    mock_extract_title.side_effect = lambda file: file.title
    await create_file("source 1", owner_id=test_user.id, title="F1", db=db_session)
    await create_file("source 2", owner_id=test_user.id, title="F2", db=db_session)
    files = await get_files(db_session)
    titles = [f.title for f in files]
    assert "F1" in titles and "F2" in titles


async def test_update_file(db_session, test_user):
    file = await create_file("old source", owner_id=test_user.id, title="Old", db=db_session)
    old_timestamp = file.last_edited_at
    updated = await update_file(file.id, "New", "new source", db_session)
    assert updated.title == "New"
    assert updated.source == "new source"
    assert updated.created_at == file.created_at
    assert updated.last_edited_at > old_timestamp


async def test_soft_delete_file(db_session, test_user):
    file = await create_file("source", owner_id=test_user.id, title="DeleteMe", db=db_session)
    msg = await soft_delete_file(file.id, db_session)
    assert "soft deleted" in msg["message"]
    assert await get_file(file.id, db_session) is None


@patch("aris.crud.file.extract_title", new_callable=AsyncMock)
async def test_duplicate_file(mock_extract_title, db_session, test_user):
    mock_extract_title.return_value = "Original"
    file = await create_file("content", owner_id=test_user.id, title="Original", db=db_session)
    duplicate = await duplicate_file(file.id, owner_id=test_user.id, db=db_session)
    assert duplicate.id != file.id
    assert duplicate.title == "Original (copy)"
    assert duplicate.owner_id == test_user.id


@patch("aris.crud.file.rsm.render", return_value="<div>HTML</div>")
async def test_get_file_html(mock_render, db_session, test_user):
    file = await create_file("<p>HTML</p>", owner_id=test_user.id, db=db_session)
    html = await get_file_html(file.id, db_session)
    assert "<div>HTML</div>" in html
    mock_render.assert_called_once()


@patch("aris.crud.file.extract_section", new_callable=AsyncMock)
async def test_get_file_section(mock_extract_section, db_session, test_user):
    mock_extract_section.return_value = "<section>Intro</section>"
    file = await create_file("# Intro", owner_id=test_user.id, db=db_session)
    section = await get_file_section(file.id, "Intro", db_session)
    assert "<section>Intro</section>" in section
    mock_extract_section.assert_called_once()
