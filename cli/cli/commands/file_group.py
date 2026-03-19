"""File command group: studio file -f <file_id> [read|edit|comments|reply|resolve|assets]."""

import sys

import click

from cli.core import console


@click.group(invoke_without_command=True)
@click.option("-f", "--id", "file_id", required=False, type=int, help="File ID")
@click.pass_context
def file_cmd(ctx: click.Context, file_id: int | None) -> None:
    """Work with a specific file. Defaults to reading the file."""
    ctx.ensure_object(dict)
    if file_id is not None:
        ctx.obj["file_id"] = file_id
    elif ctx.invoked_subcommand is not None:
        raise click.UsageError("Missing option '-f' / '--id'. Usage: studio file -f <file_id> " + ctx.invoked_subcommand)
    if ctx.invoked_subcommand is None:
        if file_id is None:
            click.echo(ctx.get_help())
        else:
            ctx.invoke(ctx.command.commands["read"])
