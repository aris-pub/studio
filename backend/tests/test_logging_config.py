"""Tests for logging configuration level resolution."""

import pytest

from aris.logging_config import _resolve_log_level


@pytest.mark.parametrize(
    "env, ci, expected",
    [
        ("PROD", None, "INFO"),
        ("STAGING", None, "INFO"),
        ("CI", None, "INFO"),
        ("LOCAL", "true", "INFO"),
        ("LOCAL", None, "DEBUG"),
    ],
)
def test_resolve_log_level(monkeypatch, env, ci, expected):
    monkeypatch.setenv("ENV", env)
    if ci is None:
        monkeypatch.delenv("CI", raising=False)
    else:
        monkeypatch.setenv("CI", ci)
    assert _resolve_log_level() == expected


def test_prod_never_resolves_to_debug(monkeypatch):
    """PROD at DEBUG would leak verbose diagnostics/PII to prod logs and Sentry."""
    monkeypatch.setenv("ENV", "PROD")
    monkeypatch.delenv("CI", raising=False)
    assert _resolve_log_level() != "DEBUG"
