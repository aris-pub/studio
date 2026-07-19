"""Engine configuration tests for the DB dependency layer (std-9457).

The prod machine auto-stops when idle, so its connection pool routinely holds
sockets the database has already closed. Without pre-ping, the first request after
a cold start hands out a dead connection and errors once (the HTTP 000 seen
2026-07-18). Both engines must validate a connection before use.
"""

from aris.deps import COLLAB_ENGINE, ENGINE


def test_http_engine_has_pool_pre_ping():
    # SQLAlchemy stores the pool_pre_ping flag as the pool's private _pre_ping; there
    # is no public accessor, so assert on it directly to prove the HTTP engine (not
    # just the collaboration engine) revalidates connections after an idle auto-stop.
    assert ENGINE.pool._pre_ping is True


def test_collab_engine_has_pool_pre_ping():
    assert COLLAB_ENGINE.pool._pre_ping is True
