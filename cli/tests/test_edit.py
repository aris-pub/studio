"""Tests for studio edit command (std-pj48)."""

import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from click.testing import CliRunner

from cli import cli
from cli.commands.edit import _apply_edit, _compute_diff_ops
from cli.core import build_room_url


class TestBuildRoomUrl:
    """Test Y.js room URL construction."""

    def test_default_env(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            url = build_room_url(42)
            assert url == "ws://localhost:1234/file-42-local"

    def test_vite_env_takes_precedence(self) -> None:
        with patch.dict("os.environ", {"VITE_ENV": "ci", "ENV": "local"}):
            url = build_room_url(42)
            assert url == "ws://localhost:1234/file-42-ci"

    def test_env_fallback(self) -> None:
        with patch.dict("os.environ", {"ENV": "CI"}, clear=True):
            url = build_room_url(42)
            assert url == "ws://localhost:1234/file-42-ci"


class TestApplyEdit:
    """Test the core Y.js edit logic in isolation."""

    @pytest.fixture()
    def mock_ws(self) -> AsyncMock:
        ws = AsyncMock()
        # Simulate SyncStep2 response: msg_type=0 (sync), sub-type=1 (step2), empty update
        from pycrdt import Doc, create_sync_message, handle_sync_message
        from pycrdt._sync import YSyncMessageType, create_message

        # Build a real SyncStep2 reply from a fresh doc
        server_doc = Doc()
        sync_step1 = create_sync_message(Doc())  # client's step1
        # handle_sync_message returns a SyncStep2 reply
        step2_reply = handle_sync_message(sync_step1[1:], server_doc)

        # recv returns step2 then raises StopAsyncIteration
        ws.recv = AsyncMock(side_effect=[step2_reply])
        ws.send = AsyncMock()
        ws.close = AsyncMock()
        return ws

    def test_apply_edit_replaces_content(self, mock_ws: AsyncMock) -> None:
        """_apply_edit connects, syncs, replaces text, and disconnects."""
        new_source = "::article\n\n# Hello World\n\n::\n"

        async def run() -> dict:
            return await _apply_edit(mock_ws, 200, new_source)

        result = asyncio.run(run())

        assert result["file_id"] == 200
        assert result["chars_written"] == len(new_source)
        assert result["status"] == "ok"
        # Must have sent at least SyncStep1 + the update + close
        assert mock_ws.send.call_count >= 2

    def test_apply_edit_replaces_existing_content(self, mock_ws: AsyncMock) -> None:
        """_apply_edit replaces pre-existing text in the room."""
        from pycrdt import Doc, Text, create_sync_message, handle_sync_message
        from pycrdt._sync import create_message, YSyncMessageType

        # Build a server doc with existing content
        server_doc = Doc()
        server_text = server_doc.get("text", type=Text)
        server_text += "old content here"

        # Re-create mock_ws.recv to return step2 from populated doc
        client_doc = Doc()
        sync_step1 = create_sync_message(client_doc)
        step2_reply = handle_sync_message(sync_step1[1:], server_doc)

        mock_ws.recv = AsyncMock(side_effect=[step2_reply])

        new_source = "new content"

        async def run() -> dict:
            return await _apply_edit(mock_ws, 200, new_source)

        result = asyncio.run(run())
        assert result["chars_written"] == len(new_source)
        assert result["status"] == "ok"

    def test_apply_edit_empty_source(self, mock_ws: AsyncMock) -> None:
        """_apply_edit handles empty source (clears document)."""

        async def run() -> dict:
            return await _apply_edit(mock_ws, 200, "")

        result = asyncio.run(run())
        assert result["chars_written"] == 0
        assert result["status"] == "ok"


class TestEditCommand:
    """Test the click command integration."""

    def _make_session(self, tmp_path: Path) -> Path:
        valid_token = jwt.encode(
            {"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256"
        )
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

    def test_edit_requires_source_or_stdin(self, tmp_path: Path) -> None:
        """Edit command fails if neither --source nor --stdin is given."""
        session_file = self._make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "200", "edit"])
            assert result.exit_code != 0
            assert "source" in result.output.lower() or "stdin" in result.output.lower()

    def test_edit_rejects_both_source_and_stdin(self, tmp_path: Path) -> None:
        """Edit command fails if both --source and --stdin are given."""
        source_file = tmp_path / "test.rsm"
        source_file.write_text("content")
        session_file = self._make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session_file):
            runner = CliRunner()
            result = runner.invoke(
                cli, ["file", "-f", "200", "edit", "--source", str(source_file), "--stdin"]
            )
            assert result.exit_code != 0

    def test_edit_not_logged_in(self, tmp_path: Path) -> None:
        """Edit command fails without login."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "200", "edit", "--stdin"], input="hello")
            assert result.exit_code != 0
            assert "Not logged in" in result.output

    def test_edit_from_file(self, tmp_path: Path) -> None:
        """Edit command reads source from file and calls _apply_edit."""
        source_file = tmp_path / "test.rsm"
        source_file.write_text("::article\n\n# Test\n\n::\n")
        session_file = self._make_session(tmp_path)

        mock_result = {
            "file_id": 200,
            "chars_written": 25,
            "status": "ok",
        }

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.edit._run_edit", return_value=mock_result),
        ):
            runner = CliRunner()
            result = runner.invoke(
                cli, ["file", "-f", "200", "edit", "--source", str(source_file)]
            )
            assert result.exit_code == 0
            assert "200" in result.output

    def test_edit_from_stdin(self, tmp_path: Path) -> None:
        """Edit command reads source from stdin."""
        session_file = self._make_session(tmp_path)

        mock_result = {
            "file_id": 200,
            "chars_written": 5,
            "status": "ok",
        }

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.edit._run_edit", return_value=mock_result),
        ):
            runner = CliRunner()
            result = runner.invoke(
                cli, ["file", "-f", "200", "edit", "--stdin"], input="hello"
            )
            assert result.exit_code == 0

    def test_edit_json_output(self, tmp_path: Path) -> None:
        """Edit command outputs JSON when --json is given."""
        session_file = self._make_session(tmp_path)

        mock_result = {
            "file_id": 200,
            "chars_written": 5,
            "status": "ok",
        }

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.edit._run_edit", return_value=mock_result),
        ):
            runner = CliRunner()
            result = runner.invoke(
                cli, ["file", "-f", "200", "edit", "--stdin", "--json"], input="hello"
            )
            assert result.exit_code == 0
            data = json.loads(result.output)
            assert data["status"] == "ok"
            assert data["file_id"] == 200


class TestDiffOps:
    """Regression tests for _compute_diff_ops (replace bug fix)."""

    def _apply_ops(self, old: str, new: str) -> str:
        """Apply diff ops to old string and verify result matches new."""
        from pycrdt import Doc, Text

        doc = Doc()
        text = doc.get("text", type=Text)
        with doc.transaction():
            text += old

        ops = _compute_diff_ops(old, new)
        with doc.transaction():
            for op in reversed(ops):
                if op[0] == "replace":
                    _, start, end, new_content = op
                    del text[start:end]
                    text.insert(start, new_content)
                elif op[0] == "delete":
                    _, start, end = op
                    del text[start:end]
                elif op[0] == "insert":
                    _, offset, content = op
                    text.insert(offset, content)

        return str(text)

    def test_replace_single_word(self):
        result = self._apply_ops("hello world", "hello WORLD")
        assert result == "hello WORLD"

    def test_replace_multiple_locations(self):
        result = self._apply_ops("aaa bbb ccc", "AAA bbb CCC")
        assert result == "AAA bbb CCC"

    def test_insert_only(self):
        result = self._apply_ops("hello world", "hello beautiful world")
        assert result == "hello beautiful world"

    def test_delete_only(self):
        result = self._apply_ops("hello beautiful world", "hello world")
        assert result == "hello world"

    def test_no_change(self):
        result = self._apply_ops("hello world", "hello world")
        assert result == "hello world"

    def test_large_document_single_edit(self):
        old = "line1\nline2\nline3\nline4\nline5\n" * 100
        new = old.replace("line3", "LINE_THREE", 1)
        result = self._apply_ops(old, new)
        assert result == new
