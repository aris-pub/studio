"""Aris Studio CLI - Developer tool for local development.

CRITICAL: This tool ONLY works in LOCAL development environment.
It will refuse to run in PROD, CI, or STAGING environments.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

import click
import jwt
import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from rich.console import Console
from rich.table import Table

console = Console()

SESSION_FILE = Path.home() / ".studio" / "session.json"


def check_environment() -> None:
    """Verify we're running in LOCAL environment only.

    Raises:
        SystemExit: If running in non-LOCAL environment.
    """
    env = os.environ.get("ENV", "LOCAL")
    if env in ("PROD", "CI", "STAGING"):
        console.print("[red]ERROR: studio CLI only works in LOCAL environment.[/red]")
        console.print(f"[red]Current ENV={env}. Refusing to run.[/red]")
        sys.exit(1)


def get_api_base_url() -> str:
    """Get API base URL from .env file.

    Returns:
        API base URL (defaults to http://localhost:8000).
    """
    repo_root = Path(__file__).parent.parent
    env_file = repo_root / ".env"

    if env_file.exists():
        load_dotenv(env_file)

    return os.environ.get("VITE_API_BASE_URL", "http://localhost:8000")


def get_frontend_port() -> int:
    """Get frontend port from .env file.

    Returns:
        Frontend port (defaults to 5173).
    """
    repo_root = Path(__file__).parent.parent
    env_file = repo_root / ".env"

    if env_file.exists():
        load_dotenv(env_file)

    return int(os.environ.get("FRONTEND_PORT", "5173"))


class Session:
    """Manage user session stored in ~/.studio/session.json."""

    def __init__(self) -> None:
        self.file_path = SESSION_FILE
        self.file_path.parent.mkdir(parents=True, exist_ok=True)

    def save(self, access_token: str, refresh_token: str, user: dict[str, Any]) -> None:
        """Save session to disk with restricted permissions."""
        data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": user,
        }

        self.file_path.write_text(json.dumps(data, indent=2))
        os.chmod(self.file_path, 0o600)

    def load(self) -> dict[str, Any] | None:
        """Load session from disk."""
        if not self.file_path.exists():
            return None

        try:
            data: dict[str, Any] = json.loads(self.file_path.read_text())
            return data
        except (json.JSONDecodeError, OSError):
            return None

    def clear(self) -> None:
        """Delete session file."""
        if self.file_path.exists():
            self.file_path.unlink()

    def is_valid(self) -> bool:
        """Check if session exists and token is not expired."""
        session = self.load()
        if not session:
            return False

        try:
            access_token = session.get("access_token")
            if not access_token:
                return False

            jwt.decode(
                access_token,
                options={"verify_signature": False, "verify_exp": True},
            )
            return True
        except jwt.ExpiredSignatureError:
            return False
        except jwt.DecodeError:
            return False


class StudioAPI:
    """Thin wrapper around Aris API - no business logic."""

    def __init__(self) -> None:
        self.base_url = get_api_base_url()
        self.session = Session()

    def _get_headers(self) -> dict[str, str]:
        """Get headers with auth token if available."""
        session_data = self.session.load()
        if session_data and session_data.get("access_token"):
            return {"Authorization": f"Bearer {session_data['access_token']}"}
        return {}

    def login(self, email: str, password: str) -> dict[str, Any]:
        """POST /login."""
        response = requests.post(
            f"{self.base_url}/login",
            json={"email": email, "password": password},
            timeout=10,
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return data

    def get_me(self) -> dict[str, Any]:
        """GET /me."""
        response = requests.get(
            f"{self.base_url}/me",
            headers=self._get_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return data

    def get_files(self, user_id: int) -> list[dict[str, Any]]:
        """GET /users/{user_id}/files."""
        response = requests.get(
            f"{self.base_url}/users/{user_id}/files",
            headers=self._get_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data: list[dict[str, Any]] = response.json()
        return data


@click.group()
def cli() -> None:
    """Aris Studio CLI - Developer tool for local development."""
    check_environment()


@cli.command()
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


@cli.command()
def logout() -> None:
    """Logout and clear session."""
    api = StudioAPI()

    if not api.session.load():
        console.print("[yellow]No active session.[/yellow]")
        return

    api.session.clear()
    console.print("[green]✓ Logged out successfully[/green]")


@cli.command()
def session() -> None:
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


@cli.command()
def files() -> None:
    """List all files for the logged-in user."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    try:
        user_data = api.get_me()
        user_files = api.get_files(user_data["id"])

        if not user_files:
            console.print("[yellow]No files found.[/yellow]")
            return

        table = Table(title=f"Files for {user_data['name']}")
        table.add_column("ID", style="cyan", width=8)
        table.add_column("Title", style="green")
        table.add_column("Last Edited", style="yellow")

        for file in user_files:
            table.add_row(
                str(file["id"]),
                file["title"],
                file.get("last_edited_at", "Never"),
            )

        console.print(table)

    except requests.HTTPError as e:
        console.print(f"[red]✗ API error: {e.response.text}[/red]")
        sys.exit(1)
    except requests.RequestException as e:
        console.print(f"[red]✗ Network error: {e}[/red]")
        sys.exit(1)


@cli.command()
@click.argument("file_id", type=int)
@click.option("--playwright", is_flag=True, help="Output Playwright script instead of opening browser")
def ui(file_id: int, playwright: bool) -> None:
    """Open browser to file with logged-in session, or output Playwright script."""
    api = StudioAPI()

    if not api.session.is_valid():
        console.print("[red]✗ Not logged in. Run 'studio login' first.[/red]")
        sys.exit(1)

    session_data = api.session.load()
    if not session_data:
        console.print("[red]✗ Session data corrupted.[/red]")
        sys.exit(1)

    frontend_port = get_frontend_port()
    frontend_url = f"http://localhost:{frontend_port}"
    file_url = f"{frontend_url}/file/{file_id}"

    if playwright:
        user_json = json.dumps(session_data["user"]).replace("'", "\\'")
        access_token = session_data["access_token"]
        refresh_token = session_data["refresh_token"]

        # Build JavaScript as a single line to avoid wrapping issues
        js_code = (
            f"localStorage.setItem('accessToken', '{access_token}'); "
            f"localStorage.setItem('refreshToken', '{refresh_token}'); "
            f"localStorage.setItem('user', '{user_json}');"
        )

        script = f"""# Auto-generated Playwright script for file {file_id}
# Generated by: studio ui {file_id} --playwright

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    # Navigate to frontend
    page.goto('{frontend_url}')

    # Inject session tokens
    page.evaluate('''{js_code}''')

    # Navigate to file
    page.goto('{file_url}')

    # ADD YOUR TEST CODE BELOW
    # Example:
    # page.click('[data-testid="some-button"]')
    # page.fill('[data-testid="input"]', 'test value')
    # assert page.locator('[data-testid="result"]').text_content() == 'expected'

    browser.close()
"""
        # Use print() instead of console.print() to avoid Rich's automatic line wrapping
        # which breaks the JavaScript code in page.evaluate()
        print(script)
        return

    console.print(f"[cyan]Opening browser to file {file_id}...[/cyan]")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            page = browser.new_page()

            page.goto(frontend_url)

            page.evaluate(
                """({ accessToken, refreshToken, user }) => {
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', refreshToken);
                    localStorage.setItem('user', JSON.stringify(user));
                }""",
                {
                    "accessToken": session_data["access_token"],
                    "refreshToken": session_data["refresh_token"],
                    "user": session_data["user"],
                },
            )

            page.goto(file_url)

            console.print(f"[green]✓ Browser opened to {file_url}[/green]")
            console.print("[dim]Browser will stay open. Close manually when done.[/dim]")

    except Exception as e:
        console.print(f"[red]✗ Browser error: {e}[/red]")
        sys.exit(1)


def main() -> None:
    """Entry point for the CLI."""
    cli()
