"""File, file versions, tags, assets, per-file settings, and reactions."""

import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from aris.models.base import Base


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
    """File status. Studio is authoring-only, so DRAFT is the only state."""

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
        Always DRAFT. Studio is authoring-only, so there are no review or
        published states. Publishing and public reading live in Press, not Studio.
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
        Index("ix_files_owner_id", "owner_id"),
        Index("ix_files_deleted_at", "deleted_at"),
        Index("ix_files_last_edited_at", "last_edited_at"),
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
    # Authoritative Y.Doc CRDT state (pycrdt doc.get_update()). `source` above is
    # a derived plaintext projection for compile/LSP/search/checkpoints; content
    # is restored into a live Doc via apply_update(ydoc_state), never by re-typing
    # `source` (which mints fresh CRDT identity and duplicates on merge). NULL for
    # files predating this column: seeded once from `source`, then authoritative.
    ydoc_state = Column(LargeBinary, nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    # Who soft-deleted this file. Attribution only, SET NULL on erasure (std-x4a4h9).
    deleted_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # ON DELETE CASCADE: deleting an account permanently removes its files (and,
    # via the files' own cascades, their versions/assets/settings/permissions/
    # annotations). Used by the hard-delete retention job.
    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Versioning fields
    version = Column(Integer, nullable=False, default=0)
    prev_version_id = Column(
        Integer, ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )

    owner = relationship("User", back_populates="files", foreign_keys="File.owner_id")
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
    permissions = relationship(
        "FilePermission", back_populates="file", cascade="all, delete-orphan"
    )
    reactions = relationship(
        "Reaction", back_populates="file", cascade="all, delete-orphan"
    )
    versions = relationship(
        "FileVersion", back_populates="file", cascade="all, delete-orphan"
    )

    def __init__(self, **kwargs):
        """Initialize File with default values."""
        # Set defaults for fields that have defaults but aren't applied before DB insertion
        if "version" not in kwargs:
            kwargs["version"] = 0
        super().__init__(**kwargs)


class FileVersion(Base):
    """A named snapshot of a file at a specific point in time.

    Stores RSM plaintext snapshots for version history and recovery.
    Each version has a sequential number and optional user-provided name.

    Attributes
    ----------
    id : int
        Primary key.
    file_id : int
        Foreign key to File.
    version_number : int
        Sequential version number (1, 2, 3...).
    version_name : str
        User-provided version name (e.g., "Before review", "Final submission").
    rsm_content : str
        Full RSM plaintext snapshot at this version.
    title : str
        File title at time of version creation.
    abstract : str
        File abstract at time of version creation.
    created_by : int
        Foreign key to User who created this version.
    created_at : datetime
        Timestamp of version creation.
    deleted_at : datetime
        Soft delete marker.
    file : File
        Relationship to parent file.
    creator : User
        Relationship to user who created this version.

    """

    __tablename__ = "file_versions"
    __table_args__ = (
        UniqueConstraint("file_id", "version_number", name="uq_file_version_number"),
        Index("ix_file_versions_file_id", "file_id"),
        Index("ix_file_versions_created_at", "created_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    version_name = Column(String(255), nullable=True)
    rsm_content = Column(Text, nullable=False)
    title = Column(String, nullable=True)
    abstract = Column(Text, nullable=True)
    # Attribution only (like file_assets.owner_id): a version created by an
    # editor on someone else's file must survive that editor's account deletion,
    # so ON DELETE SET NULL rather than CASCADE.
    created_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    checkpoint_type = Column(String(10), nullable=False, default='manual')

    file = relationship("File", back_populates="versions")
    creator = relationship("User")


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
    # sha256 hex of the decoded content bytes, set on every write. Lets the asset
    # URL carry a cache-stable, content-derived version without rehashing the bytes
    # on every render (std-do5t). Nullable for rows written before the column
    # existed; the resolver falls back to hashing on the fly for those.
    content_hash = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # owner_id is attribution only; SET NULL ensures assets survive when the
    # uploader leaves a file or their account is deleted.
    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    file_id = Column(
        Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )

    owner = relationship("User", back_populates="file_assets")
    file = relationship("File", back_populates="file_assets")


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


class Reaction(Base):
    """A reaction badge on a manuscript paragraph.

    Anchored by node_id (the stable data-nodeid attribute on content blocks).
    One reaction per user per node — upserting replaces the previous reaction_type.
    """

    __tablename__ = "reaction"
    # These indexes already exist in the DB (migration f1a2b3c4d5e6). They are
    # declared here only so the model matches the schema; no migration adds them.
    __table_args__ = (
        Index("ix_reaction_file_id", "file_id"),
        Index("ix_reaction_owner_node", "owner_id", "file_id", "node_id", unique=True),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(String, nullable=False)
    reaction_type = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    file = relationship("File", back_populates="reactions")
    owner = relationship("User", back_populates="reactions")
