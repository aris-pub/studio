"""Unit tests for model mock data in aris.models.mock_data."""

from aris.models.mock_data import MOCK_FILES, MOCK_TAGS, MOCK_USERS
from aris.models import File, FileStatus, Tag, User


def test_mock_data_collections_non_empty():
    """Sanity check that mock data lists are populated."""
    assert isinstance(MOCK_USERS, list) and MOCK_USERS, "MOCK_USERS should be a non-empty list"
    assert isinstance(MOCK_FILES, list) and MOCK_FILES, "MOCK_FILES should be a non-empty list"
    assert isinstance(MOCK_TAGS, list) and MOCK_TAGS, "MOCK_TAGS should be a non-empty list"


def test_mock_data_types():
    """Ensure items in mock data lists are instances of the correct models."""
    assert all(isinstance(u, User) for u in MOCK_USERS)
    assert all(isinstance(f, File) for f in MOCK_FILES)
    assert all(isinstance(t, Tag) for t in MOCK_TAGS)


def test_mock_files_have_valid_statuses():
    """All mock File objects should have a valid FileStatus."""
    statuses = {f.status for f in MOCK_FILES}
    expected = {FileStatus.DRAFT}
    assert statuses <= expected, "Mock files contain unexpected status values"
