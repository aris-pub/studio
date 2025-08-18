import base64

import pytest

from aris.crud.file_assets import FileAssetCreate, FileAssetUpdate


def test_fileassetcreate_valid_image_content():
    content = base64.b64encode(b"pngdata").decode()
    payload = FileAssetCreate(filename="f.png", mime_type="image/png", content=content, content_encoding="base64", file_id=999)
    assert payload.content == content


def test_fileassetcreate_invalid_image_content_raises():
    with pytest.raises(ValueError):
        FileAssetCreate(filename="f.jpg", mime_type="image/jpeg", content="not_base64", content_encoding="base64", file_id=999)


def test_fileassetcreate_non_image_allows_bad_content():
    payload = FileAssetCreate(
        filename="f.txt", mime_type="text/plain", content="not_base64!", file_id=1
    )
    assert payload.content == "not_base64!"


def test_fileassetupdate_optional_content_none():
    payload = FileAssetUpdate(filename="f.txt", content=None)
    assert payload.content is None


def test_fileassetupdate_optional_content_valid():
    content = base64.b64encode(b"data").decode()
    payload = FileAssetUpdate(filename="f.txt", content=content)
    assert payload.content == content


def test_fileassetupdate_optional_content_invalid_prints(caplog):
    import logging
    caplog.set_level(logging.WARNING)
    FileAssetUpdate.validate_optional_content("bad!!!")
    assert "Content is not base64 decodable" in caplog.text
