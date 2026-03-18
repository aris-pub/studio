"""Comments command: one-shot list of annotations and threads."""

import json
import sys
from datetime import datetime

import click
import requests
from rich.table import Table
from rich.text import Text

from cli.core import StudioAPI, console


@click.command()
@click.argument("file_id", type=int)
@click.option("--since", type=str, help="Only show annotations after this ISO8601 timestamp")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def comments(file_id: int, since: str | None, as_json: bool) -> None:
    """List annotations and comment threads for a file."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    try:
        annotations = api.get_annotations(file_id)
    except requests.HTTPError as e:
        console.print(f"[red]✗ API error: {e.response.text}[/red]")
        sys.exit(1)
    except requests.RequestException as e:
        console.print(f"[red]✗ Network error: {e}[/red]")
        sys.exit(1)

    if since:
        cutoff = datetime.fromisoformat(since)
        annotations = [a for a in annotations if datetime.fromisoformat(a["created_at"]) >= cutoff]

    if not annotations:
        console.print("[yellow]No annotations found.[/yellow]")
        return

    if as_json:
        click.echo(json.dumps(annotations, indent=2))
        return

    for ann in annotations:
        owner_name = ann["owner"]["name"] if ann.get("owner") else "Unknown"
        header = Text()
        header.append(f"#{ann['id']} ", style="cyan bold")
        header.append(f'"{ann["selected_text"]}" ', style="green")
        header.append(f"by {owner_name} ", style="yellow")
        header.append(f"({ann['created_at']})", style="dim")
        console.print(header)

        messages = ann.get("messages", [])
        if messages:
            table = Table(show_header=False, box=None, padding=(0, 1))
            table.add_column("Author", style="yellow", width=12)
            table.add_column("Message")
            table.add_column("Time", style="dim", width=20)

            for msg in messages:
                msg_owner = msg["owner"]["name"] if msg.get("owner") else "Unknown"
                table.add_row(msg_owner, msg["content"], msg["created_at"])

            console.print(table)

        console.print()
