"""Edit command: connect to Y.js, apply source changes, disconnect."""

import asyncio
import json
import os
import sys
from typing import Any

import click
from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from pycrdt._sync import YSyncMessageType, create_message
from websockets import connect

from cli.core import StudioAPI, console, get_multiplayer_ws_url


def _build_room_name(file_id: int) -> str:
    """Build Y.js room name matching frontend/backend convention."""
    raw_env = os.getenv("ENV", "dev").lower()
    env = "dev" if raw_env == "local" else raw_env
    return f"file-{file_id}-{env}"


async def _apply_edit(ws: Any, file_id: int, new_source: str) -> dict[str, Any]:
    """Sync with the Y.js room, replace document text, broadcast, and return result."""
    doc = Doc()
    text = doc.get("text", type=Text)

    # SyncStep1: announce our (empty) state
    sync_msg = create_sync_message(doc)
    await ws.send(sync_msg)

    # Receive SyncStep2: absorb room's current state
    while True:
        message = await asyncio.wait_for(ws.recv(), timeout=15.0)
        if not message:
            continue
        msg_type = message[0]
        payload = message[1:]
        if msg_type == 0:  # sync message
            reply = handle_sync_message(payload, doc)
            if reply:
                await ws.send(reply)
            if payload and payload[0] == 1:  # SyncStep2
                break

    # Replace document content
    state_before = doc.get_state()
    with doc.transaction():
        if len(text) > 0:
            del text[0 : len(text)]
        if new_source:
            text += new_source

    # Broadcast the update to all peers in the room
    update = doc.get_update(state_before)
    update_msg = create_message(update, YSyncMessageType.SYNC_UPDATE)
    await ws.send(update_msg)

    return {
        "file_id": file_id,
        "chars_written": len(new_source),
        "status": "ok",
    }


def _run_edit(file_id: int, new_source: str) -> dict[str, Any]:
    """Connect to Y.js WebSocket, apply edit, disconnect. Returns result dict."""
    ws_base = get_multiplayer_ws_url()
    room = _build_room_name(file_id)
    url = f"{ws_base}/{room}"

    async def _do() -> dict[str, Any]:
        async with connect(url, open_timeout=10, close_timeout=5) as ws:
            return await _apply_edit(ws, file_id, new_source)

    return asyncio.run(_do())


@click.command()
@click.argument("file_id", type=int)
@click.option("--source", "-s", type=click.Path(exists=True), help="Path to RSM source file")
@click.option("--stdin", "from_stdin", is_flag=True, help="Read source from stdin")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def edit(file_id: int, source: str | None, from_stdin: bool, as_json: bool) -> None:
    """Edit document source via Y.js."""
    if not source and not from_stdin:
        console.print("[red]✗ Provide --source <path> or --stdin.[/red]")
        sys.exit(1)

    if source and from_stdin:
        console.print("[red]✗ Cannot use both --source and --stdin.[/red]")
        sys.exit(1)

    api = StudioAPI()
    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    if source:
        new_source = open(source).read()  # noqa: SIM115
    else:
        new_source = click.get_text_stream("stdin").read()

    try:
        result = _run_edit(file_id, new_source)
    except Exception as e:
        if as_json:
            click.echo(json.dumps({"status": "error", "error": str(e)}))
        else:
            console.print(f"[red]✗ Edit failed: {e}[/red]")
        sys.exit(1)

    if as_json:
        click.echo(json.dumps(result))
    else:
        console.print(
            f"[green]✓ Updated file {result['file_id']} "
            f"({result['chars_written']} chars)[/green]"
        )
