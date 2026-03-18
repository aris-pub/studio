"""Tests for authentication commands: login, logout, session."""

import json
from pathlib import Path
from unittest.mock import patch

import jwt
import responses
from click.testing import CliRunner

from cli import cli


class TestLoginCommand:
    """Test login command."""

    @responses.activate
    def test_login_success(self, tmp_path: Path) -> None:
        """Login command works."""
        responses.add(
            responses.POST,
            "http://localhost:8000/login",
            json={"access_token": "test_token", "refresh_token": "refresh_token"},
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/me",
            json={"id": 1, "email": "test@example.com", "name": "Test User"},
            status=200,
        )

        with patch("cli.core.SESSION_FILE", tmp_path / "session.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["login", "-u", "test@example.com", "-p", "password"])

            assert result.exit_code == 0
            assert "Logged in successfully" in result.output


class TestLogoutCommand:
    """Test logout command."""

    def test_logout(self, tmp_path: Path) -> None:
        """Logout command works."""
        session_file = tmp_path / "session.json"
        session_file.write_text(json.dumps({"access_token": "test"}))

        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["logout"])

            assert result.exit_code == 0
            assert "Logged out successfully" in result.output
            assert not session_file.exists()


class TestSessionCommand:
    """Test session command."""

    def test_session_displays_data(self, tmp_path: Path) -> None:
        """Session command outputs current session data."""
        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        session_file = tmp_path / "session.json"
        session_file.write_text(
            json.dumps(
                {
                    "access_token": valid_token,
                    "refresh_token": "refresh_token_value",
                    "user": {"id": 1, "email": "test@example.com", "name": "Test User"},
                }
            )
        )

        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["session"])

            assert result.exit_code == 0
            assert "Access Token:" in result.output
            assert "Refresh Token:" in result.output
            assert "test@example.com" in result.output

    def test_session_without_login(self, tmp_path: Path) -> None:
        """Session command fails without login."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["session"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output
