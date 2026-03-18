"""Reply command: post a message to an annotation thread."""

import json
import sys

import click
import requests

from cli.core import StudioAPI, console


@click.command()
@click.argument("annotation_id", type=int)
@click.argument("message", required=False)
@click.option("--stdin", "from_stdin", is_flag=True, help="Read message from stdin")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def reply(annotation_id: int, message: str | None, from_stdin: bool, as_json: bool) -> None:
    """Reply to an annotation thread."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    if from_stdin:
        message = click.get_text_stream("stdin").read().strip()

    if not message:
        console.print("[red]✗ Provide a message argument or use --stdin.[/red]")
        sys.exit(1)

    try:
        response = requests.post(
            f"{api.base_url}/annotations/{annotation_id}/messages",
            headers=api._get_headers(),
            json={"content": message},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        if as_json:
            console.print(json.dumps(data, indent=2))
        else:
            console.print(f"[green]✓ Message posted (id={data['id']})[/green]")
            console.print(f"  [dim]{data['content']}[/dim]")

    except requests.HTTPError as e:
        console.print(f"[red]✗ API error: {e.response.text}[/red]")
        sys.exit(1)
    except requests.RequestException as e:
        console.print(f"[red]✗ Network error: {e}[/red]")
        sys.exit(1)
