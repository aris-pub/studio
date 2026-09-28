"""Unit tests for HMAC-signed, cache-stable asset URL tokens (std-b4v9, std-do5t).

The rendered-manuscript asset endpoint is fetched by plain browser <img> tags that
cannot carry a bearer token, so access is proved by a short-lived HMAC signature
instead of a session. std-do5t additionally makes the URL cache-stable: the signed
query is byte-identical across renders for an unchanged asset within a time window,
so the browser stops refetching every image on every debounced recompile.

The URL query is `v={content_version}&exp={quantized}&sig={hmac}` where:
- v is a keyed, per-file content identifier that changes iff the bytes change,
- exp is quantized to a coarse step so it is constant within a window (bounded to
  the TTL), which is what keeps the URL stable across renders,
- sig binds file_id, filename, v, and exp, and is verified by pure HMAC recompute
  over the URL-supplied values (no DB read), so there is no existence oracle.
"""

import base64
import hashlib
import time

from aris.asset_signing import (
    ASSET_URL_STEP_SECONDS,
    ASSET_URL_TTL_SECONDS,
    asset_etag,
    compute_content_hash,
    content_version,
    sign_asset_path,
    verify_asset_signature,
)


HASH_A = "a" * 64  # stand-in content hashes; only their equality/inequality matters
HASH_B = "b" * 64


def _parse(qs: str) -> tuple[str, int, str]:
    parts = dict(p.split("=", 1) for p in qs.split("&"))
    return parts["v"], int(parts["exp"]), parts["sig"]


