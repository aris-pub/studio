"""Tests for studio resolve command (std-7js8)."""

import json
from pathlib import Path
from unittest.mock import patch

import jwt
import requests
import responses
from click.testing import CliRunner

from cli import cli
from cli.core import SESSION_FILE


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


class TestResolveCommand:
    """Test resolve command."""

    @responses.activate
    def test_resolve_success(self, tmp_path: Path) -> None:
        """Resolve command soft-deletes an annotation."""
        responses.add(
            responses.DELETE,
            "http://localhost:8000/annotations/42",
            status=204,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "0", "resolve", "42"])

            assert result.exit_code == 0
            assert "Resolved" in result.output

    @responses.activate
    def test_resolve_success_json(self, tmp_path: Path) -> None:
        """Resolve command outputs JSON when --json flag is set."""
        responses.add(
            responses.DELETE,
            "http://localhost:8000/annotations/42",
            status=204,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "0", "resolve", "--json", "42"])

            assert result.exit_code == 0
            data = json.loads(result.output)
            assert data["annotation_id"] == 42
            assert data["status"] == "resolved"

    @responses.activate
    def test_resolve_not_found(self, tmp_path: Path) -> None:
        """Resolve command handles 404 (already resolved or doesn't exist)."""
        responses.add(
            responses.DELETE,
            "http://localhost:8000/annotations/999",
            json={"detail": "Annotation not found"},
            status=404,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "0", "resolve", "999"])

            # Idempotent: already-resolved annotation is a no-op
            assert result.exit_code == 0
            assert "already resolved" in result.output.lower() or "Resolved" in result.output

    @responses.activate
    def test_resolve_not_found_json(self, tmp_path: Path) -> None:
        """Resolve with --json handles 404 idempotently."""
        responses.add(
            responses.DELETE,
            "http://localhost:8000/annotations/999",
            json={"detail": "Annotation not found"},
            status=404,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "0", "resolve", "--json", "999"])

            assert result.exit_code == 0
            data = json.loads(result.output)
            assert data["annotation_id"] == 999
            assert data["status"] == "already_resolved"

    @responses.activate
    def test_resolve_forbidden(self, tmp_path: Path) -> None:
        """Resolve command handles 403 (not authorized)."""
        responses.add(
            responses.DELETE,
            "http://localhost:8000/annotations/42",
            json={"detail": "You can only delete your own annotations"},
            status=403,
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "0", "resolve", "42"])

            assert result.exit_code != 0
            assert "403" in result.output or "permission" in result.output.lower() or "delete your own" in result.output.lower()

    def test_resolve_without_login(self, tmp_path: Path) -> None:
        """Resolve command fails without login."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "0", "resolve", "42"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output

    @responses.activate
    def test_resolve_network_error(self, tmp_path: Path) -> None:
        """Resolve command handles network errors."""
        responses.add(
            responses.DELETE,
            "http://localhost:8000/annotations/42",
            body=requests.ConnectionError("Connection refused"),
        )

        session_file = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "0", "resolve", "42"])

            assert result.exit_code != 0
            assert "Network error" in result.output
