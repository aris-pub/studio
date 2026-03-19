"""Skill command: install Claude Code skills for Studio and RSM."""

from importlib import resources
from pathlib import Path

import click
import requests

from cli.core import console

RSM_SKILL_URL = "https://raw.githubusercontent.com/aris-pub/rsm/main/docs/rsm-agent-skill.md"


def _load_collab_skill() -> str:
    """Load the studio-collab skill from package data."""
    return resources.files("cli.data").joinpath("studio-collab.md").read_text()


def _fetch_rsm_skill() -> str | None:
    """Fetch the rsm-authoring skill from GitHub."""
    try:
        resp = requests.get(RSM_SKILL_URL, timeout=10)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException:
        return None


def _install_skill(base: Path, name: str, content: str) -> None:
    target_dir = base / name
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / "SKILL.md").write_text(content)
    console.print(f"[green]Installed {name} → {target_dir / 'SKILL.md'}[/green]")


@click.command()
@click.option("--user", is_flag=True, help="Install at user level (~/.claude/skills/) instead of project level")
def skill(user: bool) -> None:
    """Install the studio-collab and rsm-authoring skills for Claude Code."""
    base = Path.home() / ".claude" / "skills" if user else Path(".claude") / "skills"

    _install_skill(base, "studio-collab", _load_collab_skill())

    rsm_content = _fetch_rsm_skill()
    if rsm_content:
        _install_skill(base, "rsm-authoring", rsm_content)
    else:
        console.print("[yellow]Failed to fetch rsm-authoring skill from GitHub[/yellow]")
