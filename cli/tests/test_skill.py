"""Tests for studio skill command — install the collaboration skill."""

from pathlib import Path
from unittest.mock import patch

import responses
from click.testing import CliRunner

from cli import cli


class TestSkillCommand:
    """Test skill installation."""

    @responses.activate
    def test_installs_both_skills(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "https://raw.githubusercontent.com/aris-pub/rsm/main/docs/rsm-agent-skill.md",
            body="---\nname: rsm-authoring\n---\n# RSM Skill\n:theorem: test\n:proof: test\n## Common Mistakes\n",
            status=200,
        )

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            result = runner.invoke(cli, ["skill"])

            assert result.exit_code == 0
            collab = Path(".claude/skills/studio-collab/SKILL.md")
            rsm = Path(".claude/skills/rsm-authoring/SKILL.md")
            assert collab.exists()
            assert rsm.exists()
            assert "studio-collab" in collab.read_text()
            assert "rsm-authoring" in rsm.read_text()

    @responses.activate
    def test_installs_to_user_level(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "https://raw.githubusercontent.com/aris-pub/rsm/main/docs/rsm-agent-skill.md",
            body="---\nname: rsm-authoring\n---\n# RSM\n",
            status=200,
        )

        runner = CliRunner()
        fake_home = tmp_path / "home"
        fake_home.mkdir()

        with runner.isolated_filesystem(temp_dir=tmp_path):
            with patch("cli.commands.skill.Path.home", return_value=fake_home):
                result = runner.invoke(cli, ["skill", "--user"])

            assert result.exit_code == 0
            collab = fake_home / ".claude" / "skills" / "studio-collab" / "SKILL.md"
            rsm = fake_home / ".claude" / "skills" / "rsm-authoring" / "SKILL.md"
            assert collab.exists()
            assert rsm.exists()

    @responses.activate
    def test_overwrites_existing(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "https://raw.githubusercontent.com/aris-pub/rsm/main/docs/rsm-agent-skill.md",
            body="---\nname: rsm-authoring\n---\n# RSM\n",
            status=200,
        )

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            runner.invoke(cli, ["skill"])
            responses.reset()
            responses.add(
                responses.GET,
                "https://raw.githubusercontent.com/aris-pub/rsm/main/docs/rsm-agent-skill.md",
                body="---\nname: rsm-authoring\n---\n# RSM\n",
                status=200,
            )
            result = runner.invoke(cli, ["skill"])

            assert result.exit_code == 0
            assert "Installed" in result.output

    @responses.activate
    def test_collab_skill_content(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "https://raw.githubusercontent.com/aris-pub/rsm/main/docs/rsm-agent-skill.md",
            body="---\nname: rsm-authoring\n---\n# RSM\n",
            status=200,
        )

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            runner.invoke(cli, ["skill"])

            content = Path(".claude/skills/studio-collab/SKILL.md").read_text()
            assert content.startswith("---")
            assert "name: studio-collab" in content
            assert "## Commands Reference" in content
            assert "studio login" in content
            assert "studio edit" in content

    @responses.activate
    def test_rsm_skill_fetched_from_github(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "https://raw.githubusercontent.com/aris-pub/rsm/main/docs/rsm-agent-skill.md",
            body="---\nname: rsm-authoring\n---\n# RSM Skill\n:theorem: test\n:proof: test\n## Common Mistakes\n",
            status=200,
        )

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            runner.invoke(cli, ["skill"])

            content = Path(".claude/skills/rsm-authoring/SKILL.md").read_text()
            assert "rsm-authoring" in content

    @responses.activate
    def test_rsm_skill_fetch_failure_warns(self, tmp_path: Path) -> None:
        responses.add(
            responses.GET,
            "https://raw.githubusercontent.com/aris-pub/rsm/main/docs/rsm-agent-skill.md",
            status=404,
        )

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            result = runner.invoke(cli, ["skill"])

            assert result.exit_code == 0
            assert Path(".claude/skills/studio-collab/SKILL.md").exists()
            assert not Path(".claude/skills/rsm-authoring/SKILL.md").exists()
            assert "Failed" in result.output
