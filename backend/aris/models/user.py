"""User, profile picture, and per-user settings models."""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from aris.models.base import Base


class AvatarColor(enum.Enum):
    """Enum for user avatar color options.

    Attributes
    ----------
    BLUE, RED, GREEN, PURPLE, ORANGE, PINK, YELLOW : str
        Hex color codes used for avatars.

    """

    BLUE = "#0E9AE9"
    RED = "#EF4B4C"
    GREEN = "#1FB5A2"
    PURPLE = "#AD71F2"
    ORANGE = "#F5862B"
    PINK = "#EC4899"
    YELLOW = "#F5AB00"

    @classmethod
    def random(cls):
        """Return a random avatar color.

        Returns
        -------
        AvatarColor
            Randomly chosen enum value.

        """
        import random

        return random.choice(list(cls))


class User(Base):
    """Represents an application user who owns files, tags, and file assets.

    Attributes
    ----------
    id : int
        Primary key.
    name : str
        Full name of the user.
    email : str
        Unique email address.
    password_hash : str
        Hashed user password.
    initials : str
        Optional initials string.
    deleted_at : datetime
        Timestamp for soft deletes.
    created_at : datetime
        Time of account creation.
    last_login : datetime
        Last login timestamp.
    avatar_color : AvatarColor
        Selected avatar color.
    profile_picture_id : int
        Foreign key to ProfilePicture (optional).
    email_verified : bool
        Whether email address has been verified.
    email_verification_token : str
        Token for email verification (optional).
    email_verification_sent_at : datetime
        When verification email was last sent (optional).
    files : list of File
        Files owned by the user.
    tags : list of Tag
        Tags owned by the user.
    file_assets : list of FileAsset
        Private files attached to user files.
    profile_picture : ProfilePicture
        User's profile picture.

    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    # Who initiated the soft-delete (self-service or an admin). Attribution only,
    # SET NULL on erasure (std-x4a4h9).
    deleted_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    initials = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    avatar_color: Column[AvatarColor] = Column(
        Enum(AvatarColor), nullable=True, default=AvatarColor.BLUE
    )
    profile_picture_id = Column(
        Integer, ForeignKey("profile_pictures.id"), nullable=True
    )

    # Account fields

    # Email verification fields
    email_verified = Column(Boolean, nullable=False, default=False)
    email_verification_token = Column(String, nullable=True)
    email_verification_sent_at = Column(DateTime(timezone=True), nullable=True)

    files = relationship("File", back_populates="owner", foreign_keys="File.owner_id")
    tags = relationship("Tag", back_populates="owner", cascade="all, delete-orphan")
    file_settings = relationship(
        "FileSettings", back_populates="user", cascade="all, delete-orphan"
    )
    user_settings = relationship(
        "UserSettings",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    file_assets = relationship(
        "FileAsset", back_populates="owner", cascade="all, delete-orphan"
    )
    profile_picture = relationship("ProfilePicture", back_populates="user")
    file_permissions = relationship(
        "FilePermission",
        foreign_keys="[FilePermission.user_id]",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    def __init__(self, **kwargs):
        """Initialize User with default values."""
        # Set defaults for fields that have defaults but aren't applied before DB insertion
        if "email_verified" not in kwargs:
            kwargs["email_verified"] = False
        if "avatar_color" not in kwargs:
            kwargs["avatar_color"] = AvatarColor.BLUE
        super().__init__(**kwargs)

    owned_annotations = relationship(
        "Annotation",
        foreign_keys="Annotation.owner_id",
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    annotation_messages = relationship(
        "AnnotationMessage", back_populates="owner", cascade="all, delete-orphan"
    )
    reactions = relationship(
        "Reaction", back_populates="owner", cascade="all, delete-orphan"
    )

    def generate_verification_token(self) -> str:
        """Generate a new email verification token.

        Returns
        -------
        str
            The 32-character raw token. Only its SHA-256 hash is stored, so this
            return value is the only copy of the raw token and must go straight
            into the email link.
        """
        import secrets

        from aris.security import hash_token

        token = secrets.token_urlsafe(24)[:32]  # Ensure exactly 32 chars
        self.email_verification_token = hash_token(token)
        return token

    def verify_token(self, token: str) -> bool:
        """Verify an email verification token.

        Parameters
        ----------
        token : str
            Token to verify.

        Returns
        -------
        bool
            True if token matches, False otherwise.
        """
        if not token or not self.email_verification_token:
            return False
        from aris.security import hash_token

        return bool(self.email_verification_token == hash_token(token))


class ProfilePicture(Base):
    """A user's profile picture.

    Stores profile picture data with support for multiple image formats.
    Only one profile picture per user is active at a time.

    Attributes
    ----------
    id : int
        Primary key.
    filename : str
        Original filename of the uploaded image.
    mime_type : str
        MIME type (e.g., image/jpeg, image/png).
    content : str
        Base64-encoded image content.
    uploaded_at : datetime
        Timestamp of upload.
    deleted_at : datetime
        Soft delete marker.
    user : User
        User who owns this profile picture.

    """

    __tablename__ = "profile_pictures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="profile_picture")


class UserSettings(Base):
    """User behavioral and privacy preferences.

    Stores user preferences for application behavior, privacy controls, and
    communication settings that are separate from document display settings.

    Attributes
    ----------
    id : int
        Primary key.
    user_id : int
        Foreign key to User (owner of the settings).
    auto_save_interval : int
        Auto-save interval in seconds.
    focus_mode_auto_hide : bool
        Whether to auto-hide UI elements in focus mode.
    sidebar_auto_collapse : bool
        Whether to auto-collapse sidebar.
    drawer_default_annotations : bool
        Default state for annotations drawer.
    drawer_default_margins : bool
        Default state for margins drawer.
    drawer_default_settings : bool
        Default state for settings drawer.
    sound_notifications : bool
        Whether to enable sound notifications.
    auto_compile_delay : int
        Auto-compile delay in milliseconds.
    mobile_menu_behavior : str
        Mobile menu behavior preference.
    allow_anonymous_feedback : bool
        Whether to allow anonymous feedback on content.
    email_digest_frequency : str
        Email digest frequency (daily/weekly/none).
    notification_preference : str
        Notification preference (in-app/email/both).
    notification_mentions : bool
        Enable mention notifications.
    notification_comments : bool
        Enable comment notifications.
    notification_shares : bool
        Enable share notifications.
    notification_system : bool
        Enable system update notifications.
    created_at : datetime
        Timestamp of settings creation.
    updated_at : datetime
        Timestamp of last update.
    deleted_at : datetime
        Soft delete marker.
    user : User
        User relationship.

    """

    __tablename__ = "user_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_settings_per_user"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Behavioral preferences
    auto_save_interval = Column(Integer, nullable=False, default=30)
    focus_mode_auto_hide = Column(Boolean, nullable=False, default=True)
    sidebar_auto_collapse = Column(Boolean, nullable=False, default=False)
    drawer_default_annotations = Column(Boolean, nullable=False, default=False)
    drawer_default_margins = Column(Boolean, nullable=False, default=False)
    drawer_default_settings = Column(Boolean, nullable=False, default=False)
    sound_notifications = Column(Boolean, nullable=False, default=True)
    auto_compile_delay = Column(Integer, nullable=False, default=1000)
    mobile_menu_behavior = Column(String, nullable=False, default="standard")

    # Privacy and communication preferences
    allow_anonymous_feedback = Column(Boolean, nullable=False, default=False)
    email_digest_frequency = Column(String, nullable=False, default="weekly")
    notification_preference = Column(String, nullable=False, default="in-app")
    notification_mentions = Column(Boolean, nullable=False, default=True)
    notification_comments = Column(Boolean, nullable=False, default=True)
    notification_shares = Column(Boolean, nullable=False, default=True)
    notification_system = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="user_settings")


