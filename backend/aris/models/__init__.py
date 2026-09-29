"""Database models. Import them from this package, for example
``from aris.models import User``. Classes are grouped into topical modules
(user, file, permission, annotation, signup) and re-exported here so the
package is the single import surface. Importing the package registers every
table on ``Base.metadata``.
"""

# isort: off
# mock_data instantiates User, File and Tag at import time, which configures
# the whole mapper registry, so every model module must be imported (and its
# classes registered) before mock_data. Keep mock_data last and do not let the
# import sorter reorder this block.
from .base import Base
from .user import AvatarColor, ProfilePicture, User, UserSettings
from .file import (
    File,
    FileAsset,
    FileSettings,
    FileStatus,
    FileVersion,
    Reaction,
    Tag,
    file_tags,
)
from .permission import FilePermission, FileRole
from .annotation import Annotation, AnnotationMessage, AnnotationVisibility
from .signup import Feedback, InterestLevel, Signup, SignupStatus
from .mock_data import *  # noqa: F401, F403
# isort: on

__all__ = [
    "Base",
    "AvatarColor",
    "ProfilePicture",
    "User",
    "UserSettings",
    "File",
    "FileAsset",
    "FileSettings",
    "FileStatus",
    "FileVersion",
    "Reaction",
    "Tag",
    "file_tags",
    "FilePermission",
    "FileRole",
    "Annotation",
    "AnnotationMessage",
    "AnnotationVisibility",
    "Feedback",
    "InterestLevel",
    "Signup",
    "SignupStatus",
]
