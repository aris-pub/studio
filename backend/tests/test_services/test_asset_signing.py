"""Unit tests for HMAC-signed asset URL tokens (std-b4v9).

The rendered-manuscript asset endpoint is fetched by plain browser <img> tags
that cannot carry a bearer token, so access is proved by a short-lived HMAC
signature bound to (file_id, filename, exp) instead of a session.
"""

import time

from aris.asset_signing import (
    ASSET_URL_TTL_SECONDS,
    sign_asset_path,
    verify_asset_signature,
)


def _parse(qs: str) -> tuple[int, str]:
    parts = dict(p.split("=", 1) for p in qs.split("&"))
    return int(parts["exp"]), parts["sig"]


class TestAssetSigning:
    def test_sign_then_verify_roundtrips(self):
        exp, sig = _parse(sign_asset_path(42, "chart.png"))
        assert verify_asset_signature(42, "chart.png", exp, sig) is True

    def test_sign_emits_future_exp_and_sha256_sig(self):
        exp, sig = _parse(sign_asset_path(1, "a.png"))
        assert exp > int(time.time())
        assert len(sig) == 64  # sha256 hex digest

    def test_tampered_signature_fails(self):
        exp, sig = _parse(sign_asset_path(42, "chart.png"))
        flipped = sig[:-1] + ("0" if sig[-1] != "0" else "1")
        assert verify_asset_signature(42, "chart.png", exp, flipped) is False

    def test_wrong_file_id_fails(self):
        # A token minted for file 42 must not verify for file 43 (cross-file replay).
        exp, sig = _parse(sign_asset_path(42, "chart.png"))
        assert verify_asset_signature(43, "chart.png", exp, sig) is False

    def test_wrong_filename_fails(self):
        # A token for chart.png must not unlock a different asset on the same file.
        exp, sig = _parse(sign_asset_path(42, "chart.png"))
        assert verify_asset_signature(42, "secret.png", exp, sig) is False

    def test_expired_token_fails(self):
        exp, sig = _parse(sign_asset_path(42, "chart.png"))
        assert verify_asset_signature(42, "chart.png", exp, sig, now=exp + 1) is False

    def test_valid_at_expiry_boundary(self):
        exp, sig = _parse(sign_asset_path(42, "chart.png"))
        assert verify_asset_signature(42, "chart.png", exp, sig, now=exp) is True

    def test_empty_signature_fails(self):
        exp, _ = _parse(sign_asset_path(42, "chart.png"))
        assert verify_asset_signature(42, "chart.png", exp, "") is False

    def test_negative_ttl_produces_already_expired_token(self):
        # Used by the endpoint tests to exercise the expiry branch over HTTP.
        exp, sig = _parse(sign_asset_path(42, "chart.png", ttl_seconds=-10))
        assert exp < int(time.time())
        assert verify_asset_signature(42, "chart.png", exp, sig) is False

    def test_default_ttl_is_bounded(self):
        assert 300 <= ASSET_URL_TTL_SECONDS <= 3600
