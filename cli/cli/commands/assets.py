"""Assets subgroup: studio file <file_id> assets [create|edit|delete]."""

import base64
import json
import mimetypes
import sys
from pathlib import Path

import click
import requests
from rich.table import Table

from cli.core import StudioAPI, console


@click.group(invoke_without_command=True)
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
@click.pass_context
def assets(ctx: click.Context, as_json: bool) -> None:
    """List or manage file assets."""
    if ctx.invoked_subcommand is not None:
        return

    file_id: int = ctx.obj["file_id"]
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    try:
        response = requests.get(
            f"{api.base_url}/files/{file_id}/assets",
            headers=api._get_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        console.print(f"[red]✗ Error: {e}[/red]")
        sys.exit(1)

    if as_json:
        click.echo(json.dumps(data, indent=2))
        return

    if not data:
        console.print("[yellow]No assets found.[/yellow]")
        return

    table = Table(title=f"Assets for file {file_id}")
    table.add_column("ID", style="cyan", width=6)
    table.add_column("Filename", style="green")
    table.add_column("Type", style="yellow")
    table.add_column("Encoding", style="dim")

    for asset in data:
        table.add_row(
            str(asset["id"]),
            asset["filename"],
            asset.get("mime_type", ""),
            asset.get("content_encoding", ""),
        )

    console.print(table)


def _is_text_file(path: Path) -> bool:
    """Guess whether a file is text based on mime type."""
    mime, _ = mimetypes.guess_type(str(path))
    if mime is None:
        return True
    return mime.startswith("text/") or mime in (
        "application/json",
        "application/xml",
        "application/javascript",
        "image/svg+xml",
    )


@assets.command()
@click.option("--file", "file_path", required=True, type=click.Path(exists=True), help="File to upload")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
@click.pass_context
def create(ctx: click.Context, file_path: str, as_json: bool) -> None:
    """Upload a new asset."""
    file_id: int = ctx.obj["file_id"]
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    path = Path(file_path)
    mime, _ = mimetypes.guess_type(str(path))
    mime = mime or "application/octet-stream"

    if _is_text_file(path):
        content = path.read_text()
        encoding = "plain"
    else:
        content = base64.b64encode(path.read_bytes()).decode()
        encoding = "base64"

    try:
        response = requests.post(
            f"{api.base_url}/files/{file_id}/assets",
            headers=api._get_headers(),
            json={
                "filename": path.name,
                "mime_type": mime,
                "content": content,
                "content_encoding": encoding,
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        console.print(f"[red]✗ Error: {e}[/red]")
        sys.exit(1)

    if as_json:
        click.echo(json.dumps(data, indent=2))
    else:
        console.print(f"[green]✓ Uploaded {path.name} (id={data['id']})[/green]")


@assets.command()
@click.argument("asset_id", type=int)
@click.option("--source", "-s", required=True, type=click.Path(exists=True), help="New file content")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
@click.pass_context
def edit(ctx: click.Context, asset_id: int, source: str, as_json: bool) -> None:
    """Update an asset's content."""
    file_id: int = ctx.obj["file_id"]
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    path = Path(source)

    if _is_text_file(path):
        content = path.read_text()
        encoding = "plain"
    else:
        content = base64.b64encode(path.read_bytes()).decode()
        encoding = "base64"

    try:
        response = requests.put(
            f"{api.base_url}/files/{file_id}/assets/{asset_id}",
            headers=api._get_headers(),
            json={
                "content": content,
                "content_encoding": encoding,
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        console.print(f"[red]✗ Error: {e}[/red]")
        sys.exit(1)

    if as_json:
        click.echo(json.dumps(data, indent=2))
    else:
        console.print(f"[green]✓ Updated asset {asset_id}[/green]")


@assets.command()
@click.argument("asset_id", type=int)
@click.pass_context
def delete(ctx: click.Context, asset_id: int) -> None:
    """Delete an asset."""
    file_id: int = ctx.obj["file_id"]
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    try:
        response = requests.delete(
            f"{api.base_url}/files/{file_id}/assets/{asset_id}",
            headers=api._get_headers(),
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as e:
        console.print(f"[red]✗ Error: {e}[/red]")
        sys.exit(1)

    console.print(f"[green]✓ Deleted asset {asset_id}[/green]")
