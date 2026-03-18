"""Edit command: connect to Y.js, apply source changes, disconnect."""

import click


@click.command()
@click.argument("file_id", type=int)
@click.option("--source", "-s", type=click.Path(exists=True), help="Path to RSM source file")
@click.option("--stdin", "from_stdin", is_flag=True, help="Read source from stdin")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def edit(file_id: int, source: str | None, from_stdin: bool, as_json: bool) -> None:
    """Edit document source via Y.js."""
    raise NotImplementedError("std-pj48: studio edit not yet implemented")