class TestQuantizedExp:
    def test_bounded_between_ttl_minus_step_and_ttl(self):
        # A freshly minted URL is valid for at most TTL and at least TTL - STEP.
        for now in (0, 1, ASSET_URL_STEP_SECONDS - 1, 10_000, 1_700_000_000):
            _, exp, _ = _parse(sign_asset_path(1, "a.png", HASH_A, now=now))
            remaining = exp - now
            assert ASSET_URL_TTL_SECONDS - ASSET_URL_STEP_SECONDS < remaining <= ASSET_URL_TTL_SECONDS

    def test_exp_is_the_quantized_issue_plus_ttl(self):
        now = 1_700_000_123
        _, exp, _ = _parse(sign_asset_path(1, "a.png", HASH_A, now=now))
        issue = (now // ASSET_URL_STEP_SECONDS) * ASSET_URL_STEP_SECONDS
        assert exp == issue + ASSET_URL_TTL_SECONDS

    def test_constant_within_a_step_window(self):
        base = (1_700_000_000 // ASSET_URL_STEP_SECONDS) * ASSET_URL_STEP_SECONDS
        _, exp_start, _ = _parse(sign_asset_path(1, "a.png", HASH_A, now=base))
        _, exp_mid, _ = _parse(sign_asset_path(1, "a.png", HASH_A, now=base + ASSET_URL_STEP_SECONDS - 1))
        assert exp_start == exp_mid

    def test_advances_by_one_step_across_the_boundary(self):
        base = (1_700_000_000 // ASSET_URL_STEP_SECONDS) * ASSET_URL_STEP_SECONDS
        _, exp_before, _ = _parse(sign_asset_path(1, "a.png", HASH_A, now=base + ASSET_URL_STEP_SECONDS - 1))
        _, exp_after, _ = _parse(sign_asset_path(1, "a.png", HASH_A, now=base + ASSET_URL_STEP_SECONDS))
        assert exp_after - exp_before == ASSET_URL_STEP_SECONDS


class TestCacheStability:
    def test_identical_url_for_same_asset_within_window(self):
        # THE core std-do5t property: the same asset signed twice in the same
        # window produces a byte-identical query, so the browser cache-key is
        # stable and the image is not refetched on every recompile.
        base = (1_700_000_000 // ASSET_URL_STEP_SECONDS) * ASSET_URL_STEP_SECONDS
        first = sign_asset_path(42, "chart.png", HASH_A, now=base + 3)
        second = sign_asset_path(42, "chart.png", HASH_A, now=base + ASSET_URL_STEP_SECONDS - 5)
        assert first == second

    def test_content_change_busts_the_url(self):
        base = (1_700_000_000 // ASSET_URL_STEP_SECONDS) * ASSET_URL_STEP_SECONDS
        unchanged = sign_asset_path(42, "chart.png", HASH_A, now=base)
        changed = sign_asset_path(42, "chart.png", HASH_B, now=base)
        assert unchanged != changed
        v_unchanged, _, _ = _parse(unchanged)
        v_changed, _, _ = _parse(changed)
        assert v_unchanged != v_changed


class TestContentVersion:
    def test_is_keyed_not_a_raw_content_hash(self):
        # The exposed v must NOT be the raw content hash, or it would be a
        # precomputable global fingerprint of the bytes.
        assert content_version(1, "a.png", HASH_A) != HASH_A

    def test_is_per_file_and_per_filename(self):
        # The same bytes under a different file or filename yield a different v,
        # so an outsider cannot correlate that two documents share an image.
        v = content_version(1, "a.png", HASH_A)
        assert content_version(2, "a.png", HASH_A) != v
        assert content_version(1, "b.png", HASH_A) != v

    def test_changes_only_with_content(self):
        assert content_version(1, "a.png", HASH_A) == content_version(1, "a.png", HASH_A)
        assert content_version(1, "a.png", HASH_A) != content_version(1, "a.png", HASH_B)

    def test_asset_etag_matches_content_version(self):
        assert asset_etag(7, "x.png", HASH_A) == content_version(7, "x.png", HASH_A)


class TestComputeContentHash:
    def test_hashes_decoded_bytes(self):
        raw = b"hello world bytes"
        b64 = base64.b64encode(raw).decode()
        expected = hashlib.sha256(raw).hexdigest()
        assert compute_content_hash(b64, "base64") == expected
        assert compute_content_hash(raw.decode(), "plain") == expected

    def test_same_bytes_same_hash_regardless_of_encoding(self):
        raw = b"<svg>identical</svg>"
        b64 = base64.b64encode(raw).decode()
        assert compute_content_hash(b64, "base64") == compute_content_hash(raw.decode(), "plain")

    def test_different_bytes_differ(self):
        assert compute_content_hash("one", "plain") != compute_content_hash("two", "plain")


class TestVerify:
    def test_sign_then_verify_roundtrips(self):
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A))
        assert verify_asset_signature(42, "chart.png", v, exp, sig) is True

    def test_sig_is_sha256_hex(self):
        _, _, sig = _parse(sign_asset_path(1, "a.png", HASH_A))
        assert len(sig) == 64

    def test_tampered_sig_fails(self):
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A))
        flipped = sig[:-1] + ("0" if sig[-1] != "0" else "1")
        assert verify_asset_signature(42, "chart.png", v, exp, flipped) is False

    def test_tampered_v_fails(self):
        # Swapping in a different content version invalidates the signature, so a
        # client cannot forge a v the renderer never minted.
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A))
        other_v = content_version(42, "chart.png", HASH_B)
        assert verify_asset_signature(42, "chart.png", other_v, exp, sig) is False

    def test_tampered_exp_fails(self):
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A))
        assert verify_asset_signature(42, "chart.png", v, exp + 1, sig) is False

    def test_wrong_file_id_fails(self):
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A))
        assert verify_asset_signature(43, "chart.png", v, exp, sig) is False

    def test_wrong_filename_fails(self):
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A))
        assert verify_asset_signature(42, "secret.png", v, exp, sig) is False

    def test_expired_fails(self):
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A))
        assert verify_asset_signature(42, "chart.png", v, exp, sig, now=exp + 1) is False

    def test_valid_at_expiry_boundary(self):
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A))
        assert verify_asset_signature(42, "chart.png", v, exp, sig, now=exp) is True

    def test_empty_sig_fails(self):
        v, exp, _ = _parse(sign_asset_path(42, "chart.png", HASH_A))
        assert verify_asset_signature(42, "chart.png", v, exp, "") is False

    def test_past_now_produces_already_expired_token(self):
        # Used by the endpoint tests to exercise the expiry branch over HTTP:
        # signing far enough in the past yields an exp already behind real time.
        past = int(time.time()) - (ASSET_URL_TTL_SECONDS + ASSET_URL_STEP_SECONDS + 10)
        v, exp, sig = _parse(sign_asset_path(42, "chart.png", HASH_A, now=past))
        assert exp < int(time.time())
        assert verify_asset_signature(42, "chart.png", v, exp, sig) is False


class TestBounds:
    def test_ttl_bounded(self):
        assert 300 <= ASSET_URL_TTL_SECONDS <= 3600

    def test_step_is_positive_and_at_most_ttl(self):
        # The step is the leak-ceiling floor and the cache-bust cadence; it must be
        # a real window and never exceed the TTL (Security requirement).
        assert 0 < ASSET_URL_STEP_SECONDS <= ASSET_URL_TTL_SECONDS
