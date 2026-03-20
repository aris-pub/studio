"""Edit command: connect to Y.js, apply source changes, disconnect."""

import asyncio
import difflib
import json
import re
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


def _codepoint_to_utf8_offset(s: str, cp_offset: int) -> int:
    """Convert a Unicode code point offset to a UTF-8 byte offset.

    pycrdt (yrs) indexes Y.Text by UTF-8 bytes, not code points.
    """
    return len(s[:cp_offset].encode("utf-8"))


def _apply_ops_to_ytext(text: Any, old_source: str, new_source: str) -> None:
    """Apply minimal diff ops to a Y.js Text object."""
    ops = _compute_diff_ops(old_source, new_source)
    for op in reversed(ops):
        if op[0] == "replace":
            _, start, end, new_content = op
            utf8_start = _codepoint_to_utf8_offset(old_source, start)
            utf8_end = _codepoint_to_utf8_offset(old_source, end)
            del text[utf8_start:utf8_end]
            text.insert(utf8_start, new_content)
        elif op[0] == "delete":
            _, start, end = op
            utf8_start = _codepoint_to_utf8_offset(old_source, start)
            utf8_end = _codepoint_to_utf8_offset(old_source, end)
            del text[utf8_start:utf8_end]
        elif op[0] == "insert":
            _, offset, content = op
            utf8_offset = _codepoint_to_utf8_offset(old_source, offset)
            text.insert(utf8_offset, content)


def apply_unified_diff(source: str, patch_text: str) -> str:
    """Apply a unified diff to source text. Raises ValueError if patch doesn't apply."""
    hunks = _parse_unified_diff(patch_text)
    if not hunks:
        raise ValueError("No valid hunks found in patch")

    lines = source.split("\n")
    # Apply hunks from bottom to top so line numbers stay valid
    for hunk in reversed(hunks):
        old_start, old_count, new_lines_content, context_before = hunk

        # Verify context/deletion lines match the source (the guardrail)
        src_idx = old_start - 1  # 0-indexed
        src_offset = 0
        for tag, line in context_before:
            if tag == "+":
                continue
            pos = src_idx + src_offset
            if pos >= len(lines) or lines[pos] != line:
                actual = lines[pos] if pos < len(lines) else "(EOF)"
                nearby = lines[max(0, src_idx - 2) : src_idx + old_count + 2]
                raise ValueError(
                    f"Patch {'context' if tag == ' ' else 'deletion'} mismatch at line {pos + 1}. "
                    f"Expected: {line!r}, found: {actual!r}. "
                    f"Nearby source: {nearby!r}"
                )
            src_offset += 1

        # Apply: remove old lines, insert new lines
        lines[src_idx : src_idx + old_count] = new_lines_content

    return "\n".join(lines)


def _parse_unified_diff(patch_text: str) -> list[tuple]:
    """Parse unified diff into hunks.

    Returns list of (old_start, old_count, new_lines, context_lines) tuples.
    context_lines is a list of (tag, line) where tag is ' ', '-', or '+'.
    """
    hunks = []
    hunk_header = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
    patch_lines = patch_text.split("\n")

    i = 0
    while i < len(patch_lines):
        line = patch_lines[i]

        # Skip --- and +++ headers
        if line.startswith("---") or line.startswith("+++"):
            i += 1
            continue

        m = hunk_header.match(line)
        if not m:
            i += 1
            continue

        old_start = int(m.group(1))
        old_count = int(m.group(2)) if m.group(2) is not None else 1
        i += 1

        context_lines = []
        new_lines = []
        while i < len(patch_lines):
            pline = patch_lines[i]
            if pline.startswith("@@") or pline.startswith("---") or pline.startswith("+++"):
                break
            if pline.startswith(" "):
                context_lines.append((" ", pline[1:]))
                new_lines.append(pline[1:])
            elif pline.startswith("-"):
                context_lines.append(("-", pline[1:]))
            elif pline.startswith("+"):
                context_lines.append(("+", pline[1:]))
                new_lines.append(pline[1:])
            elif pline == "":
                # Could be trailing empty line or empty context line
                if i + 1 < len(patch_lines) and (
                    patch_lines[i + 1].startswith(" ")
                    or patch_lines[i + 1].startswith("-")
                    or patch_lines[i + 1].startswith("+")
                ):
                    context_lines.append((" ", ""))
                    new_lines.append("")
                else:
                    break
            else:
                break
            i += 1

        hunks.append((old_start, old_count, new_lines, context_lines))

    return hunks


async def _sync_yjs(ws: Any, doc: Any) -> None:
    """Perform Y.js sync handshake."""
    sync_msg = create_sync_message(doc)
    await ws.send(sync_msg)

    while True:
        message = await asyncio.wait_for(ws.recv(), timeout=15.0)
        if not message:
            continue
        msg_type = message[0]
        payload = message[1:]
        if msg_type == 0:
            reply = handle_sync_message(payload, doc)
            if reply:
                await ws.send(reply)
            if payload and payload[0] == 1:
                break


