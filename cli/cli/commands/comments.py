"""Comments command: one-shot list of annotations and threads."""

import click


@click.command()
@click.argument("file_id", type=int)
@click.option("--since", type=str, help="Only show annotations after this ISO8601 timestamp")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def comments(file_id: int, since: str | None, as_json: bool) -> None:
    """List annotations and comment threads for a file."""
    raise NotImplementedError("std-w4yb: studio comments not yet implemented")
