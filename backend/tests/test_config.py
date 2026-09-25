import re
from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from aris.config import Settings


def test_settings_defaults_and_env_override(monkeypatch):
    env = {
        "DB_URL_LOCAL": "sqlite:///:memory:",
        "DB_URL_PROD": "postgresql://user:pass@host/db",
        "ALEMBIC_DB_URL_LOCAL": "sqlite:///:memory:",
        "ALEMBIC_DB_URL_PROD": "postgresql://user:pass@host/db",
        "JWT_SECRET_KEY": "secret",
        "TEST_USER_EMAIL": "test@example.com",
        "TEST_USER_PASSWORD": "testpassword123",
    }
    for key, val in env.items():
        monkeypatch.setenv(key, val)
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("JWT_ALGORITHM", raising=False)
    monkeypatch.delenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", raising=False)
    monkeypatch.delenv("JWT_REFRESH_TOKEN_EXPIRE_MINUTES", raising=False)

    s = Settings(_env_file=None)
    assert s.DB_URL_LOCAL == env["DB_URL_LOCAL"]
    assert s.DB_URL_PROD == env["DB_URL_PROD"]
    assert s.ALEMBIC_DB_URL_LOCAL == env["ALEMBIC_DB_URL_LOCAL"]
    assert s.ALEMBIC_DB_URL_PROD == env["ALEMBIC_DB_URL_PROD"]
    assert s.JWT_SECRET_KEY == env["JWT_SECRET_KEY"]
    assert s.ENV == "LOCAL"
    assert s.JWT_ALGORITHM == "HS256"
    assert s.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 120
    assert s.JWT_REFRESH_TOKEN_EXPIRE_MINUTES == 129600


def test_lsp_global_cap_sized_to_ram(monkeypatch):
    # The global LSP cap bounds how many ~75-100MB node subprocesses can run at once.
    # It must stay small enough that they cannot OOM the 2GB prod box (OOM is SIGKILL,
    # which skips the graceful Y.js flush and loses in-flight edits, std-9457). Pin the
    # sized default and a sane upper bound so a future edit cannot silently restore a
    # value (the old 20) that blows past available RAM.
    for key in ("LSP_MAX_CONCURRENT_SESSIONS", "LSP_MAX_SESSIONS_PER_USER"):
        monkeypatch.delenv(key, raising=False)

    s = Settings(_env_file=None)
    assert s.LSP_MAX_CONCURRENT_SESSIONS == 8
    assert 1 <= s.LSP_MAX_CONCURRENT_SESSIONS <= 10
    # Per-user cap must stay sane: at least 1, and never above the global ceiling.
    assert 1 <= s.LSP_MAX_SESSIONS_PER_USER <= s.LSP_MAX_CONCURRENT_SESSIONS


def test_missing_required_env_vars(monkeypatch):
    # Remove all required env vars to trigger validation error
    for key in (
        "DB_URL_LOCAL",
        "DB_URL_PROD",
        "ALEMBIC_DB_URL_LOCAL",
        "ALEMBIC_DB_URL_PROD",
        "JWT_SECRET_KEY",
        "TEST_USER_EMAIL",
        "TEST_USER_PASSWORD",
    ):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


# ---------------------------------------------------------------------------
# PROD/STAGING boot checks (require_prod_config)
# ---------------------------------------------------------------------------

GOOD_SECRET = "x" * 32

PROD_ENV = {
    "ENV": "PROD",
    "DB_URL_PROD": "postgresql://user:pass@host/db",
    "JWT_SECRET_KEY": GOOD_SECRET,
    "INTERNAL_SHARED_SECRET": GOOD_SECRET,
    "RESEND_API_KEY": "re_live_key",
    "FROM_EMAIL": "noreply@updates.aris.pub",
    "ADMIN_EMAIL": "admin@aris.pub",
    "FRONTEND_URL": "https://app.aris.pub",
    "BACKEND_URL": "https://aris-backend.fly.dev",
}


