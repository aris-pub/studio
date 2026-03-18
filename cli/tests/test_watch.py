"""Tests for studio watch command (std-5agl)."""

import json
import time
from pathlib import Path
from unittest.mock import patch

import jwt
import responses
from click.testing import CliRunner

from cli import cli


def _make_session(tmp_path: Path) -> Path:
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


ANNOTATION_1 = {
    "id": 1,
    "file_id": 42,
    "owner_id": 1,
    "color": "purple",
    "visibility": "shared",
    "anchor_data": {"node_id": "n1", "start_offset": 0, "end_offset": 5},
    "selected_text": "hello",
    "created_at": "2026-03-17T10:00:00Z",
    "deleted_at": None,
    "messages": [
        {
            "id": 10,
            "annotation_id": 1,
            "owner_id": 1,
            "content": "First comment",
            "created_at": "2026-03-17T10:00:00Z",
            "deleted_at": None,
        }
    ],
    "owner": {"id": 1, "name": "Test User"},
}

ANNOTATION_2 = {
    "id": 2,
    "file_id": 42,
    "owner_id": 2,
    "color": "blue",
    "visibility": "shared",
    "anchor_data": {"node_id": "n2", "start_offset": 10, "end_offset": 20},
    "selected_text": "world",
    "created_at": "2026-03-17T11:00:00Z",
    "deleted_at": None,
    "messages": [],
    "owner": {"id": 2, "name": "Other User"},
}


