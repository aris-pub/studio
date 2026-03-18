"""Tests for UI command."""

import json
from pathlib import Path
from unittest.mock import patch

import jwt
from click.testing import CliRunner

from cli import cli
from cli.core import SESSION_FILE, get_frontend_port


class TestUICommand:
    """Test UI command."""

    def test_ui_without_login(self, tmp_path: Path) -> None:
        """UI command fails without login."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["ui", "200"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output

    def test_ui_opens_browser(self, tmp_path: Path) -> None:
        """UI command opens browser and exits immediately."""
        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        session_file = tmp_path / "session.json"
        session_file.write_text(
            json.dumps(
                {
                    "access_token": valid_token,
                    "refresh_token": "refresh",
                    "user": {"id": 1, "email": "test@example.com"},
                }
            )
        )

        with patch("cli.core.SESSION_FILE", session_file):
            with patch("cli.commands.ui.sync_playwright") as mock_playwright:
                mock_browser = mock_playwright.return_value.__enter__.return_value.chromium.launch.return_value
                mock_page = mock_browser.new_page.return_value

                runner = CliRunner()
                result = runner.invoke(cli, ["ui", "200"])

                assert result.exit_code == 0
                mock_playwright.return_value.__enter__.return_value.chromium.launch.assert_called_once_with(
                    headless=False
                )
                mock_page.goto.assert_any_call(f"http://localhost:{get_frontend_port()}")
                mock_page.goto.assert_any_call(f"http://localhost:{get_frontend_port()}/file/200")
                mock_page.evaluate.assert_called_once()

    def test_ui_playwright_flag_outputs_script(self, tmp_path: Path) -> None:
        """UI command with --playwright flag outputs Python script."""
        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        session_file = tmp_path / "session.json"
        session_file.write_text(
            json.dumps(
                {
                    "access_token": valid_token,
                    "refresh_token": "refresh",
                    "user": {"id": 1, "email": "test@example.com", "name": "Test User"},
                }
            )
        )

        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["ui", "200", "--playwright"])

            assert result.exit_code == 0
            assert "from playwright.sync_api import sync_playwright" in result.output
            assert f"page.goto('http://localhost:{get_frontend_port()}')" in result.output
            assert f"page.goto('http://localhost:{get_frontend_port()}/file/200')" in result.output
            assert "localStorage.setItem('accessToken'" in result.output
            assert "# ADD YOUR TEST CODE BELOW" in result.output
