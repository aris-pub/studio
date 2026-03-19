"""Tests for standalone CLI mode — connecting to any Studio deployment."""

import json
import os
from pathlib import Path
from unittest.mock import patch

import jwt
import pytest
import responses
from click.testing import CliRunner

from cli import cli
from cli.core import Session, StudioAPI


class TestSessionStoresServer:
    """Session file should persist server URLs across commands."""

    def test_save_includes_server_urls(self, tmp_path: Path) -> None:
        session = Session()
        session.file_path = tmp_path / "session.json"

        session.save(
            access_token="tok",
            refresh_token="ref",
            user={"id": 1},
            server="https://api.rsm.studio",
            ws="wss://ws.rsm.studio",
        )

        data = json.loads(session.file_path.read_text())
        assert data["server"] == "https://api.rsm.studio"
        assert data["ws"] == "wss://ws.rsm.studio"

    def test_save_defaults_server_urls(self, tmp_path: Path) -> None:
        session = Session()
        session.file_path = tmp_path / "session.json"

        session.save(
            access_token="tok",
            refresh_token="ref",
            user={"id": 1},
        )

        data = json.loads(session.file_path.read_text())
        assert "server" not in data or data["server"] is None

    def test_load_returns_server_urls(self, tmp_path: Path) -> None:
        session = Session()
        session.file_path = tmp_path / "session.json"

        session.save(
            access_token="tok",
            refresh_token="ref",
            user={"id": 1},
            server="https://api.rsm.studio",
            ws="wss://ws.rsm.studio",
        )

        loaded = session.load()
        assert loaded["server"] == "https://api.rsm.studio"
        assert loaded["ws"] == "wss://ws.rsm.studio"


class TestStudioAPIUsesSessionServer:
    """StudioAPI should read the server URL from the session, not .env."""

    def test_api_uses_session_server(self, tmp_path: Path) -> None:
        session_file = tmp_path / "session.json"
        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")

        session_file.write_text(json.dumps({
            "access_token": valid_token,
            "refresh_token": "ref",
            "user": {"id": 1},
            "server": "https://api.rsm.studio",
        }))

        with patch("cli.core.SESSION_FILE", session_file):
            api = StudioAPI()
            assert api.base_url == "https://api.rsm.studio"

    def test_api_falls_back_to_env(self, tmp_path: Path) -> None:
        """When session has no server URL, fall back to env/default."""
        session_file = tmp_path / "session.json"
        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")

        session_file.write_text(json.dumps({
            "access_token": valid_token,
            "refresh_token": "ref",
            "user": {"id": 1},
        }))

        with patch("cli.core.SESSION_FILE", session_file):
            with patch.dict(os.environ, {}, clear=True):
                api = StudioAPI()
                assert api.base_url == "http://localhost:8000"

    def test_api_uses_env_var_override(self, tmp_path: Path) -> None:
        """STUDIO_SERVER env var overrides everything."""
        session_file = tmp_path / "nonexistent.json"

        with patch("cli.core.SESSION_FILE", session_file):
            with patch.dict(os.environ, {"STUDIO_SERVER": "https://custom.example.com"}):
                api = StudioAPI()
                assert api.base_url == "https://custom.example.com"


class TestLoginWithServer:
    """Login command should accept --server flag."""

    @responses.activate
    def test_login_stores_server_in_session(self, tmp_path: Path) -> None:
        responses.add(
            responses.POST,
            "https://api.rsm.studio/login",
            json={"access_token": "tok", "refresh_token": "ref"},
            status=200,
        )
        responses.add(
            responses.GET,
            "https://api.rsm.studio/me",
            json={"id": 1, "email": "agent@example.com", "name": "Agent"},
            status=200,
        )

        session_file = tmp_path / "session.json"
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, [
                "login",
                "-u", "agent@example.com",
                "-p", "password",
                "--server", "https://api.rsm.studio",
            ])

            assert result.exit_code == 0
            data = json.loads(session_file.read_text())
            assert data["server"] == "https://api.rsm.studio"

    @responses.activate
    def test_login_without_server_uses_default(self, tmp_path: Path) -> None:
        responses.add(
            responses.POST,
            "http://localhost:8000/login",
            json={"access_token": "tok", "refresh_token": "ref"},
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/me",
            json={"id": 1, "email": "agent@example.com", "name": "Agent"},
            status=200,
        )

        session_file = tmp_path / "session.json"
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, [
                "login",
                "-u", "agent@example.com",
                "-p", "password",
            ])

            assert result.exit_code == 0


class TestNoEnvironmentGuard:
    """CLI should work in any environment when --server is provided."""

    @responses.activate
    def test_works_in_prod_env(self, tmp_path: Path) -> None:
        responses.add(
            responses.POST,
            "https://api.rsm.studio/login",
            json={"access_token": "tok", "refresh_token": "ref"},
            status=200,
        )
        responses.add(
            responses.GET,
            "https://api.rsm.studio/me",
            json={"id": 1, "email": "a@b.com", "name": "Agent"},
            status=200,
        )

        session_file = tmp_path / "session.json"
        with patch("cli.core.SESSION_FILE", session_file):
            with patch.dict(os.environ, {"ENV": "PROD"}):
                runner = CliRunner()
                result = runner.invoke(cli, [
                    "login",
                    "-u", "a@b.com",
                    "-p", "pass",
                    "--server", "https://api.rsm.studio",
                ])

                assert result.exit_code == 0
                assert "Logged in" in result.output
