"""Read command: connect to Y.js, read document source, disconnect."""

import click


@click.command()
@click.argument("file_id", type=int)
@click.option("--output", "-o", type=click.Path(), help="Write source to file instead of stdout")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def read(file_id: int, output: str | None, as_json: bool) -> None:
    """Read current document source via Y.js."""
    raise NotImplementedError("std-n63m: studio read not yet implemented")