async def _apply_edit(ws: Any, file_id: int, new_source: str) -> dict[str, Any]:
    """Sync with the Y.js room, apply diff, broadcast."""
    doc = Doc()
    text = doc.get("text", type=Text)
    await _sync_yjs(ws, doc)

    old_source = str(text)
    state_before = doc.get_state()
    with doc.transaction():
        _apply_ops_to_ytext(text, old_source, new_source)

    # Verify the result before broadcasting
    actual = str(text)
    if actual != new_source:
        # Find where they diverge
        for i, (a, b) in enumerate(zip(actual, new_source)):
            if a != b:
                ctx = 40
                raise RuntimeError(
                    f"Y.Text verification failed at char {i}. "
                    f"Expected: ...{new_source[max(0,i-ctx):i+ctx]!r}... "
                    f"Got: ...{actual[max(0,i-ctx):i+ctx]!r}..."
                )
        if len(actual) != len(new_source):
            raise RuntimeError(
                f"Y.Text length mismatch: expected {len(new_source)}, got {len(actual)}"
            )

    update = doc.get_update(state_before)
    update_msg = create_message(update, YSyncMessageType.SYNC_UPDATE)
    await ws.send(update_msg)

    return {"file_id": file_id, "chars_written": len(new_source), "status": "ok"}


async def _apply_patch(ws: Any, file_id: int, patch_text: str) -> dict[str, Any]:
    """Sync with Y.js room, apply unified diff patch, broadcast."""
    doc = Doc()
    text = doc.get("text", type=Text)
    await _sync_yjs(ws, doc)

    old_source = str(text)
    new_source = apply_unified_diff(old_source, patch_text)

    state_before = doc.get_state()
    with doc.transaction():
        _apply_ops_to_ytext(text, old_source, new_source)

    # Verify before broadcasting
    actual = str(text)
    if actual != new_source:
        for i, (a, b) in enumerate(zip(actual, new_source)):
            if a != b:
                ctx = 40
                raise RuntimeError(
                    f"Y.Text verification failed at char {i}. "
                    f"Expected: ...{new_source[max(0,i-ctx):i+ctx]!r}... "
                    f"Got: ...{actual[max(0,i-ctx):i+ctx]!r}..."
                )
        if len(actual) != len(new_source):
            raise RuntimeError(
                f"Y.Text length mismatch: expected {len(new_source)}, got {len(actual)}"
            )

    update = doc.get_update(state_before)
    update_msg = create_message(update, YSyncMessageType.SYNC_UPDATE)
    await ws.send(update_msg)

    return {
        "file_id": file_id,
        "chars_written": len(new_source),
        "status": "ok",
    }


def _run_edit(file_id: int, new_source: str) -> dict[str, Any]:
    """Connect to Y.js WebSocket, apply edit, disconnect."""
    url = build_room_url(file_id)

    async def _do() -> dict[str, Any]:
        async with connect(url, open_timeout=10, close_timeout=5) as ws:
            return await _apply_edit(ws, file_id, new_source)

    return asyncio.run(_do())


def _run_patch(file_id: int, patch_text: str) -> dict[str, Any]:
    """Connect to Y.js WebSocket, apply patch, disconnect."""
    url = build_room_url(file_id)

    async def _do() -> dict[str, Any]:
        async with connect(url, open_timeout=10, close_timeout=5) as ws:
            return await _apply_patch(ws, file_id, patch_text)

    return asyncio.run(_do())


@click.command()
@click.option("--source", "-s", type=click.Path(exists=True), help="Path to RSM source file (full replacement)")
@click.option("--patch", "-p", type=click.Path(exists=True), help="Path to unified diff patch file")
@click.option("--stdin", "from_stdin", is_flag=True, help="Read source/patch from stdin")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
@click.pass_context
def edit(ctx: click.Context, source: str | None, patch: str | None, from_stdin: bool, as_json: bool) -> None:
    """Edit document source via Y.js.

    Two modes:
      --source/-s: Full source replacement (computes minimal diff against live document)
      --patch/-p:  Apply a unified diff patch (rejects if patch doesn't apply cleanly)
      --stdin:     Read from stdin (interpreted as patch if it starts with ---, otherwise as source)
    """
    file_id: int = ctx.obj["file_id"]

    if not source and not patch and not from_stdin:
        console.print("[red]✗ Provide --source, --patch, or --stdin.[/red]")
        sys.exit(1)

    exclusive = [x for x in [source, patch, from_stdin] if x]
    if len(exclusive) > 1:
        console.print("[red]✗ Use only one of --source, --patch, or --stdin.[/red]")
        sys.exit(1)

    api = StudioAPI()
    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    try:
        if patch:
            patch_text = open(patch).read()  # noqa: SIM115
            result = _run_patch(file_id, patch_text)
        elif source:
            new_source = open(source).read()  # noqa: SIM115
            result = _run_edit(file_id, new_source)
        elif from_stdin:
            content = click.get_text_stream("stdin").read()
            # Auto-detect: if it looks like a unified diff, treat as patch
            if content.lstrip().startswith("---") or content.lstrip().startswith("@@"):
                result = _run_patch(file_id, content)
            else:
                result = _run_edit(file_id, content)
    except ValueError as e:
        if as_json:
            click.echo(json.dumps({"status": "error", "error": str(e)}))
        else:
            console.print(f"[red]✗ Patch rejected: {e}[/red]")
        sys.exit(1)
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
