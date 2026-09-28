import asyncio
import logging
import threading
from unittest.mock import AsyncMock

import rsm

from aris.crud.render import render, render_with_assets
from aris.services.asset_resolver import FileAssetResolver


def test_render_success(monkeypatch):
    monkeypatch.setattr(rsm, "render", lambda src, handrails=True, asset_resolver=None: "<p>OK</p>")
    result = asyncio.run(render("src"))
    assert result == "<p>OK</p>"


def test_render_error(monkeypatch, caplog):
    def raise_error(src, handrails=True, asset_resolver=None):
        raise rsm.RSMApplicationError("fail")

    monkeypatch.setattr(rsm, "render", raise_error)
    caplog.set_level(logging.ERROR)
    result = asyncio.run(render("src"))
    assert result == ""
    assert "RSM render failed after" in caplog.text and "fail" in caplog.text


# std-b7d6t0: the CPU-bound rsm.render must run OFF the event-loop thread (via
# asyncio.to_thread), so a long compile does not freeze the uvicorn worker. These
# tests are deterministic: asyncio.run puts the loop on the calling thread, so the
# rsm call runs on a different thread if and only if it was dispatched to a worker.
def test_render_runs_off_the_event_loop_thread(monkeypatch):
    calling_thread = threading.current_thread()
    seen = {}

    def spy(src, handrails=True, asset_resolver=None):
        seen["off_loop"] = threading.current_thread() is not calling_thread
        return "<p>OK</p>"

    monkeypatch.setattr(rsm, "render", spy)
    result = asyncio.run(render("src"))
    assert result == "<p>OK</p>"
    assert seen.get("off_loop") is True, (
        "rsm.render ran on the event-loop thread; wrap it in asyncio.to_thread"
    )


def test_render_with_assets_runs_off_the_event_loop_thread(monkeypatch):
    calling_thread = threading.current_thread()
    seen = {}

    def spy(src, handrails=True, asset_resolver=None):
        seen["off_loop"] = threading.current_thread() is not calling_thread
        return "<p>OK</p>"

    monkeypatch.setattr(rsm, "render", spy)
    # Skip the DB: render_with_assets only awaits create_for_file for the resolver.
    monkeypatch.setattr(
        FileAssetResolver,
        "create_for_file",
        AsyncMock(return_value=FileAssetResolver({}, file_id=1)),
    )
    result = asyncio.run(render_with_assets("src", file_id=1, db=None, user_id=1))
    assert result == "<p>OK</p>"
    assert seen.get("off_loop") is True, (
        "rsm.render (render_with_assets) ran on the event-loop thread; wrap it in asyncio.to_thread"
    )
