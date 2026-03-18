"""Tests for files command."""

import json
from pathlib import Path
from unittest.mock import patch

import jwt
import responses
from click.testing import CliRunner

from cli import cli


class TestFilesCommand:
    """Test files command."""

    @responses.activate
    def test_files_lists_documents(self, tmp_path: Path) -> None:
        """Files command lists user's documents."""
        responses.add(
            responses.GET,
            "http://localhost:8000/me",
            json={"id": 1, "email": "test@example.com", "name": "Test User"},
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/users/1/files",
            json=[
                {"id": 1, "title": "Test File", "last_edited_at": "2024-01-01"},
            ],
            status=200,
        )

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

        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["files"])

            assert result.exit_code == 0
            assert "Test File" in result.output

    def test_files_without_login(self, tmp_path: Path) -> None:
        """Files command fails without login."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["files"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output
