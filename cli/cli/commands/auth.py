"""Authentication commands: login, logout, session."""

import sys

import click
import requests

from cli.core import SESSION_FILE, StudioAPI, console


@click.command()
@click.option("-u", "--username", required=True, help="Email address")
@click.option("-p", "--password", required=True, help="Password")
def login(username: str, password: str) -> None:
    """Login and store session."""
    api = StudioAPI()

    try:
        console.print(f"[cyan]Logging in as {username}...[/cyan]")

        auth_data = api.login(username, password)

        user_data = requests.get(
            f"{api.base_url}/me",
            headers={"Authorization": f"Bearer {auth_data['access_token']}"},
            timeout=10,
        ).json()

        api.session.save(
            access_token=auth_data["access_token"],
            refresh_token=auth_data["refresh_token"],
            user=user_data,
        )

        console.print(f"[green]✓ Logged in successfully as {user_data['name']}[/green]")
        console.print(f"[dim]Session saved to {SESSION_FILE}[/dim]")

    except requests.HTTPError as e:
        console.print(f"[red]✗ Login failed: {e.response.text}[/red]")
        sys.exit(1)
    except requests.RequestException as e:
        console.print(f"[red]✗ Network error: {e}[/red]")
        sys.exit(1)


@click.command()
def logout() -> None:
    """Logout and clear session."""
    api = StudioAPI()

    if not api.session.load():
        console.print("[yellow]No active session.[/yellow]")
        return

    api.session.clear()
    console.print("[green]✓ Logged out successfully[/green]")


@click.command("session")
def session_cmd() -> None:
    """Display current session data (tokens and user info)."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    session_data = api.session.load()
    if not session_data:
        console.print("[red]✗ Session data corrupted.[/red]")
        sys.exit(1)

    console.print("[cyan]Current Session:[/cyan]")
    console.print(f"\n[yellow]Access Token:[/yellow]\n{session_data['access_token']}")
    console.print(f"\n[yellow]Refresh Token:[/yellow]\n{session_data['refresh_token']}")
    console.print("\n[yellow]User:[/yellow]")
    console.print(f"  ID: {session_data['user']['id']}")
    console.print(f"  Email: {session_data['user']['email']}")
    console.print(f"  Name: {session_data['user'].get('name', 'N/A')}")
    console.print(f"\n[dim]Session stored at: {SESSION_FILE}[/dim]")
