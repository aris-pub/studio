"""Watch command: long-running poll for new annotations."""

import click


@click.command()
@click.argument("file_id", type=int)
@click.option("--interval", type=int, default=10, help="Poll interval in seconds (default: 10)")
def watch(file_id: int, interval: int) -> None:
    """Poll for new comments, outputting JSON lines."""
    raise NotImplementedError("std-5agl: studio watch not yet implemented")
