"""Unit tests for filename sanitization logic used in data export."""

import re


def sanitize_filename(name: str) -> str:
    """Mirror of aris.routes.user.sanitize_filename for isolated testing."""
    safe = re.sub(r'[\/\\:*?"<>|#%\x00-\x1f]', "-", name)
    safe = re.sub(r"\s+", "-", safe)
    safe = re.sub(r"-{2,}", "-", safe)
    return safe.strip("-")


class TestSanitizeFilename:
    def test_simple_name(self):
        assert sanitize_filename("Jane Doe") == "Jane-Doe"

    def test_slashes_replaced(self):
        assert sanitize_filename("AC/DC") == "AC-DC"

    def test_backslashes_replaced(self):
        assert sanitize_filename("path\\to\\name") == "path-to-name"

    def test_colons_replaced(self):
        assert sanitize_filename("Title: Subtitle") == "Title-Subtitle"

    def test_multiple_unsafe_chars_collapsed(self):
        assert sanitize_filename("a//b::c") == "a-b-c"

    def test_leading_trailing_hyphens_stripped(self):
        assert sanitize_filename("/leading") == "leading"
        assert sanitize_filename("trailing/") == "trailing"

    def test_angle_brackets_and_pipe(self):
        assert sanitize_filename("a<b>c|d") == "a-b-c-d"

    def test_question_mark_and_asterisk(self):
        assert sanitize_filename("what?*") == "what"

    def test_double_quotes(self):
        assert sanitize_filename('say "hello"') == "say-hello"

    def test_all_unsafe_returns_empty(self):
        assert sanitize_filename("///") == ""

    def test_tabs_and_newlines(self):
        assert sanitize_filename("hello\tworld\n") == "hello-world"

    def test_hash_and_percent(self):
        assert sanitize_filename("100%#1") == "100-1"

    def test_normal_unicode_preserved(self):
        assert sanitize_filename("José García") == "José-García"
