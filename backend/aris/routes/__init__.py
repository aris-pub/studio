from .auth import router as auth_router
from .copilot import router as copilot_router
from .file import router as file_router
from .file_annotations import router as file_annotations_router
from .file_settings import router as file_settings_router
from .permissions import router as permissions_router
from .render import router as render_router
from .signup import router as signup_router
from .tag import router as tag_router
from .user import public_router as user_public_router
from .user import router as user_router
from .user_settings import router as user_settings_router
from .versions import router as versions_router


__all__ = [
    "auth_router",
    "copilot_router",
    "file_annotations_router",
    "file_router",
    "file_settings_router",
    "permissions_router",
    "render_router",
    "signup_router",
    "tag_router",
    "user_router",
    "user_public_router",
    "user_settings_router",
    "versions_router",
]
