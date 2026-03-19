"""File command group: studio file <file_id> [read|edit|comments|reply|resolve]."""

import click


@click.group(invoke_without_command=True)
@click.argument("file_id", type=int, required=False)
@click.pass_context
def file_cmd(ctx: click.Context, file_id: int | None) -> None:
    """Work with a specific file. Defaults to reading the file."""
    if file_id is None:
        click.echo(ctx.get_help())
        return
    ctx.ensure_object(dict)
    ctx.obj["file_id"] = file_id
    if ctx.invoked_subcommand is None:
        ctx.invoke(ctx.command.commands["read"])
