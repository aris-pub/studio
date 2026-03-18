"""Resolve command: soft-delete an annotation."""

import click


@click.command()
@click.argument("annotation_id", type=int)
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def resolve(annotation_id: int, as_json: bool) -> None:
    """Mark an annotation as resolved (soft-delete)."""
    raise NotImplementedError("std-7js8: studio resolve not yet implemented")
