"""Unit tests for YDocClient auto-checkpoint heuristics.

Tests the idle-triggered checkpoint logic without touching a real WebSocket
or database. All DB and timer interactions are mocked.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from aris.collaboration.yjs_client import (
    CHECKPOINT_IDLE_TIMEOUT_SECS,
    CHECKPOINT_MIN_EDIT_EVENTS,
    CHECKPOINT_MIN_INTERVAL_SECS,
    CHECKPOINT_SAFETY_NET_SECS,
    YDocClient,
)


def _make_client(**kwargs) -> YDocClient:
    """Build a YDocClient with mocked DB/checkpoint internals for heuristic testing."""
    defaults = dict(
        file_id=42,
        websocket_url="ws://localhost:9999",
        checkpoint_idle_timeout_secs=0.05,   # 50ms — fast for tests
        checkpoint_min_interval_secs=0,       # no min interval unless overridden
        checkpoint_safety_net_secs=0.1,       # 100ms safety net for tests
    )
    defaults.update(kwargs)
    client = YDocClient(**defaults)
    client._save_to_db = AsyncMock()
    client._create_checkpoint = AsyncMock()
    return client


# ---------------------------------------------------------------------------
# Constants sanity
# ---------------------------------------------------------------------------

def test_constants_have_expected_values():
    """Constants are declared at module level with documented values."""
    assert CHECKPOINT_IDLE_TIMEOUT_SECS == 5 * 60
    assert CHECKPOINT_MIN_EDIT_EVENTS == 15
    assert CHECKPOINT_MIN_INTERVAL_SECS == 15 * 60
    assert CHECKPOINT_SAFETY_NET_SECS == 2 * 60 * 60


# ---------------------------------------------------------------------------
# Idle trigger
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_checkpoint_triggers_after_idle_with_enough_edits():
    """Checkpoint is created when idle fires and edit count >= minimum."""
    client = _make_client()

    for _ in range(CHECKPOINT_MIN_EDIT_EVENTS):
        client._record_edit_for_checkpoint()

    await asyncio.sleep(0.15)  # outlast idle timeout (50ms)

    client._create_checkpoint.assert_awaited_once()


@pytest.mark.asyncio
async def test_checkpoint_not_triggered_with_too_few_edits():
    """Idle timer fires but edit count < minimum — no checkpoint created."""
    client = _make_client(
        checkpoint_safety_net_secs=9999,  # disable safety net for this test
    )

    for _ in range(CHECKPOINT_MIN_EDIT_EVENTS - 1):
        client._record_edit_for_checkpoint()

    await asyncio.sleep(0.15)

    client._create_checkpoint.assert_not_awaited()


@pytest.mark.asyncio
async def test_idle_timer_resets_on_new_edit():
    """Each new edit resets the idle timer — checkpoint only fires after a true pause."""
    client = _make_client(
        checkpoint_idle_timeout_secs=0.08,
        checkpoint_safety_net_secs=9999,  # disable safety net for this test
    )

    for _ in range(CHECKPOINT_MIN_EDIT_EVENTS):
        client._record_edit_for_checkpoint()
        await asyncio.sleep(0.03)  # keep editing before timeout expires

    # After the editing loop we're still within the idle window
    client._create_checkpoint.assert_not_awaited()

    # Now wait for the idle window to expire
    await asyncio.sleep(0.15)
    client._create_checkpoint.assert_awaited_once()


@pytest.mark.asyncio
async def test_checkpoint_not_triggered_if_min_interval_not_elapsed():
    """No checkpoint if last checkpoint was too recent."""
    client = _make_client(checkpoint_min_interval_secs=3600)  # 1h min interval
    client._last_checkpoint_at = datetime.now(timezone.utc)  # just checkpointed

    for _ in range(CHECKPOINT_MIN_EDIT_EVENTS):
        client._record_edit_for_checkpoint()

    await asyncio.sleep(0.15)

    client._create_checkpoint.assert_not_awaited()


@pytest.mark.asyncio
async def test_counters_reset_after_checkpoint():
    """Edit count resets to zero and last_checkpoint_at updates after a checkpoint."""
    client = _make_client()
    now = datetime.now(timezone.utc)

    for _ in range(CHECKPOINT_MIN_EDIT_EVENTS):
        client._record_edit_for_checkpoint()

    await client._maybe_create_checkpoint()

    assert client._edit_count_since_checkpoint == 0
    assert client._last_checkpoint_at is not None
    assert client._last_checkpoint_at >= now


# ---------------------------------------------------------------------------
# Safety net
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_safety_net_triggers_after_timeout_with_edits():
    """Safety net loop creates a checkpoint if 2h pass with un-checkpointed edits."""
    client = _make_client(
        checkpoint_safety_net_secs=0.08,
        checkpoint_idle_timeout_secs=9999,  # disable idle trigger for this test
    )

    for _ in range(CHECKPOINT_MIN_EDIT_EVENTS):
        client._record_edit_for_checkpoint()

    # Simulate last checkpoint being 3 hours ago so the interval check passes
    client._last_checkpoint_at = datetime.now(timezone.utc) - timedelta(hours=3)

    task = asyncio.create_task(client._safety_net_loop())
    await asyncio.sleep(0.15)  # outlast safety net timeout (80ms)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    client._create_checkpoint.assert_awaited()


@pytest.mark.asyncio
async def test_safety_net_skips_if_no_edits():
    """Safety net does not checkpoint when there have been no edits."""
    client = _make_client(
        checkpoint_safety_net_secs=0.05,
        checkpoint_idle_timeout_secs=9999,
    )
    # No edits recorded — _edit_count_since_checkpoint stays at 0

    task = asyncio.create_task(client._safety_net_loop())
    await asyncio.sleep(0.15)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    client._create_checkpoint.assert_not_awaited()


# ---------------------------------------------------------------------------
# Shutdown cleanup
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_shutdown_cancels_checkpoint_tasks():
    """Shutdown cancels both idle timer and safety net tasks."""
    client = _make_client()

    for _ in range(CHECKPOINT_MIN_EDIT_EVENTS):
        client._record_edit_for_checkpoint()

    # Ensure tasks are running
    assert client._idle_timer_task is not None
    assert not client._idle_timer_task.done()
    assert client._safety_net_task is not None
    assert not client._safety_net_task.done()

    client._shutdown = True
    client._cancel_checkpoint_tasks()

    await asyncio.sleep(0.01)  # let cancellation propagate

    assert client._idle_timer_task.done()
    assert client._safety_net_task.done()
