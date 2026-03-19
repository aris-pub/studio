"""RSM Studio CLI — collaborate on RSM documents from the command line."""

import click

from cli.commands.auth import login, logout, session_cmd
from cli.commands.comments import comments
from cli.commands.edit import edit
from cli.commands.files import files
from cli.commands.read import read
from cli.commands.reply import reply
from cli.commands.resolve import resolve
from cli.commands.skill import skill
from cli.commands.ui import ui
from cli.commands.watch import watch


@click.group()
def cli() -> None:
    """RSM Studio CLI — collaborate on RSM documents from the command line."""


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
cli.add_command(skill)


def main() -> None:
    """Entry point for the CLI."""
    cli()
