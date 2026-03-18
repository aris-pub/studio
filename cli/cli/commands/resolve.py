"""Resolve command: soft-delete an annotation."""

import json
import sys

import click
import requests

from cli.core import StudioAPI, console


@click.command()
@click.argument("annotation_id", type=int)
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def resolve(annotation_id: int, as_json: bool) -> None:
    """Mark an annotation as resolved (soft-delete)."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    try:
        api.delete_annotation(annotation_id)

        if as_json:
            click.echo(json.dumps({"annotation_id": annotation_id, "status": "resolved"}))
        else:
            console.print(f"[green]✓ Resolved annotation {annotation_id}[/green]")

    except requests.HTTPError as e:
        if e.response.status_code == 404:
            if as_json:
                click.echo(json.dumps({"annotation_id": annotation_id, "status": "already_resolved"}))
            else:
                console.print(f"[yellow]Annotation {annotation_id} already resolved or not found.[/yellow]")
            return

        console.print(f"[red]✗ API error: {e.response.text}[/red]")
        sys.exit(1)
    except requests.RequestException as e:
        console.print(f"[red]✗ Network error: {e}[/red]")
        sys.exit(1)
