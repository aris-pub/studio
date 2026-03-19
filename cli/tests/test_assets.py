"""Tests for studio file <id> assets commands."""

import base64
import json
from pathlib import Path
from unittest.mock import patch

import jwt
import responses
from click.testing import CliRunner

from cli import cli


def _make_session(tmp_path: Path) -> Path:
    token = jwt.encode({"sub": "1", "exp": 9999999999}, "secret", algorithm="HS256")
    session_file = tmp_path / "session.json"
    session_file.write_text(json.dumps({
        "access_token": token,
        "refresh_token": "ref",
        "user": {"id": 1},
    }))
    return session_file


class TestAssetsList:
    """Test studio file <id> assets (list)."""

    @responses.activate
    def test_lists_assets(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "http://localhost:8000/files/42/assets",
            json=[
                {"id": 1, "filename": "chart.html", "mime_type": "text/html", "content_encoding": "plain"},
                {"id": 2, "filename": "fig.png", "mime_type": "image/png", "content_encoding": "base64"},
            ],
            status=200,
        )

        session = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "42", "assets"])

            assert result.exit_code == 0
            assert "chart.html" in result.output
            assert "fig.png" in result.output

    @responses.activate
    def test_lists_assets_json(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "http://localhost:8000/files/42/assets",
            json=[{"id": 1, "filename": "chart.html", "mime_type": "text/html"}],
            status=200,
        )

        session = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "42", "assets", "--json"])

            assert result.exit_code == 0
            data = json.loads(result.output)
            assert len(data) == 1
            assert data[0]["filename"] == "chart.html"

    @responses.activate
    def test_lists_empty(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "http://localhost:8000/files/42/assets",
            json=[],
            status=200,
        )

        session = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "42", "assets"])

            assert result.exit_code == 0
            assert "No assets" in result.output


class TestAssetsCreate:
    """Test studio file <id> assets create."""

    @responses.activate
    def test_create_text_asset(self, tmp_path: Path) -> None:
        responses.add(
            responses.POST,
            "http://localhost:8000/files/42/assets",
            json={"id": 10, "filename": "chart.html", "mime_type": "text/html"},
            status=200,
        )

        html_file = tmp_path / "chart.html"
        html_file.write_text("<div>chart</div>")

        session = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "42", "assets", "create", "--file", str(html_file)])

            assert result.exit_code == 0
            assert "chart.html" in result.output

            body = json.loads(responses.calls[0].request.body)
            assert body["filename"] == "chart.html"
            assert body["content"] == "<div>chart</div>"
            assert body["content_encoding"] == "plain"

    @responses.activate
    def test_create_binary_asset(self, tmp_path: Path) -> None:
        responses.add(
            responses.POST,
            "http://localhost:8000/files/42/assets",
            json={"id": 11, "filename": "fig.png", "mime_type": "image/png"},
            status=200,
        )

        png_file = tmp_path / "fig.png"
        png_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

        session = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "42", "assets", "create", "--file", str(png_file)])

            assert result.exit_code == 0
            body = json.loads(responses.calls[0].request.body)
            assert body["content_encoding"] == "base64"
            base64.b64decode(body["content"])  # should not raise

    def test_create_requires_file(self, tmp_path: Path) -> None:
        session = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "42", "assets", "create"])

            assert result.exit_code != 0


class TestAssetsEdit:
    """Test studio file <id> assets edit."""

    @responses.activate
    def test_edit_asset(self, tmp_path: Path) -> None:
        responses.add(
            responses.PUT,
            "http://localhost:8000/files/42/assets/10",
            json={"id": 10, "filename": "chart.html", "mime_type": "text/html"},
            status=200,
        )

        new_file = tmp_path / "chart_v2.html"
        new_file.write_text("<div>updated chart</div>")

        session = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "42", "assets", "edit", "10", "--source", str(new_file)])

            assert result.exit_code == 0
            body = json.loads(responses.calls[0].request.body)
            assert body["content"] == "<div>updated chart</div>"


class TestAssetsDelete:
    """Test studio file <id> assets delete."""

    @responses.activate
    def test_delete_asset(self, tmp_path: Path) -> None:
        responses.add(
            responses.DELETE,
            "http://localhost:8000/files/42/assets/10",
            json={"message": "Asset 10 deleted"},
            status=200,
        )

        session = _make_session(tmp_path)
        with patch("cli.core.SESSION_FILE", session):
            runner = CliRunner()
            result = runner.invoke(cli, ["file", "-f", "42", "assets", "delete", "10"])

            assert result.exit_code == 0
            assert "deleted" in result.output.lower() or "Deleted" in result.output
