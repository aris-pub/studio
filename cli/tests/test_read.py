"""Tests for studio read command."""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock, patch

import jwt
from click.testing import CliRunner
from pycrdt import Doc, Text
from pycrdt._sync import YSyncMessageType, create_message

from cli import cli
from cli.core import get_multiplayer_url


def _make_session_file(tmp_path: Path) -> Path:
    """Create a valid session file and return its path."""
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
    return session_file


def _build_sync_step2(content: str) -> bytes:
    """Build a SyncStep2 message containing document content."""
    doc = Doc()
    text = doc.get("text", type=Text)
    text += content
    update = doc.get_update()
    return create_message(update, YSyncMessageType.SYNC_STEP2)


def _mock_ws_connect(mock_ws):
    """Return a callable that mimics websockets.connect() as async context manager."""
    connected_urls: list[str] = []

    @asynccontextmanager
    async def _connect(url, **kwargs):
        connected_urls.append(url)
        yield mock_ws

    def factory(url, **kwargs):
        return _connect(url, **kwargs)

    factory.connected_urls = connected_urls
    return factory


class TestGetMultiplayerUrl:
    """Test multiplayer URL configuration."""

    def test_default(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            url = get_multiplayer_url()
            assert url == "ws://localhost:1234"

    def test_from_env(self) -> None:
        with patch.dict(os.environ, {"VITE_MULTIPLAYER_URL": "ws://custom:9999"}):
            url = get_multiplayer_url()
            assert url == "ws://custom:9999"


class TestReadCommand:
    """Test the `studio read` command."""

    def test_read_without_login(self, tmp_path: Path) -> None:
        """Read command fails without login."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "42", "read"])
            assert result.exit_code != 0
            assert "Not logged in" in result.output

    def test_read_prints_content_to_stdout(self, tmp_path: Path) -> None:
        """Read command connects to Y.js, syncs, and prints document content."""
        session_file = _make_session_file(tmp_path)
        sync_step2 = _build_sync_step2("Hello, world!")

        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value=sync_step2)
        factory = _mock_ws_connect(mock_ws)

        with patch("cli.core.SESSION_FILE", session_file):
            with patch("cli.commands.read.ws_connect", factory):
                runner = CliRunner()
                result = runner.invoke(cli, ["file", "42", "read"])

                assert result.exit_code == 0
                assert "Hello, world!" in result.output

    def test_read_json_flag(self, tmp_path: Path) -> None:
        """Read command with --json outputs JSON with file_id and content."""
        session_file = _make_session_file(tmp_path)
        sync_step2 = _build_sync_step2("Some RSM content")

        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value=sync_step2)
        factory = _mock_ws_connect(mock_ws)

        with patch("cli.core.SESSION_FILE", session_file):
            with patch("cli.commands.read.ws_connect", factory):
                runner = CliRunner()
                result = runner.invoke(cli, ["file", "42", "read", "--json"])

                assert result.exit_code == 0
                data = json.loads(result.output)
                assert data["file_id"] == 42
                assert data["content"] == "Some RSM content"

    def test_read_output_flag(self, tmp_path: Path) -> None:
        """Read command with --output writes content to file."""
        session_file = _make_session_file(tmp_path)
        output_file = tmp_path / "output.rsm"
        sync_step2 = _build_sync_step2("File content here")

        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value=sync_step2)
        factory = _mock_ws_connect(mock_ws)

        with patch("cli.core.SESSION_FILE", session_file):
            with patch("cli.commands.read.ws_connect", factory):
                runner = CliRunner()
                result = runner.invoke(cli, ["file", "42", "read", "--output", str(output_file)])

                assert result.exit_code == 0
                assert output_file.read_text() == "File content here"

    def test_read_empty_document(self, tmp_path: Path) -> None:
        """Read command handles empty documents."""
        session_file = _make_session_file(tmp_path)
        sync_step2 = _build_sync_step2("")

        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value=sync_step2)
        factory = _mock_ws_connect(mock_ws)

        with patch("cli.core.SESSION_FILE", session_file):
            with patch("cli.commands.read.ws_connect", factory):
                runner = CliRunner()
                result = runner.invoke(cli, ["file", "42", "read"])

                assert result.exit_code == 0

    def test_read_connection_error(self, tmp_path: Path) -> None:
        """Read command reports connection errors."""
        session_file = _make_session_file(tmp_path)

        @asynccontextmanager
        async def failing_connect(url, **kwargs):
            raise OSError("Connection refused")
            yield

        with patch("cli.core.SESSION_FILE", session_file):
            with patch("cli.commands.read.ws_connect", failing_connect):
                runner = CliRunner()
                result = runner.invoke(cli, ["file", "42", "read"])

                assert result.exit_code != 0
                assert "Connection refused" in result.output

    def test_read_sends_sync_step1(self, tmp_path: Path) -> None:
        """Read command sends SyncStep1 to initiate sync."""
        session_file = _make_session_file(tmp_path)
        sync_step2 = _build_sync_step2("test")

        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value=sync_step2)
        factory = _mock_ws_connect(mock_ws)

        with patch("cli.core.SESSION_FILE", session_file):
            with patch("cli.commands.read.ws_connect", factory):
                runner = CliRunner()
                result = runner.invoke(cli, ["file", "42", "read"])

                assert result.exit_code == 0
                mock_ws.send.assert_called()

    def test_read_connects_to_correct_room(self, tmp_path: Path) -> None:
        """Read command connects to the correct Y.js room for the file_id."""
        session_file = _make_session_file(tmp_path)
        sync_step2 = _build_sync_step2("test")

        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value=sync_step2)
        factory = _mock_ws_connect(mock_ws)

        with patch("cli.core.SESSION_FILE", session_file):
            with patch("cli.commands.read.ws_connect", factory):
                runner = CliRunner()
                runner.invoke(cli, ["file", "99", "read"])

                assert len(factory.connected_urls) == 1
                assert "file-99-" in factory.connected_urls[0]
