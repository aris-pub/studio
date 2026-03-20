"""Edit command: connect to Y.js, apply source changes, disconnect."""

import asyncio
import difflib
import json
import sys
from typing import Any

import click
from pycrdt import Doc, Text, create_sync_message, handle_sync_message
from pycrdt._sync import YSyncMessageType, create_message
from websockets import connect

from cli.core import StudioAPI, build_room_url, console


def _compute_diff_ops(old: str, new: str) -> list[tuple]:
    """Compute minimal insert/delete/replace operations to transform old into new.

    Returns list of op tuples in forward order.
    Caller should apply in reverse order to preserve offsets.
    """
    ops: list[tuple] = []
    matcher = difflib.SequenceMatcher(None, old, new, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        elif tag == "replace":
            ops.append(("replace", i1, i2, new[j1:j2]))
        elif tag == "delete":
            ops.append(("delete", i1, i2))
        elif tag == "insert":
            ops.append(("insert", i1, new[j1:j2]))
    return ops


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

    # Apply minimal diff to preserve peer scroll positions and reduce Y.js traffic
    old_source = str(text)
    state_before = doc.get_state()
    with doc.transaction():
        ops = _compute_diff_ops(old_source, new_source)
        # Apply ops from end to start so earlier offsets stay valid
        for op in reversed(ops):
            if op[0] == "replace":
                _, start, end, new_content = op
                del text[start:end]
                text.insert(start, new_content)
            elif op[0] == "delete":
                _, start, end = op
                del text[start:end]
            elif op[0] == "insert":
                _, offset, content = op
                text.insert(offset, content)

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
    url = build_room_url(file_id)

    async def _do() -> dict[str, Any]:
        async with connect(url, open_timeout=10, close_timeout=5) as ws:
            return await _apply_edit(ws, file_id, new_source)

    return asyncio.run(_do())


@click.command()
@click.option("--source", "-s", type=click.Path(exists=True), help="Path to RSM source file")
@click.option("--stdin", "from_stdin", is_flag=True, help="Read source from stdin")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
@click.pass_context
def edit(ctx: click.Context, source: str | None, from_stdin: bool, as_json: bool) -> None:
    """Edit document source via Y.js."""
    file_id: int = ctx.obj["file_id"]
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
