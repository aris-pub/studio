"""Sentry event filtering for the backend (std-rg1qqt).

`before_send` runs on every event before it is sent to Sentry and returns None to
drop it. It filters expected 404s, which are normal traffic rather than actionable
errors. Abuse-reporting helpers (rate-limit hits, etc.) can be added later mirroring
press/app/sentry_config.py, when abuse monitoring is wired up.
"""


def before_send(event: dict, hint: dict) -> dict | None:
    """Filter Sentry events before sending. Return None to drop the event."""
    # 404s are expected behavior, not bugs.
    if event.get("level") == "error":
        for exc in event.get("exception", {}).get("values", []):
            if "404" in str(exc.get("value", "")):
                return None
    return event
