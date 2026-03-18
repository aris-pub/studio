"""Tests for CLI functionality."""

import json
import os
from pathlib import Path
from unittest.mock import patch

import jwt
import pytest
import responses
from click.testing import CliRunner

from cli import Session, StudioAPI, check_environment, cli, get_api_base_url, get_frontend_port


class TestEnvironmentCheck:
    """Test environment safety checks."""

    def test_refuses_production(self) -> None:
        """Must refuse to run in PROD environment."""
        with patch.dict(os.environ, {"ENV": "PROD"}):
            with pytest.raises(SystemExit):
                check_environment()

    def test_refuses_ci(self) -> None:
        """Must refuse to run in CI environment."""
        with patch.dict(os.environ, {"ENV": "CI"}):
            with pytest.raises(SystemExit):
                check_environment()

    def test_refuses_staging(self) -> None:
        """Must refuse to run in STAGING environment."""
        with patch.dict(os.environ, {"ENV": "STAGING"}):
            with pytest.raises(SystemExit):
                check_environment()

    def test_allows_local(self) -> None:
        """Must allow LOCAL environment."""
        with patch.dict(os.environ, {"ENV": "LOCAL"}):
            check_environment()

    def test_allows_unset_env(self) -> None:
        """Must allow when ENV is not set (defaults to LOCAL)."""
        with patch.dict(os.environ, {}, clear=True):
            check_environment()


class TestSession:
    """Test session management."""

    def test_save_and_load(self, tmp_path: Path) -> None:
        """Session saves and loads correctly."""
        session = Session()
        session.file_path = tmp_path / "session.json"

        session.save(
            access_token="test_access",
            refresh_token="test_refresh",
            user={"id": 1, "email": "test@example.com"},
        )

        loaded = session.load()
        assert loaded is not None
        assert loaded["access_token"] == "test_access"
        assert loaded["refresh_token"] == "test_refresh"
        assert loaded["user"]["id"] == 1

    def test_load_nonexistent(self, tmp_path: Path) -> None:
        """Loading nonexistent session returns None."""
        session = Session()
        session.file_path = tmp_path / "nonexistent.json"
        assert session.load() is None

    def test_clear(self, tmp_path: Path) -> None:
        """Clear removes session file."""
        session = Session()
        session.file_path = tmp_path / "session.json"

        session.save("token", "refresh", {"id": 1})
        assert session.file_path.exists()

        session.clear()
        assert not session.file_path.exists()

    def test_is_valid_with_valid_token(self, tmp_path: Path) -> None:
        """Valid token returns True."""
        session = Session()
        session.file_path = tmp_path / "session.json"

        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")

        session.save(valid_token, "refresh", {"id": 1})
        assert session.is_valid()

    def test_is_valid_with_expired_token(self, tmp_path: Path) -> None:
        """Expired token returns False."""
        session = Session()
        session.file_path = tmp_path / "session.json"

        expired_token = jwt.encode({"sub": "1", "exp": 1}, "secret", algorithm="HS256")

        session.save(expired_token, "refresh", {"id": 1})
        assert not session.is_valid()

    def test_is_valid_without_session(self, tmp_path: Path) -> None:
        """No session returns False."""
        session = Session()
        session.file_path = tmp_path / "nonexistent.json"
        assert not session.is_valid()


