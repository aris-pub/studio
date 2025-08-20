import asyncio
import logging

import rsm

from aris.crud.render import render


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
