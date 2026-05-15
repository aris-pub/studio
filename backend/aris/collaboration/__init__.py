"""
Collaboration module for real-time Y.js document synchronization.

This module implements the backend-as-client architecture where the
backend maintains Y.Doc instances, connects to the y-websocket server,
and handles persistence to PostgreSQL.
"""

from .auth import decode_collab_token, mint_collab_token
from .manager import CollaborationManager, get_collaboration_manager
from .yjs_client import YDocClient


__all__ = [
    "CollaborationManager",
    "YDocClient",
    "decode_collab_token",
    "get_collaboration_manager",
    "mint_collab_token",
]