class TestWatchCommand:
    """Test watch command."""

    def test_watch_without_login(self, tmp_path: Path) -> None:
        """Watch command fails without login."""
        with patch("cli.core.SESSION_FILE", tmp_path / "nonexistent.json"):
            runner = CliRunner()
            result = runner.invoke(cli, ["watch", "42"])

            assert result.exit_code != 0
            assert "Not logged in" in result.output

    @responses.activate
    def test_watch_outputs_initial_annotations(self, tmp_path: Path) -> None:
        """First poll outputs all existing annotations."""
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1],
            status=200,
        )
        # Second poll returns same data — watch should stop after we simulate interrupt
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1],
            status=200,
        )

        session_file = _make_session(tmp_path)

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.watch._sleep", side_effect=KeyboardInterrupt),
        ):
            runner = CliRunner()
            result = runner.invoke(cli, ["watch", "42"])

        lines = [line for line in result.output.strip().split("\n") if line.strip()]
        assert len(lines) >= 1
        event = json.loads(lines[0])
        assert event["type"] == "new"
        assert event["annotation"]["id"] == 1

    @responses.activate
    def test_watch_detects_new_annotation(self, tmp_path: Path) -> None:
        """Second poll detects a new annotation."""
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1],
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1, ANNOTATION_2],
            status=200,
        )

        poll_count = 0

        def counting_sleep(seconds: float) -> None:
            nonlocal poll_count
            poll_count += 1
            if poll_count >= 2:
                raise KeyboardInterrupt

        session_file = _make_session(tmp_path)

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.watch._sleep", side_effect=counting_sleep),
        ):
            runner = CliRunner()
            result = runner.invoke(cli, ["watch", "42"])

        lines = [line for line in result.output.strip().split("\n") if line.strip()]
        events = [json.loads(line) for line in lines]

        # First poll: annotation 1 is new
        new_events = [e for e in events if e["type"] == "new"]
        ids = [e["annotation"]["id"] for e in new_events]
        assert 1 in ids
        assert 2 in ids

    @responses.activate
    def test_watch_detects_updated_annotation(self, tmp_path: Path) -> None:
        """Detects when an annotation's messages change."""
        updated_annotation = {
            **ANNOTATION_1,
            "messages": [
                {
                    "id": 10,
                    "annotation_id": 1,
                    "owner_id": 1,
                    "content": "First comment",
                    "created_at": "2026-03-17T10:00:00Z",
                    "deleted_at": None,
                },
                {
                    "id": 11,
                    "annotation_id": 1,
                    "owner_id": 2,
                    "content": "Reply to first",
                    "created_at": "2026-03-17T12:00:00Z",
                    "deleted_at": None,
                },
            ],
        }

        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1],
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[updated_annotation],
            status=200,
        )

        poll_count = 0

        def counting_sleep(seconds: float) -> None:
            nonlocal poll_count
            poll_count += 1
            if poll_count >= 2:
                raise KeyboardInterrupt

        session_file = _make_session(tmp_path)

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.watch._sleep", side_effect=counting_sleep),
        ):
            runner = CliRunner()
            result = runner.invoke(cli, ["watch", "42"])

        lines = [line for line in result.output.strip().split("\n") if line.strip()]
        events = [json.loads(line) for line in lines]

        updated_events = [e for e in events if e["type"] == "updated"]
        assert len(updated_events) == 1
        assert updated_events[0]["annotation"]["id"] == 1

    @responses.activate
    def test_watch_detects_deleted_annotation(self, tmp_path: Path) -> None:
        """Detects when an annotation disappears from the response."""
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1, ANNOTATION_2],
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1],
            status=200,
        )

        poll_count = 0

        def counting_sleep(seconds: float) -> None:
            nonlocal poll_count
            poll_count += 1
            if poll_count >= 2:
                raise KeyboardInterrupt

        session_file = _make_session(tmp_path)

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.watch._sleep", side_effect=counting_sleep),
        ):
            runner = CliRunner()
            result = runner.invoke(cli, ["watch", "42"])

        lines = [line for line in result.output.strip().split("\n") if line.strip()]
        events = [json.loads(line) for line in lines]

        deleted_events = [e for e in events if e["type"] == "deleted"]
        assert len(deleted_events) == 1
        assert deleted_events[0]["annotation_id"] == 2

    @responses.activate
    def test_watch_custom_interval(self, tmp_path: Path) -> None:
        """--interval flag is passed to sleep."""
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[],
            status=200,
        )

        sleep_values: list[float] = []

        def capture_sleep(seconds: float) -> None:
            sleep_values.append(seconds)
            raise KeyboardInterrupt

        session_file = _make_session(tmp_path)

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.watch._sleep", side_effect=capture_sleep),
        ):
            runner = CliRunner()
            runner.invoke(cli, ["watch", "42", "--interval", "30"])

        assert sleep_values == [30]

    @responses.activate
    def test_watch_no_changes_no_output(self, tmp_path: Path) -> None:
        """No output when annotations don't change between polls."""
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1],
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1],
            status=200,
        )

        poll_count = 0

        def counting_sleep(seconds: float) -> None:
            nonlocal poll_count
            poll_count += 1
            if poll_count >= 2:
                raise KeyboardInterrupt

        session_file = _make_session(tmp_path)

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.watch._sleep", side_effect=counting_sleep),
        ):
            runner = CliRunner()
            result = runner.invoke(cli, ["watch", "42"])

        lines = [line for line in result.output.strip().split("\n") if line.strip()]
        events = [json.loads(line) for line in lines]

        # Only the initial "new" event from first poll, no duplicates
        assert all(e["type"] == "new" for e in events)
        assert len(events) == 1

    @responses.activate
    def test_watch_api_error_continues(self, tmp_path: Path) -> None:
        """Watch continues polling after a transient API error."""
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[],
            status=200,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json={"detail": "Internal Server Error"},
            status=500,
        )
        responses.add(
            responses.GET,
            "http://localhost:8000/annotations/",
            json=[ANNOTATION_1],
            status=200,
        )

        poll_count = 0

        def counting_sleep(seconds: float) -> None:
            nonlocal poll_count
            poll_count += 1
            if poll_count >= 3:
                raise KeyboardInterrupt

        session_file = _make_session(tmp_path)

        with (
            patch("cli.core.SESSION_FILE", session_file),
            patch("cli.commands.watch._sleep", side_effect=counting_sleep),
        ):
            runner = CliRunner()
            result = runner.invoke(cli, ["watch", "42"])

        lines = [line for line in result.output.strip().split("\n") if line.strip()]
        events = [json.loads(line) for line in lines if not line.startswith("{\"error\"") or True]

        # Should have the annotation from the third poll
        new_events = [e for e in events if e.get("type") == "new"]
        assert len(new_events) == 1
        assert new_events[0]["annotation"]["id"] == 1
