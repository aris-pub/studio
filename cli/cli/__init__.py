"""RSM Studio CLI - Developer tool for local development.

CRITICAL: This tool ONLY works in LOCAL development environment.
It will refuse to run in PROD, CI, or STAGING environments.
"""

import click

from cli.commands.auth import login, logout, session_cmd
from cli.commands.comments import comments
from cli.commands.edit import edit
from cli.commands.files import files
from cli.commands.read import read
from cli.commands.reply import reply
from cli.commands.resolve import resolve
from cli.commands.ui import ui
from cli.commands.watch import watch
from cli.core import check_environment


@click.group()
def cli() -> None:
    """RSM Studio CLI - Developer tool for local development."""
    check_environment()


# Existing commands
cli.add_command(login)
cli.add_command(logout)
cli.add_command(session_cmd, "session")
cli.add_command(files)
cli.add_command(ui)

# Agent-facing commands
cli.add_command(read)
cli.add_command(edit)
cli.add_command(comments)
cli.add_command(watch)
cli.add_command(reply)
cli.add_command(resolve)


def main() -> None:
    """Entry point for the CLI."""
    cli()
