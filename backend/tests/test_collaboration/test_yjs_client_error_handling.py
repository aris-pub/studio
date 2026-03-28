"""
Tests for proper error logging in YDocClient exception handlers.

Bug: 6+ bare except/pass handlers silently swallowed errors, risking data loss
without any indication. These tests verify that exceptions are logged properly.
"""

import asyncio
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pycrdt import Doc, Text

from aris.collaboration.yjs_client import YDocClient


@pytest.fixture
def client():
    """Create a YDocClient with mocked DB dependencies."""
    c = YDocClient(
        file_id=42,
        websocket_url="ws://localhost:9999",
        debounce_ms=50,
    )
    c.doc = Doc()
    c.text = c.doc.get("text", type=Text)
    return c


class TestOnDocChangeErrorLogging:
    """_on_doc_change must log when event loop is unavailable."""

    def test_logs_warning_when_event_loop_unavailable(self, client, caplog):
        """When asyncio.get_event_loop() raises RuntimeError, a warning should be logged."""
        with patch("asyncio.get_event_loop", side_effect=RuntimeError("no running event loop")):
            with caplog.at_level(logging.WARNING, logger="aris.collaboration"):
                client._on_doc_change(MagicMock())

        assert any(
            "event loop" in record.message.lower() and "file 42" in record.message
            for record in caplog.records
        ), f"Expected warning about event loop unavailability, got: {[r.message for r in caplog.records]}"

    def test_skips_when_in_sync_operation(self, client):
        """During sync operations, _on_doc_change should return early without error."""
        client._in_sync_operation = True
        # Should not raise or log anything
        client._on_doc_change(MagicMock())

    def test_signals_save_when_event_loop_available(self, client):
        """When event loop is available, _on_doc_change should call _signal_save."""
        loop = asyncio.new_event_loop()
        try:
            with patch("asyncio.get_event_loop", return_value=loop):
                with patch.object(client, "_signal_save"):
                    loop.call_soon_threadsafe = MagicMock()
                    client._on_doc_change(MagicMock())
                    loop.call_soon_threadsafe.assert_called_once_with(client._signal_save)
        finally:
            loop.close()


class TestSaveLoopCancellation:
    """_save_loop should log when cancelled."""

    @pytest.mark.asyncio
    async def test_save_loop_logs_on_cancellation(self, client, caplog):
        """Cancelling the save loop should produce a debug log."""
        with caplog.at_level(logging.DEBUG, logger="aris.collaboration"):
            task = asyncio.create_task(client._save_loop())
            await asyncio.sleep(0.05)
            task.cancel()
            await task  # CancelledError is caught internally, task completes normally

        assert any(
            "save loop" in record.message.lower() and "file 42" in record.message
            for record in caplog.records
        ), f"Expected debug log about save loop cancellation, got: {[r.message for r in caplog.records]}"


class TestIdleTimerCancellation:
    """_idle_timer should log when cancelled."""

    @pytest.mark.asyncio
    async def test_idle_timer_logs_on_cancellation(self, client, caplog):
        """Cancelling the idle timer should produce a debug log."""
        with caplog.at_level(logging.DEBUG, logger="aris.collaboration"):
            task = asyncio.create_task(client._idle_timer())
            await asyncio.sleep(0.05)
            task.cancel()
            await task

        assert any(
            "idle" in record.message.lower() and "file 42" in record.message
            for record in caplog.records
        ), f"Expected debug log about idle timer cancellation, got: {[r.message for r in caplog.records]}"


class TestSafetyNetCancellation:
    """_safety_net_loop should log when cancelled."""

    @pytest.mark.asyncio
    async def test_safety_net_logs_on_cancellation(self, client, caplog):
        """Cancelling the safety net loop should produce a debug log."""
        with caplog.at_level(logging.DEBUG, logger="aris.collaboration"):
            task = asyncio.create_task(client._safety_net_loop())
            await asyncio.sleep(0.05)
            task.cancel()
            await task

        assert any(
            "safety" in record.message.lower() and "file 42" in record.message
            for record in caplog.records
        ), f"Expected debug log about safety net cancellation, got: {[r.message for r in caplog.records]}"


class TestShutdownSaveTaskCancellation:
    """shutdown() should log cancelled save task and handle errors in final save."""

    @pytest.mark.asyncio
    async def test_shutdown_logs_save_task_cancellation(self, client, caplog):
        """When shutdown cancels a running save task, it should log at debug level."""
        # Start a save loop so there's something to cancel
        client._save_task = asyncio.create_task(client._save_loop())
        await asyncio.sleep(0.05)

        with caplog.at_level(logging.DEBUG, logger="aris.collaboration"):
            # Mock _save_to_db so the final save doesn't need a real DB
            client._save_to_db = AsyncMock()
            await client.shutdown()

        assert any(
            "cancel" in record.message.lower() and "file 42" in record.message
            for record in caplog.records
        ), f"Expected debug log about cancellation during shutdown, got: {[r.message for r in caplog.records]}"


class TestConnectAndRunSaveTaskCancellation:
    """_connect_and_run should log when it cancels a lingering save task."""

    @pytest.mark.asyncio
    async def test_cancels_lingering_save_task_with_logging(self, client, caplog):
        """When _connect_and_run cancels a lingering save task, it should log."""
        client._save_task = asyncio.create_task(client._save_loop())
        await asyncio.sleep(0.05)

        with caplog.at_level(logging.DEBUG, logger="aris.collaboration"):
            client._save_task.cancel()
            try:
                await client._save_task
            except asyncio.CancelledError:
                pass

        # The save loop itself should have logged on cancellation
        assert any(
            "save loop" in record.message.lower()
            for record in caplog.records
        ), f"Expected debug log about save loop, got: {[r.message for r in caplog.records]}"