def _prod_settings(monkeypatch, **overrides):
    env = {**PROD_ENV, **overrides}
    for key, val in env.items():
        if val is None:
            monkeypatch.delenv(key, raising=False)
        else:
            monkeypatch.setenv(key, val)
    return Settings(_env_file=None)


def test_prod_boots_when_everything_is_set(monkeypatch):
    settings = _prod_settings(monkeypatch)
    assert settings.ENV == "PROD"
    assert settings.FRONTEND_URL == "https://app.aris.pub"


@pytest.mark.parametrize(
    "var",
    [
        "JWT_SECRET_KEY",
        "INTERNAL_SHARED_SECRET",
        "FROM_EMAIL",
    ],
)
def test_prod_refuses_to_boot_without_a_critical_var(monkeypatch, var):
    with pytest.raises(ValidationError, match=var):
        _prod_settings(monkeypatch, **{var: ""})


@pytest.mark.parametrize("var", ["RESEND_API_KEY", "ADMIN_EMAIL"])
def test_prod_still_boots_without_the_optional_email_vars(monkeypatch, var):
    """These two must stay optional in PROD. Requiring them breaks every preview app.

    Fly previews run with ENV="PROD" and turn email off by leaving RESEND_API_KEY
    empty. Adding either of these to the required set stops them booting, which is
    what happened on PR #500. See config.require_prod_config for the full reason.
    """
    settings = _prod_settings(monkeypatch, **{var: ""})
    assert getattr(settings, var) == ""


def test_prod_boots_the_way_a_preview_app_is_configured(monkeypatch):
    """A representative preview-shaped config: ENV=PROD, no email credentials.

    This is a hand-written stand-in, not the real workflow, so it can drift from
    what preview.yml actually sets (and has before). test_preview_yml_secrets_boot
    parses the real preview.yml and runs it through require_prod_config, so that is
    the test that actually guards the workflow against the boot contract.
    """
    settings = _prod_settings(monkeypatch, RESEND_API_KEY="", ADMIN_EMAIL="")
    assert settings.ENV == "PROD"
    assert settings.RESEND_API_KEY == ""


@pytest.mark.parametrize("var", ["FRONTEND_URL", "BACKEND_URL"])
@pytest.mark.parametrize("value", ["http://localhost:5173", "http://127.0.0.1:8000"])
def test_prod_refuses_to_boot_on_a_localhost_url(monkeypatch, var, value):
    """Booting with these would send email and asset links pointing at a laptop."""
    with pytest.raises(ValidationError, match=var):
        _prod_settings(monkeypatch, **{var: value})


def test_prod_refuses_the_resend_placeholder_key(monkeypatch):
    """services/email.py reads the placeholder as no key and disables email silently."""
    with pytest.raises(ValidationError, match="placeholder"):
        _prod_settings(monkeypatch, RESEND_API_KEY="your_resend_api_key_here")


@pytest.mark.parametrize("var", ["JWT_SECRET_KEY", "INTERNAL_SHARED_SECRET"])
def test_prod_refuses_a_short_secret(monkeypatch, var):
    with pytest.raises(ValidationError, match=var):
        _prod_settings(monkeypatch, **{var: "short"})


def test_staging_is_checked_the_same_way(monkeypatch):
    with pytest.raises(ValidationError, match="FROM_EMAIL"):
        _prod_settings(monkeypatch, ENV="STAGING", FROM_EMAIL="")


def test_local_still_boots_on_the_defaults(monkeypatch):
    """LOCAL and TEST must stay usable with nothing configured."""
    for key in PROD_ENV:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("JWT_SECRET_KEY", "dev")
    monkeypatch.setenv("INTERNAL_SHARED_SECRET", "dev")

    settings = Settings(_env_file=None)
    assert settings.ENV == "LOCAL"
    assert settings.FRONTEND_URL == "http://localhost:5173"
    assert settings.RESEND_API_KEY == ""


