import asyncio
import logging

import rsm

from aris.crud.render import render


def test_render_success(monkeypatch):
    monkeypatch.setattr(
        rsm,
        "render",
        lambda src, handrails=True, add_source=False, asset_resolver=None: "<p>OK</p>",
    )
    result = asyncio.run(render("src"))
    assert result == "<p>OK</p>"


def test_render_error(monkeypatch, caplog):
    def raise_error(src, handrails=True, add_source=False, asset_resolver=None):
        raise rsm.RSMApplicationError("fail")

    monkeypatch.setattr(rsm, "render", raise_error)
    caplog.set_level(logging.ERROR)
    result = asyncio.run(render("src"))
    assert result == ""
    assert "RSM render failed after" in caplog.text and "fail" in caplog.text


def test_render_passes_add_source_true(monkeypatch):
    """Regression: rsm.render must be called with add_source=True so that the
    rendered HTML includes data-source-start/data-source-end attributes that
    Y.RelativePosition annotation anchors depend on. Without these, every
    keyboard-shortcut annotation silently fails after the first compile."""
    captured = {}

    def fake_render(src, handrails=True, add_source=False, asset_resolver=None):
        captured["add_source"] = add_source
        captured["handrails"] = handrails
        return "<p>OK</p>"

    monkeypatch.setattr(rsm, "render", fake_render)
    asyncio.run(render("src"))
    assert captured["add_source"] is True
    assert captured["handrails"] is True
