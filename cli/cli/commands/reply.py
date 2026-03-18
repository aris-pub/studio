"""Reply command: post a message to an annotation thread."""

import click


@click.command()
@click.argument("annotation_id", type=int)
@click.argument("message", required=False)
@click.option("--stdin", "from_stdin", is_flag=True, help="Read message from stdin")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def reply(annotation_id: int, message: str | None, from_stdin: bool, as_json: bool) -> None:
    """Reply to an annotation thread."""
    raise NotImplementedError("std-v8qb: studio reply not yet implemented")
