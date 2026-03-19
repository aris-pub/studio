"""Tests for studio comments command (std-w4yb)."""

import json
from pathlib import Path
from unittest.mock import patch

import jwt
import responses
from click.testing import CliRunner

from cli import cli
from cli.core import SESSION_FILE

ANNOTATIONS_URL = "http://localhost:8000/annotations/"


def _make_session(tmp_path: Path) -> Path:
    """Create a valid session file and return its path."""
    valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
    session_file = tmp_path / "session.json"
    session_file.write_text(
        json.dumps(
            {
                "access_token": valid_token,
                "refresh_token": "refresh",
                "user": {"id": 1},
            }
        )
    )
    return session_file


SAMPLE_ANNOTATIONS = [
    {
        "id": 10,
        "file_id": 200,
        "owner_id": 1,
        "color": "purple",
        "visibility": "shared",
        "anchor_data": {"node_id": "p1", "start_offset": 0, "end_offset": 5},
        "selected_text": "Hello",
        "created_at": "2026-03-15T10:00:00",
        "deleted_at": None,
        "messages": [
            {
                "id": 100,
                "annotation_id": 10,
                "owner_id": 1,
                "content": "First comment",
                "created_at": "2026-03-15T10:00:00",
                "deleted_at": None,
                "owner": {"id": 1, "name": "Alice", "initials": "A", "avatar_color": "#ff0000"},
            },
            {
                "id": 101,
                "annotation_id": 10,
                "owner_id": 2,
                "content": "Reply to first",
                "created_at": "2026-03-15T11:00:00",
                "deleted_at": None,
                "owner": {"id": 2, "name": "Bob", "initials": "B", "avatar_color": "#00ff00"},
            },
        ],
        "owner": {"id": 1, "name": "Alice", "initials": "A", "avatar_color": "#ff0000"},
    },
    {
        "id": 11,
        "file_id": 200,
        "owner_id": 2,
        "color": "blue",
        "visibility": "shared",
        "anchor_data": {"node_id": "p2", "start_offset": 3, "end_offset": 8},
        "selected_text": "World",
        "created_at": "2026-03-16T09:00:00",
        "deleted_at": None,
        "messages": [
            {
                "id": 102,
                "annotation_id": 11,
                "owner_id": 2,
                "content": "Second note",
                "created_at": "2026-03-16T09:00:00",
                "deleted_at": None,
                "owner": {"id": 2, "name": "Bob", "initials": "B", "avatar_color": "#00ff00"},
            },
        ],
        "owner": {"id": 2, "name": "Bob", "initials": "B", "avatar_color": "#00ff00"},
    },
]


class TestCommentsCommand:
    """Test comments command."""

    def test_comments_without_login(self, tmp_path: Path) -> None:
        """Comments command fails without login."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "200", "comments"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output

    @responses.activate
    def test_comments_lists_annotations(self, tmp_path: Path) -> None:
        """Comments command lists annotations with threads."""
        responses.add(
            responses.GET,
            ANNOTATIONS_URL,
            json=SAMPLE_ANNOTATIONS,
            status=200,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "200", "comments"])

            assert result.exit_code == 0
            assert "Hello" in result.output
            assert "World" in result.output
            assert "First comment" in result.output
            assert "Reply to first" in result.output
            assert "Second note" in result.output
            assert "Alice" in result.output
            assert "Bob" in result.output

    @responses.activate
    def test_comments_empty(self, tmp_path: Path) -> None:
        """Comments command shows message when no annotations."""
        responses.add(
            responses.GET,
            ANNOTATIONS_URL,
            json=[],
            status=200,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "200", "comments"])

            assert result.exit_code == 0
            assert "No annotations" in result.output

    @responses.activate
    def test_comments_json_output(self, tmp_path: Path) -> None:
        """Comments command outputs JSON when --json flag is set."""
        responses.add(
            responses.GET,
            ANNOTATIONS_URL,
            json=SAMPLE_ANNOTATIONS,
            status=200,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "200", "comments", "--json"])

            assert result.exit_code == 0
            data = json.loads(result.output)
            assert len(data) == 2
            assert data[0]["id"] == 10
            assert len(data[0]["messages"]) == 2

    @responses.activate
    def test_comments_since_filter(self, tmp_path: Path) -> None:
        """--since filters annotations by created_at timestamp."""
        responses.add(
            responses.GET,
            ANNOTATIONS_URL,
            json=SAMPLE_ANNOTATIONS,
            status=200,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            # Only the second annotation (2026-03-16) should appear
            result = runner.invoke(cli, ["file", "-f", "200", "comments", "--since", "2026-03-16T00:00:00"])

            assert result.exit_code == 0
            assert "World" in result.output
            assert "Hello" not in result.output

    @responses.activate
    def test_comments_since_filter_json(self, tmp_path: Path) -> None:
        """--since filter works with --json output."""
        responses.add(
            responses.GET,
            ANNOTATIONS_URL,
            json=SAMPLE_ANNOTATIONS,
            status=200,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "200", "comments", "--since", "2026-03-16T00:00:00", "--json"])

            assert result.exit_code == 0
            data = json.loads(result.output)
            assert len(data) == 1
            assert data[0]["id"] == 11

    @responses.activate
    def test_comments_passes_file_id_param(self, tmp_path: Path) -> None:
        """Comments command passes file_id as query parameter."""
        responses.add(
            responses.GET,
            ANNOTATIONS_URL,
            json=[],
            status=200,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            runner.invoke(cli, ["file", "-f", "200", "comments"])

            assert responses.calls[0].request.params == {"file_id": "200"}

    @responses.activate
    def test_comments_api_error(self, tmp_path: Path) -> None:
        """Comments command handles API errors."""
        responses.add(
            responses.GET,
            ANNOTATIONS_URL,
            json={"detail": "Not found"},
            status=404,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "200", "comments"])

            assert result.exit_code != 0
            assert "API error" in result.output