class TestStudioAPI:
    """Test API wrapper."""

    @responses.activate
    def test_login_success(self) -> None:
        """Login API call works."""
        responses.add(
            responses.POST,
            "http://localhost:8000/login",
            json={"access_token": "test_token", "refresh_token": "refresh_token"},
            status=200,
        )

        api = StudioAPI()
        result = api.login("test@example.com", "password")

        assert result["access_token"] == "test_token"
        assert result["refresh_token"] == "refresh_token"

    @responses.activate
    def test_get_me(self, tmp_path: Path) -> None:
        """Get current user works."""
        responses.add(
            responses.GET,
            "http://localhost:8000/me",
            json={"id": 1, "email": "test@example.com", "name": "Test User"},
            status=200,
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        api.session.save(valid_token, "refresh", {"id": 1})

        result = api.get_me()
        assert result["id"] == 1
        assert result["email"] == "test@example.com"

    @responses.activate
    def test_get_files(self, tmp_path: Path) -> None:
        """Get files works."""
        responses.add(
            responses.GET,
            "http://localhost:8000/users/1/files",
            json=[
                {"id": 1, "title": "Test File", "last_edited_at": "2024-01-01"},
                {"id": 2, "title": "Another File", "last_edited_at": "2024-01-02"},
            ],
            status=200,
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        api.session.save(valid_token, "refresh", {"id": 1})

        result = api.get_files(1)
        assert len(result) == 2
        assert result[0]["title"] == "Test File"


class TestAutoRefresh:
    """Test transparent token auto-refresh in _get_headers."""

    def test_get_headers_returns_valid_token(self, tmp_path: Path) -> None:
        """When access token is valid, returns it directly."""
        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        api.session.save(valid_token, "refresh_tok", {"id": 1})

        headers = api._get_headers()
        assert headers == {"Authorization": f"Bearer {valid_token}"}

    @responses.activate
    def test_get_headers_refreshes_expired_token(self, tmp_path: Path) -> None:
        """When access token is expired, refreshes it transparently."""
        new_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            json={"access_token": new_token},
            status=200,
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = jwt.encode({"sub": "1", "exp": 1}, "secret", algorithm="HS256")
        api.session.save(expired_token, "refresh_tok", {"id": 1, "email": "a@b.com"})

        headers = api._get_headers()
        assert headers == {"Authorization": f"Bearer {new_token}"}

        # Verify refresh endpoint was called with the refresh token
        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "http://localhost:8000/refresh"
        body = json.loads(responses.calls[0].request.body)
        assert body == {"refresh_token": "refresh_tok"}

    @responses.activate
    def test_get_headers_updates_session_after_refresh(self, tmp_path: Path) -> None:
        """After successful refresh, the session file is updated with the new token."""
        new_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            json={"access_token": new_token},
            status=200,
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = jwt.encode({"sub": "1", "exp": 1}, "secret", algorithm="HS256")
        api.session.save(expired_token, "refresh_tok", {"id": 1})

        api._get_headers()

        saved = api.session.load()
        assert saved is not None
        assert saved["access_token"] == new_token
        assert saved["refresh_token"] == "refresh_tok"
        assert saved["user"] == {"id": 1}

    @responses.activate
    def test_get_headers_exits_when_refresh_fails(self, tmp_path: Path) -> None:
        """When refresh endpoint returns non-200, exits with error message."""
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            json={"detail": "Invalid or expired refresh token"},
            status=401,
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = jwt.encode({"sub": "1", "exp": 1}, "secret", algorithm="HS256")
        api.session.save(expired_token, "refresh_tok", {"id": 1})

        with pytest.raises(SystemExit):
            api._get_headers()

    def test_get_headers_exits_when_no_refresh_token(self, tmp_path: Path) -> None:
        """When access token is expired and no refresh token exists, exits."""
        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = jwt.encode({"sub": "1", "exp": 1}, "secret", algorithm="HS256")
        # Save session without refresh token
        data = {"access_token": expired_token, "refresh_token": "", "user": {"id": 1}}
        api.session.file_path.write_text(json.dumps(data))

        with pytest.raises(SystemExit):
            api._get_headers()

    def test_get_headers_returns_empty_without_session(self, tmp_path: Path) -> None:
        """When no session exists, returns empty dict."""
        api = StudioAPI()
        api.session.file_path = tmp_path / "nonexistent.json"

        headers = api._get_headers()
        assert headers == {}

    @responses.activate
    def test_get_headers_exits_on_network_error(self, tmp_path: Path) -> None:
        """When refresh request fails due to network error, exits."""
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            body=ConnectionError("Connection refused"),
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = jwt.encode({"sub": "1", "exp": 1}, "secret", algorithm="HS256")
        api.session.save(expired_token, "refresh_tok", {"id": 1})

        with pytest.raises(SystemExit):
            api._get_headers()

    def test_is_token_expired(self) -> None:
        """_is_token_expired correctly identifies expired vs valid tokens."""
        api = StudioAPI()

        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        assert not api._is_token_expired(valid_token)

        expired_token = jwt.encode({"sub": "1", "exp": 1}, "secret", algorithm="HS256")
        assert api._is_token_expired(expired_token)

    @responses.activate
    def test_refresh_access_token_success(self) -> None:
        """_refresh_access_token returns new token on success."""
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            json={"access_token": "new_token"},
            status=200,
        )

        api = StudioAPI()
        result = api._refresh_access_token("refresh_tok")
        assert result == "new_token"

    @responses.activate
    def test_refresh_access_token_failure(self) -> None:
        """_refresh_access_token returns None on failure."""
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            json={"detail": "Invalid"},
            status=401,
        )

        api = StudioAPI()
        result = api._refresh_access_token("bad_token")
        assert result is None


