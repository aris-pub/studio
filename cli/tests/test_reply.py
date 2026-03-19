"""Tests for studio reply command (std-v8qb)."""

import json
from pathlib import Path
from unittest.mock import patch

import jwt
import responses
from click.testing import CliRunner

from cli import cli
from cli.core import SESSION_FILE


def _session_file(tmp_path: Path) -> Path:
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


MESSAGE_RESPONSE = {
    "id": 42,
    "annotation_id": 10,
    "owner_id": 1,
    "content": "Looks good to me",
    "created_at": "2026-03-18T12:00:00",
    "deleted_at": None,
    "owner": {"id": 1, "name": "Test User"},
}


class TestReplyCommand:
    """Test reply command."""

    @responses.activate
    def test_reply_posts_message(self, tmp_path: Path) -> None:
        """Reply posts a message to the annotation thread."""
        responses.add(
            responses.POST,
            "http://localhost:8000/annotations/10/messages",
            json=MESSAGE_RESPONSE,
            status=201,
        )

        session_file = _session_file(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "0", "reply", "10", "Looks good to me"])

            assert result.exit_code == 0
            assert "Looks good to me" in result.output

        assert json.loads(responses.calls[0].request.body) == {"content": "Looks good to me"}

    @responses.activate
    def test_reply_json_output(self, tmp_path: Path) -> None:
        """Reply with --json outputs raw JSON."""
        responses.add(
            responses.POST,
            "http://localhost:8000/annotations/10/messages",
            json=MESSAGE_RESPONSE,
            status=201,
        )

        session_file = _session_file(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "0", "reply", "10", "Looks good to me", "--json"])

            assert result.exit_code == 0
            parsed = json.loads(result.output)
            assert parsed["id"] == 42
            assert parsed["content"] == "Looks good to me"

    @responses.activate
    def test_reply_stdin(self, tmp_path: Path) -> None:
        """Reply reads message from stdin when --stdin is used."""
        responses.add(
            responses.POST,
            "http://localhost:8000/annotations/10/messages",
            json=MESSAGE_RESPONSE,
            status=201,
        )

        session_file = _session_file(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(
                cli, ["file", "-f", "0", "reply", "10", "--stdin"], input="Looks good to me"
            )

            assert result.exit_code == 0
            assert json.loads(responses.calls[0].request.body) == {"content": "Looks good to me"}

    def test_reply_requires_login(self, tmp_path: Path) -> None:
        """Reply fails if not logged in."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "0", "reply", "10", "hello"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output

    def test_reply_requires_message_or_stdin(self, tmp_path: Path) -> None:
        """Reply fails if neither message arg nor --stdin provided."""
        session_file = _session_file(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "0", "reply", "10"])

            assert result.exit_code != 0
            assert "Provide a message" in result.output

    @responses.activate
    def test_reply_api_error(self, tmp_path: Path) -> None:
        """Reply shows error on API failure."""
        responses.add(
            responses.POST,
            "http://localhost:8000/annotations/10/messages",
            json={"detail": "Annotation not found"},
            status=404,
        )

        session_file = _session_file(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "0", "reply", "10", "hello"])

            assert result.exit_code != 0
            assert "API error" in result.output