# ---------------------------------------------------------------------------
# preview.yml boot-contract guard
# ---------------------------------------------------------------------------
#
# preview.yml sets the environment a fresh Fly preview backend boots with, and
# require_prod_config above is the contract that boot must satisfy. The two have
# drifted apart twice, each time crashing a live preview deploy before anything
# caught it. The prod tests above check hand-written dicts, which are a second
# copy of the contract that can drift the same way. This test parses the real
# workflow and runs the real validator against it, so it tracks future edits to
# either side on its own instead of being a third hand-maintained copy.

PREVIEW_WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/preview.yml"

# The create-app secrets block must set at least these. Finding fewer means the
# parser stopped matching the workflow, not that the workflow shrank, so the test
# fails loudly rather than passing on nothing.
REQUIRED_PREVIEW_SECRET_KEYS = frozenset(
    {
        "ENV",
        "JWT_SECRET_KEY",
        "INTERNAL_SHARED_SECRET",
        "FROM_EMAIL",
        "FRONTEND_URL",
        "BACKEND_URL",
    }
)


def _preview_create_app_secrets():
    """Extract the KEY="value" secrets preview.yml sets when it first creates a
    preview app, with the ${{ ... }} template expressions blanked out so the result
    can be fed to Settings. Only the create-app block is parsed, not the separate
    backfill step for already-existing apps."""
    assert PREVIEW_WORKFLOW.exists(), (
        f"preview.yml not found at {PREVIEW_WORKFLOW}. This path is resolved relative to "
        "the test file; fix it if the workflow or the test moved."
    )
    workflow = yaml.safe_load(PREVIEW_WORKFLOW.read_text())

    steps = workflow["jobs"]["deploy"]["steps"]
    step = next((s for s in steps if s.get("name") == "Create preview app and database"), None)
    assert step is not None, (
        "No 'Create preview app and database' step in preview.yml. It was renamed or "
        "removed; point this parser at the step that sets the new-preview secrets."
    )

    run = step["run"]
    assert "flyctl secrets set" in run, (
        "No 'flyctl secrets set' in the create-app step. The command changed; update this "
        "parser."
    )
    # Scope to the secrets block. The step's earlier flyctl commands set no KEY="value"
    # pairs, and the backfill step's own secrets set commands live in a different step.
    secrets_block = run.split("flyctl secrets set", 1)[1]

    # Blank the template expressions. Each value stays a single token because the
    # ${{ ... }} sit inside the double quotes. Empty is a safe stand-in: the literal
    # parts of JWT_SECRET_KEY and INTERNAL_SHARED_SECRET still clear 32 characters
    # without the PR number, and the URL literals keep their https:// prefix so they
    # stay non-localhost.
    secrets_block = re.sub(r"\$\{\{.*?\}\}", "", secrets_block)

    return dict(re.findall(r'([A-Z][A-Z0-9_]*)="([^"]*)"', secrets_block))


def test_preview_yml_secrets_boot(monkeypatch):
    """The real preview.yml create-app secrets must pass require_prod_config.

    Feeds the exact secrets a new preview app is created with into Settings and
    asserts it constructs. Running the real validator against the real workflow means
    a future edit to either side that breaks the boot contract fails here, not on a
    live preview deploy.
    """
    secrets = _preview_create_app_secrets()

    missing = REQUIRED_PREVIEW_SECRET_KEYS - secrets.keys()
    assert not missing, (
        f"Parsed only {sorted(secrets)} from preview.yml, missing {sorted(missing)}. The "
        "secrets block changed shape or the regex stopped matching, so fix this parser "
        "before trusting the boot check below: a guard that finds nothing and passes is "
        "worse than no guard."
    )

    for key, value in secrets.items():
        monkeypatch.setenv(key, value)

    try:
        settings = Settings(_env_file=None)
    except ValidationError as exc:
        pytest.fail(
            "preview.yml's create-app secrets no longer satisfy require_prod_config, so a "
            f"fresh preview app would crash on boot:\n{exc}"
        )

    assert settings.ENV == "PROD"
