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


class TestHealthCheck:
    script = _read("docker/health-check.sh")

    def test_checks_all_services(self):
        checks = re.findall(r'check_service\s+"(\w+)"', self.script)
        assert set(checks) == {"backend", "multiplayer", "lsp"}

    def test_no_lsp_exclusion_comment(self):
        assert "LSP excluded" not in self.script
