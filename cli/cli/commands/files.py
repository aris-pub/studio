"""File listing command."""

import sys

import click
import requests
from rich.table import Table

from cli.core import StudioAPI, console


@click.command()
def files() -> None:
    """List all files for the logged-in user."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    try:
        user_data = api.get_me()
        user_files = api.get_files(user_data["id"])

        if not user_files:
            console.print("[yellow]No files found.[/yellow]")
            return

        table = Table(title=f"Files for {user_data['name']}")
        table.add_column("ID", style="cyan", width=8)
        table.add_column("Title", style="green")
        table.add_column("Last Edited", style="yellow")

        for file in user_files:
            table.add_row(
                str(file["id"]),
                file["title"],
                file.get("last_edited_at", "Never"),
            )

        console.print(table)

    except requests.HTTPError as e:
        console.print(f"[red]✗ API error: {e.response.text}[/red]")
        sys.exit(1)
    except requests.RequestException as e:
        console.print(f"[red]✗ Network error: {e}[/red]")
        sys.exit(1)
