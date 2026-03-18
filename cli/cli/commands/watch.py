"""Watch command: long-running poll for new annotations."""

import json
import sys
import time
from typing import Any

import click
import requests

from cli.core import StudioAPI, console


def _sleep(seconds: float) -> None:
    """Wrapper around time.sleep for testability."""
    time.sleep(seconds)


def _fingerprint(annotation: dict[str, Any]) -> str:
    """Build a change-detection fingerprint for an annotation.

    Captures message count and IDs so we detect new replies.
    """
    msg_ids = sorted(m["id"] for m in annotation.get("messages", []))
    return f"{annotation['id']}:{msg_ids}"


@click.command()
@click.argument("file_id", type=int)
@click.option("--interval", type=int, default=10, help="Poll interval in seconds (default: 10)")
def watch(file_id: int, interval: int) -> None:
    """Poll for new comments, outputting JSON lines."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    known: dict[int, str] = {}

    try:
        while True:
            try:
                annotations = api.get_annotations(file_id)
            except requests.RequestException:
                _sleep(interval)
                continue

            current_ids = set()

            for ann in annotations:
                ann_id = ann["id"]
                current_ids.add(ann_id)
                fp = _fingerprint(ann)

                if ann_id not in known:
                    click.echo(json.dumps({"type": "new", "annotation": ann}))
                elif known[ann_id] != fp:
                    click.echo(json.dumps({"type": "updated", "annotation": ann}))

                known[ann_id] = fp

            for removed_id in set(known.keys()) - current_ids:
                click.echo(json.dumps({"type": "deleted", "annotation_id": removed_id}))
                del known[removed_id]

            _sleep(interval)
    except KeyboardInterrupt:
        pass
