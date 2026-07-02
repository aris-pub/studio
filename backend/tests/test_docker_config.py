"""Validate Docker infrastructure files for production deployment.

These tests ensure the Dockerfile, supervisord.conf, and health-check.sh
stay consistent with each other — e.g. all managed services are health-checked,
native bindings are compiled from source, and symlinks are replaced with real copies.
"""

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def _read(relpath: str) -> str:
    return (REPO_ROOT / relpath).read_text()


class TestDockerfile:
    dockerfile = _read("backend/Dockerfile")

    def test_node_builder_has_build_tools(self):
        assert "build-essential" in self.dockerfile
        assert "python3" in self.dockerfile

    def test_tree_sitter_rsm_compiled_from_source(self):
        assert "rm -rf prebuilds build" in self.dockerfile
        assert "node-gyp rebuild" in self.dockerfile

    def test_symlink_replaced_with_copy(self):
        assert "cp -r" in self.dockerfile
        assert "rm -rf rsm/packages/rsm-lsp/node_modules/tree-sitter-rsm" in self.dockerfile

    def test_rsm_lsp_copied_to_runtime(self):
        assert "COPY --from=node-builder /build/rsm/packages/rsm-lsp /app/rsm-lsp" in self.dockerfile

    def test_no_separate_tree_sitter_copy_to_runtime(self):
        """tree-sitter-rsm should be embedded in rsm-lsp/node_modules, not copied separately."""
        runtime_copies = [
            line for line in self.dockerfile.splitlines()
            if "COPY --from=node-builder" in line and "tree-sitter-rsm" in line
        ]
        assert len(runtime_copies) == 0


class TestSupervisordConf:
    conf = _read("docker/supervisord.conf")

    def test_has_required_sections(self):
        for section in ["unix_http_server", "rpcinterface:supervisor", "supervisorctl"]:
            assert f"[{section}]" in self.conf

    def test_manages_all_services(self):
        for service in ["backend", "multiplayer", "lsp"]:
            assert f"[program:{service}]" in self.conf

    def test_lsp_points_to_correct_path(self):
        assert "/app/rsm-lsp/dist/server.js" in self.conf

    def _multiplayer_env_line(self) -> str:
        """Return the `environment=...` line of the multiplayer program."""
        in_multiplayer = False
        for line in self.conf.splitlines():
            stripped = line.strip()
            if stripped == "[program:multiplayer]":
                in_multiplayer = True
                continue
            if in_multiplayer and stripped.startswith("[") and stripped.endswith("]"):
                break
            if in_multiplayer and stripped.startswith("environment="):
                return stripped
        raise AssertionError("[program:multiplayer] has no environment= directive")

    def test_multiplayer_env_forwards_internal_shared_secret(self):
        """supervisord's `environment=` replaces the inherited env wholesale,
        so INTERNAL_SHARED_SECRET (the JWT-verify key for the WS auth
        handshake) MUST be forwarded explicitly. Without it, every WS
        connection 4401s and the editor goes offline.
        """
        env_line = self._multiplayer_env_line()
        assert "INTERNAL_SHARED_SECRET=" in env_line, (
            "supervisord.conf [program:multiplayer] must forward "
            "INTERNAL_SHARED_SECRET — without it the JWT auth handshake "
            "fails for every WS client. See PR #405."
        )
        assert "%(ENV_INTERNAL_SHARED_SECRET)s" in env_line, (
            "INTERNAL_SHARED_SECRET must reference the parent-env value via "
            "supervisord's %(ENV_*)s interpolation, not be hardcoded."
        )

    def test_multiplayer_env_forwards_backend_internal_url(self):
        """multiplayer's auto-bootstrap calls POST /internal/collab/start on
        the local backend. Without BACKEND_INTERNAL_URL it falls back to the
        dev-only http://localhost:8000; in prod the backend listens on 8080.
        """
        env_line = self._multiplayer_env_line()
        assert "BACKEND_INTERNAL_URL=" in env_line, (
            "supervisord.conf [program:multiplayer] must set "
            "BACKEND_INTERNAL_URL — the server.js default fallback points "
            "at the wrong port for prod."
        )
        assert "localhost:8080" in env_line, (
            "BACKEND_INTERNAL_URL must point at the prod backend port (8080)."
        )


class TestFlyToml:
    fly = _read("backend/fly.toml")

    def test_multiplayer_port_has_tls_handler(self):
        """The frontend builds with VITE_MULTIPLAYER_URL=wss://...:1234, so
        Fly's edge MUST terminate TLS on port 1234. Without the tls handler,
        the wss:// handshake fails with `wrong version number` and the
        editor never goes online.
        """
        # Find the [[services]] block whose internal_port is 1234, then its
        # [[services.ports]] sub-block, and assert handlers includes "tls".
        in_block = False
        in_port_block = False
        handlers_line: str | None = None
        for line in self.fly.splitlines():
            stripped = line.strip()
            if stripped.startswith("[[services]]"):
                in_block = False
                in_port_block = False
            if "internal_port = 1234" in stripped:
                in_block = True
            if in_block and stripped.startswith("[[services.ports]]"):
                in_port_block = True
                continue
            if in_port_block and stripped.startswith("handlers"):
                handlers_line = stripped
                break

        assert handlers_line is not None, (
            "backend/fly.toml port 1234 has no `handlers = [...]` directive. "
            'Add `handlers = ["tls", "http"]` so Fly\'s edge terminates TLS '
            "for the wss:// multiplayer URL."
        )
        assert "tls" in handlers_line, (
            f'port 1234 handlers must include "tls", got: {handlers_line!r}'
        )


class TestNetlifyPreviewRedirects:
    """The per-PR preview (.github/workflows/preview.yml) uploads the prebuilt
    frontend/dist directly via nwtgck/actions-netlify. That path does NOT read
    netlify.toml, so the SPA history-mode fallback must ship as a `_redirects`
    file inside the published bundle. Vite copies public/ verbatim into dist/,
    so public/_redirects is the file that lands in the upload. Without it,
    reloading any client-side route on the preview 404s. See PR #405.
    """

    def test_public_redirects_file_exists(self):
        path = REPO_ROOT / "frontend" / "public" / "_redirects"
        assert path.exists(), (
            "frontend/public/_redirects is missing — the per-PR preview deploy "
            "(direct dist/ upload) won't get the SPA fallback and every route "
            "404s on reload."
        )

    def test_public_redirects_has_spa_fallback(self):
        body = _read("frontend/public/_redirects")
        rule = next(
            (
                line
                for line in body.splitlines()
                if line.strip() and not line.strip().startswith("#")
            ),
            None,
        )
        assert rule is not None, "frontend/public/_redirects has no redirect rule"
        fields = rule.split()
        assert fields[:2] == ["/*", "/index.html"], (
            f"SPA fallback must rewrite /* to /index.html, got: {rule!r}"
        )
        assert "200" in fields, (
            f"SPA fallback must be a 200 rewrite (not a 301/302), got: {rule!r}"
        )


class TestHealthCheck:
    script = _read("docker/health-check.sh")

    def test_checks_all_services(self):
        checks = re.findall(r'check_service\s+"(\w+)"', self.script)
        assert set(checks) == {"backend", "multiplayer", "lsp"}

    def test_no_lsp_exclusion_comment(self):
        assert "LSP excluded" not in self.script
