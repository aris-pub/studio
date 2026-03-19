"""RSM Studio CLI — collaborate on RSM documents from the command line."""

import click

from cli.commands.assets import assets
from cli.commands.auth import login, logout, session_cmd
from cli.commands.comments import comments
from cli.commands.edit import edit
from cli.commands.file_group import file_cmd
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


# Top-level commands
cli.add_command(login)
cli.add_command(logout)
cli.add_command(session_cmd, "session")
cli.add_command(files)
cli.add_command(skill)
cli.add_command(ui)
cli.add_command(watch)

# File subcommand group: studio file <id> [read|edit|comments|reply|resolve]
file_cmd.add_command(read)
file_cmd.add_command(edit)
file_cmd.add_command(comments)
file_cmd.add_command(reply)
file_cmd.add_command(resolve)
file_cmd.add_command(assets)
cli.add_command(file_cmd, "file")


def main() -> None:
    """Entry point for the CLI."""
    cli()
