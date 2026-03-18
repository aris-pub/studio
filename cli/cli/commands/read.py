"""Read command: connect to Y.js, read document source, disconnect."""

import asyncio
import json
import sys
from pathlib import Path

import click
from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from rich.console import Console
from websockets import connect as ws_connect

from cli.core import StudioAPI, get_multiplayer_url

console = Console()


async def _read_ydoc(file_id: int, ws_url: str) -> str:
    """Connect to Y.js WebSocket, sync YDoc, return text content."""
    room_url = f"{ws_url}/{file_id}"

    doc = Doc()
    text = doc.get("text", type=Text)

    async with ws_connect(room_url, open_timeout=10, close_timeout=5) as websocket:
        sync_message = create_sync_message(doc)
        await websocket.send(sync_message)

        # Receive until we get SyncStep2 (sub-type 1)
        while True:
            message = await asyncio.wait_for(websocket.recv(), timeout=15.0)
            if not message:
                continue

            msg_type = message[0]
            payload = message[1:]

            if msg_type == 0:  # Sync message
                reply = handle_sync_message(payload, doc)
                if reply:
                    await websocket.send(reply)

                if payload and payload[0] == 1:  # SyncStep2
                    break

    return str(text)


@click.command()
@click.argument("file_id", type=int)
@click.option("--output", "-o", type=click.Path(), help="Write source to file instead of stdout")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def read(file_id: int, output: str | None, as_json: bool) -> None:
    """Read current document source via Y.js."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    ws_url = get_multiplayer_url()

    try:
        content = asyncio.run(_read_ydoc(file_id, ws_url))
    except Exception as e:
        console.print(f"[red]✗ Failed to read file {file_id}: {e}[/red]")
        sys.exit(1)

    if output:
        Path(output).write_text(content)
        console.print(f"[green]✓ Written to {output}[/green]")
    elif as_json:
        print(json.dumps({"file_id": file_id, "content": content}))
    else:
        print(content)
