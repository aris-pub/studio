"""
Collaboration module for real-time Y.js document synchronization.

This module implements the backend-as-client architecture where the
backend maintains Y.Doc instances, connects to the y-websocket server,
and handles persistence to PostgreSQL.
"""

from .manager import CollaborationManager, get_collaboration_manager
from .yjs_client import YDocClient


__all__ = ["YDocClient", "CollaborationManager", "get_collaboration_manager"]
