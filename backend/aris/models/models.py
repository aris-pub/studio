"""All Aris database models.

This module defines the SQLAlchemy ORM models for the Aris platform, including users,
files, associated metadata such as tags, and private user-uploaded file assets (images,
data, code). Supports soft deletes.

All models use timezone-aware timestamps and cascade deletion where appropriate.

"""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


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

    files = relationship("File", back_populates="owner")
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

    def __init__(self, **kwargs):
        """Initialize User with default values."""
        # Set defaults for fields that have defaults but aren't applied before DB insertion
        if "email_verified" not in kwargs:
            kwargs["email_verified"] = False
        if "avatar_color" not in kwargs:
            kwargs["avatar_color"] = AvatarColor.BLUE
        super().__init__(**kwargs)

    annotation_messages = relationship(
        "AnnotationMessage", back_populates="owner", cascade="all, delete-orphan"
    )

    def generate_verification_token(self) -> str:
        """Generate a new email verification token.

        Returns
        -------
        str
            32-character verification token.
        """
        import secrets

        token = secrets.token_urlsafe(24)[:32]  # Ensure exactly 32 chars
        self.email_verification_token = token
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
        return bool(self.email_verification_token == token)


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


file_tags = Table(
    "file_tags",
    Base.metadata,
    Column(
        "file_id", Integer, ForeignKey("files.id", ondelete="CASCADE"), primary_key=True
    ),
    Column(
        "tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    ),
)


class FileStatus(enum.Enum):
    """Enum representing the status of a research file."""

    DRAFT = "DRAFT"


class File(Base):
    """A research file with RSM source and associated metadata.

    Attributes
    ----------
    id : int
        Primary key.
    title : str
        Optional title.
    abstract : str
        Optional abstract.
    keywords : str
        Optional comma-separated keywords.
    status : FileStatus
        Draft, Under Review, or Published.
    last_edited_at : datetime
        Auto-updated on edit.
    created_at : datetime
        Timestamp of file creation.
    doi : str
        Optional unique DOI.
    source : str
        RSM source code.
    deleted_at : datetime
        Soft delete marker.
    owner_id : int
        Foreign key to User.
    version : int
        Version number for preprint versioning.
    prev_version_id : int
        Foreign key to previous version of this file.
    owner : User
        Owner relationship.
    tags : list of Tag
        Tags associated with the file.
    file_assets : list of FileAsset
        Assets attached to the file.

    """

    __tablename__ = "files"
    __table_args__ = (
        Index("ix_files_version", "version"),
        Index("ix_files_prev_version_id", "prev_version_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=True)
    abstract = Column(Text, nullable=True)
    keywords = Column(String, nullable=True)
    status: Mapped[FileStatus] = mapped_column(
        Enum(FileStatus, name="filestatus"), nullable=False, default=FileStatus.DRAFT
    )
    last_edited_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    source = Column(Text, nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Versioning fields
    version = Column(Integer, nullable=False, default=0)
    prev_version_id = Column(Integer, ForeignKey("files.id"), nullable=True)

    owner = relationship("User", back_populates="files")
    tags = relationship("Tag", secondary=file_tags, back_populates="files")
    annotations = relationship(
        "Annotation", back_populates="file", cascade="all, delete-orphan"
    )
    file_assets = relationship(
        "FileAsset", back_populates="file", cascade="all, delete-orphan"
    )
    file_settings = relationship(
        "FileSettings", back_populates="file", cascade="all, delete-orphan"
    )

    def __init__(self, **kwargs):
        """Initialize File with default values."""
        # Set defaults for fields that have defaults but aren't applied before DB insertion
        if "version" not in kwargs:
            kwargs["version"] = 0
        super().__init__(**kwargs)



class Tag(Base):
    """A user-defined tag for organizing research files.

    Attributes
    ----------
    id : int
        Primary key.
    user_id : int
        Foreign key to User.
    name : str
        Tag name.
    color : str
        Display color.
    created_at : datetime
        Timestamp of creation.
    deleted_at : datetime
        Soft delete marker.
    files : list of File
        Files associated with this tag.
    owner : User
        Owner relationship.
    """

    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    files = relationship("File", secondary=file_tags, back_populates="tags")
    owner = relationship("User", back_populates="tags")


class FileAsset(Base):
    """A private user-uploaded file associated with a File.

    Used for storing supporting assets such as images, data files, or text snippets.
    Visibility is restricted to the owning user.

    Attributes
    ----------
    id : int
        Primary key.
    filename : str
        Name of the file.
    mime_type : str
        MIME type (e.g., image/png).
    content : str
        File contents (stored inline).
    content_encoding : str
        Content encoding format ("plain" or "base64").
    uploaded_at : datetime
        Timestamp of upload.
    deleted_at : datetime
        Soft delete marker.
    owner_id : int
        Foreign key to User.
    file_id : int
        Foreign key to File.
    owner : User
        Owner relationship.
    file : File
        File to which the asset is attached.
    """

    __tablename__ = "file_assets"
    __table_args__ = (
        UniqueConstraint("file_id", "filename", name="uq_file_asset_filename_per_file"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    content_encoding = Column(String, nullable=False, default="plain")
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    file_id = Column(
        Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )

    owner = relationship("User", back_populates="file_assets")
    file = relationship("File", back_populates="file_assets")


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


class FileSettings(Base):
    """User-specific per-file display settings and default settings.

    Stores personalized display preferences (background, font, layout) that users can
    configure per file. Each user can have unique display settings for each file.
    When file_id is NULL, the record represents the user's default settings that
    are applied to new files as starting configuration.

    Attributes
    ----------
    id : int
        Primary key.
    file_id : int, optional
        Foreign key to File. NULL for default user settings.
    user_id : int
        Foreign key to User (owner of the settings).
    background : str
        CSS background value (color, variable, etc.).
    font_size : str
        Font size with units (e.g., "16px").
    line_height : str
        Line height value (unitless or with units).
    font_family : str
        Font family name or stack.
    margin_width : str
        Margin width with units (e.g., "16px").
    columns : int
        Number of display columns.
    created_at : datetime
        Timestamp of settings creation.
    updated_at : datetime
        Timestamp of last update.
    deleted_at : datetime
        Soft delete marker.
    file : File, optional
        File relationship. None for default settings.
    user : User
        User relationship.

    """

    __tablename__ = "file_settings"
    __table_args__ = (
        UniqueConstraint("file_id", "user_id", name="uq_file_settings_per_user_file"),
        Index(
            "ix_unique_default_settings_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("file_id IS NULL"),
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    background = Column(String, nullable=False, default="var(--surface-page)")
    font_size = Column(String, nullable=False, default="16px")
    line_height = Column(String, nullable=False, default="1.5")
    font_family = Column(String, nullable=False, default="Source Sans 3")
    margin_width = Column(String, nullable=False, default="16px")
    columns = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    file = relationship("File", back_populates="file_settings")
    user = relationship("User", back_populates="file_settings")


class AnnotationType(str, enum.Enum):
    NOTE = "note"
    COMMENT = "comment"


class Annotation(Base):
    __tablename__ = "annotation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    type: Column[AnnotationType] = Column(Enum(AnnotationType), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    messages = relationship(
        "AnnotationMessage", back_populates="annotation", cascade="all, delete-orphan"
    )
    file = relationship("File", back_populates="annotations")


class AnnotationMessage(Base):
    __tablename__ = "annotation_message"

    id = Column(Integer, primary_key=True, autoincrement=True)
    annotation_id = Column(Integer, ForeignKey("annotation.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    annotation = relationship("Annotation", back_populates="messages")
    owner = relationship("User", back_populates="annotation_messages")


class InterestLevel(enum.Enum):
    """Enum for signup interest levels."""

    EXPLORING = "exploring"
    PLANNING = "planning"
    READY = "ready"
    MIGRATING = "migrating"


class SignupStatus(enum.Enum):
    """Enum for signup status tracking."""

    ACTIVE = "active"
    UNSUBSCRIBED = "unsubscribed"
    CONVERTED = "converted"


class Signup(Base):
    """Early access signup registration.

    Stores user signup information for early access waitlist and updates.
    Matches the frontend form structure: email, authoring tools, improvements.
    Includes compliance fields and basic analytics tracking.

    Attributes
    ----------
    id : int
        Primary key.
    email : str
        Unique email address.
    authoring_tools : str
        JSON string of selected authoring tools.
    improvements : str
        Optional text feedback on desired improvements.
    status : SignupStatus
        Current status (active, unsubscribed, converted).
    source : str
        Optional signup source tracking.
    ip_address : str
        IP address for compliance/security.
    user_agent : str
        User agent string for analytics.
    consent_given : bool
        Whether user consented to data processing.
    unsubscribe_token : str
        Unique token for unsubscribe functionality.
    unsubscribed_at : datetime
        Timestamp when user unsubscribed (nullable).
    created_at : datetime
        Timestamp of signup.
    updated_at : datetime
        Timestamp of last update.

    """

    __tablename__ = "signups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    authoring_tools = Column(Text, nullable=True)  # JSON array of tools
    improvements = Column(Text, nullable=True)     # User feedback text

    # Status and tracking
    status: Column[SignupStatus] = Column(
        Enum(SignupStatus), nullable=False, default=SignupStatus.ACTIVE
    )
    source = Column(String, nullable=True)

    # Compliance and analytics
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    consent_given = Column(Boolean, nullable=False, default=True)

    # Unsubscribe functionality
    unsubscribe_token = Column(String, unique=True, nullable=False, index=True)
    unsubscribed_at = Column(DateTime(timezone=True), nullable=True)

    # Email tracking
    email_sent = Column(Boolean, nullable=False, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
