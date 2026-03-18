"""Core infrastructure: session management, API client, configuration."""

import json
import os
import sys
from pathlib import Path
from typing import Any

import jwt
import requests
from dotenv import load_dotenv
from rich.console import Console

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


def get_multiplayer_url() -> str:
    """Get Y.js multiplayer WebSocket URL from .env file.

    Returns:
        Multiplayer WebSocket URL (defaults to ws://localhost:1234).
    """
    repo_root = Path(__file__).parent.parent
    env_file = repo_root / ".env"

    if env_file.exists():
        load_dotenv(env_file)

    return os.environ.get("VITE_MULTIPLAYER_URL", "ws://localhost:1234")


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
    """Thin wrapper around RSM Studio API - no business logic."""

    def __init__(self) -> None:
        self.base_url = get_api_base_url()
        self.session = Session()

    def _is_token_expired(self, token: str) -> bool:
        """Check if a JWT token is expired without verifying signature."""
        try:
            jwt.decode(token, options={"verify_signature": False, "verify_exp": True})
            return False
        except jwt.ExpiredSignatureError:
            return True
        except jwt.DecodeError:
            return False

    def _refresh_access_token(self, refresh_token: str) -> str | None:
        """Exchange refresh token for a new access token. Returns None on failure."""
        try:
            response = requests.post(
                f"{self.base_url}/refresh",
                json={"refresh_token": refresh_token},
                timeout=10,
            )
            if response.status_code == 200:
                token: str | None = response.json().get("access_token")
                return token
        except (requests.RequestException, ConnectionError):
            pass
        return None

    def _get_headers(self) -> dict[str, str]:
        """Get headers with auth token, auto-refreshing if expired."""
        session_data = self.session.load()
        if not session_data:
            return {}

        access_token = session_data.get("access_token")
        if not access_token:
            return {}

        if self._is_token_expired(access_token):
            refresh_token = session_data.get("refresh_token")
            if not refresh_token:
                console.print("[red]Session expired. Run studio login again.[/red]")
                sys.exit(1)

            new_token = self._refresh_access_token(refresh_token)
            if not new_token:
                console.print("[red]Session expired. Run studio login again.[/red]")
                sys.exit(1)

            self.session.save(
                access_token=new_token,
                refresh_token=refresh_token,
                user=session_data.get("user", {}),
            )
            access_token = new_token

        return {"Authorization": f"Bearer {access_token}"}

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

    def get_annotations(self, file_id: int) -> list[dict[str, Any]]:
        """GET /annotations/?file_id={file_id}."""
        response = requests.get(
            f"{self.base_url}/annotations/",
            params={"file_id": file_id},
            headers=self._get_headers(),
            timeout=10,
        )
        response.raise_for_status()
        data: list[dict[str, Any]] = response.json()
        return data

    def delete_annotation(self, annotation_id: int) -> None:
        """DELETE /annotations/{annotation_id} (soft-delete)."""
        response = requests.delete(
            f"{self.base_url}/annotations/{annotation_id}",
            headers=self._get_headers(),
            timeout=10,
        )
        response.raise_for_status()