class TestCLI:
    """Test CLI commands."""

    @responses.activate
    def test_login_command_success(self, tmp_path: Path) -> None:
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

        with patch("cli.SESSION_FILE", tmp_path / "session.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["login", "-u", "test@example.com", "-p", "password"])

            assert result.exit_code == 0
            assert "Logged in successfully" in result.output

    def test_logout_command(self, tmp_path: Path) -> None:
        """Logout command works."""
        session_file = tmp_path / "session.json"
        session_file.write_text(json.dumps({"access_token": "test"}))

        with patch("cli.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["logout"])

            assert result.exit_code == 0
            assert "Logged out successfully" in result.output
            assert not session_file.exists()

    @responses.activate
    def test_files_command(self, tmp_path: Path) -> None:
        """Files command works."""
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
        session_file.parent.mkdir(parents=True, exist_ok=True)
        session_file.write_text(
            json.dumps(
                {
                    "access_token": valid_token,
                    "refresh_token": "refresh",
                    "user": {"id": 1},
                }
            )
        )

        with patch("cli.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["files"])

            assert result.exit_code == 0
            assert "Test File" in result.output

    def test_files_command_without_login(self, tmp_path: Path) -> None:
        """Files command fails without login."""
        with patch("cli.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["files"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output

    def test_ui_command_without_login(self, tmp_path: Path) -> None:
        """UI command fails without login."""
        with patch("cli.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["ui", "200"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output

    def test_ui_command_default_opens_browser(self, tmp_path: Path) -> None:
        """UI command opens browser and exits immediately (no blocking)."""
        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        session_file = tmp_path / "session.json"
        session_file.parent.mkdir(parents=True, exist_ok=True)
        session_file.write_text(
            json.dumps(
                {
                    "access_token": valid_token,
                    "refresh_token": "refresh",
                    "user": {"id": 1, "email": "test@example.com"},
                }
            )
        )

        with patch("cli.SESSION_FILE", session_file):
            with patch("cli.sync_playwright") as mock_playwright:
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
                mock_page.wait_for_timeout.assert_not_called()

    def test_ui_command_playwright_flag_outputs_script(self, tmp_path: Path) -> None:
        """UI command with --playwright flag outputs Python script."""
        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        session_file = tmp_path / "session.json"
        session_file.parent.mkdir(parents=True, exist_ok=True)
        session_file.write_text(
            json.dumps(
                {
                    "access_token": valid_token,
                    "refresh_token": "refresh",
                    "user": {"id": 1, "email": "test@example.com", "name": "Test User"},
                }
            )
        )

        with patch("cli.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["ui", "200", "--playwright"])

            assert result.exit_code == 0
            assert "from playwright.sync_api import sync_playwright" in result.output
            assert f"page.goto('http://localhost:{get_frontend_port()}')" in result.output
            assert f"page.goto('http://localhost:{get_frontend_port()}/file/200')" in result.output
            assert "localStorage.setItem('accessToken'" in result.output
            assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" in result.output
            assert "# ADD YOUR TEST CODE BELOW" in result.output

    def test_session_command(self, tmp_path: Path) -> None:
        """Session command outputs current session data."""
        valid_token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
        session_file = tmp_path / "session.json"
        session_file.parent.mkdir(parents=True, exist_ok=True)
        session_file.write_text(
            json.dumps(
                {
                    "access_token": valid_token,
                    "refresh_token": "refresh_token_value",
                    "user": {"id": 1, "email": "test@example.com", "name": "Test User"},
                }
            )
        )

        with patch("cli.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["session"])

            assert result.exit_code == 0
            assert "Access Token:" in result.output
            assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" in result.output
            assert "Refresh Token:" in result.output
            assert "refresh_token_value" in result.output
            assert "User:" in result.output
            assert "test@example.com" in result.output

    def test_session_command_without_login(self, tmp_path: Path) -> None:
        """Session command fails without login."""
        with patch("cli.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["session"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output


class TestAutoRefresh:
    """Test transparent token auto-refresh in StudioAPI._get_headers."""

    def _make_token(self, exp: int) -> str:
        return jwt.encode({"sub": "1", "exp": exp}, "secret", algorithm="HS256")

    def test_valid_token_no_refresh(self, tmp_path: Path) -> None:
        """When access token is valid, _get_headers returns it without refreshing."""
        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        valid_token = self._make_token(9999999999)
        api.session.save(valid_token, "refresh_tok", {"id": 1})

        headers = api._get_headers()
        assert headers["Authorization"] == f"Bearer {valid_token}"

    @responses.activate
    def test_expired_token_refreshes(self, tmp_path: Path) -> None:
        """When access token is expired, _get_headers refreshes it transparently."""
        new_token = self._make_token(9999999999)
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            json={"access_token": new_token},
            status=200,
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = self._make_token(1)
        api.session.save(expired_token, "refresh_tok", {"id": 1})

        headers = api._get_headers()
        assert headers["Authorization"] == f"Bearer {new_token}"

        # Verify session file was updated
        updated = api.session.load()
        assert updated is not None
        assert updated["access_token"] == new_token
        assert updated["refresh_token"] == "refresh_tok"

    @responses.activate
    def test_expired_token_refresh_fails_exits(self, tmp_path: Path) -> None:
        """When refresh fails, prints error and exits."""
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            json={"detail": "Invalid or expired refresh token"},
            status=401,
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = self._make_token(1)
        api.session.save(expired_token, "refresh_tok", {"id": 1})

        with pytest.raises(SystemExit):
            api._get_headers()

    def test_expired_token_no_refresh_token_exits(self, tmp_path: Path) -> None:
        """When access token expired and no refresh token, prints error and exits."""
        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = self._make_token(1)
        api.session.save(expired_token, "", {"id": 1})

        with pytest.raises(SystemExit):
            api._get_headers()

    @responses.activate
    def test_refresh_network_error_exits(self, tmp_path: Path) -> None:
        """When refresh request has network error, prints error and exits."""
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            body=ConnectionError("Network error"),
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = self._make_token(1)
        api.session.save(expired_token, "refresh_tok", {"id": 1})

        with pytest.raises(SystemExit):
            api._get_headers()

    @responses.activate
    def test_get_me_with_auto_refresh(self, tmp_path: Path) -> None:
        """Full flow: get_me with expired token triggers refresh then succeeds."""
        new_token = self._make_token(9999999999)
        responses.add(
            responses.POST,
            "http://localhost:8000/refresh",
            json={"access_token": new_token},
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/me",
            json={"id": 1, "email": "test@example.com", "name": "Test User"},
            status=200,
        )

        api = StudioAPI()
        api.session.file_path = tmp_path / "session.json"

        expired_token = self._make_token(1)
        api.session.save(expired_token, "refresh_tok", {"id": 1})

        result = api.get_me()
        assert result["id"] == 1

        # Verify the /me request used the new token
        me_request = responses.calls[1].request
        assert me_request.headers["Authorization"] == f"Bearer {new_token}"


class TestConfig:
    """Test configuration loading."""

    def test_get_api_base_url_default(self) -> None:
        """API base URL defaults correctly."""
        with patch.dict(os.environ, {}, clear=True):
            url = get_api_base_url()
            assert url == "http://localhost:8000"

    def test_get_api_base_url_from_env(self) -> None:
        """API base URL reads from environment."""
        with patch.dict(os.environ, {"VITE_API_BASE_URL": "http://example.com:9000"}):
            url = get_api_base_url()
            assert url == "http://example.com:9000"
