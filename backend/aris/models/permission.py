"""File permission roles and grants."""

import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from aris.models.base import Base


class FileRole(enum.Enum):
    """Enum for file permission roles.

    Attributes
    ----------
    OWNER : str
        Full control over file, can manage collaborators.
    EDITOR : str
        Can edit and comment, cannot manage collaborators.
    COMMENTER : str
        Can view and comment only.

    """

    OWNER = "OWNER"
    EDITOR = "EDITOR"
    COMMENTER = "COMMENTER"


class FilePermission(Base):
    """Represents a user's permission level for a file.

    Attributes
    ----------
    id : int
        Primary key.
    file_id : int
        Foreign key to File.
    user_id : int
        Foreign key to User.
    role : FileRole
        Permission role (OWNER, EDITOR, COMMENTER).
    granted_at : datetime
        When permission was granted.
    granted_by : int
        User ID who granted the permission.
    deleted_at : datetime
        Timestamp for soft deletes.

    """

    __tablename__ = "file_permissions"
    __table_args__ = (
        # Partial unique index rather than UniqueConstraint(file_id, user_id,
        # deleted_at): NULL != NULL in a unique constraint, so the plain version let
        # two active (deleted_at IS NULL) rows exist for the same user and file. This
        # enforces one active permission per user per file while still allowing many
        # soft-deleted rows. See std-3gj40g.
        Index(
            "uq_active_file_user_permission",
            "file_id",
            "user_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_file_permissions_file_id", "file_id"),
        Index("ix_file_permissions_user_id", "user_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[FileRole] = mapped_column(
        Enum(FileRole, name="filerole"), nullable=False
    )
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    # Attribution only: SET NULL so deleting the granting account does not block
    # the hard-delete job (the grant row itself is removed via file_id CASCADE).
    granted_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    # Who revoked (soft-deleted) this grant. Attribution only, SET NULL on
    # erasure like granted_by (std-x4a4h9).
    revoked_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    file = relationship("File", back_populates="permissions")
    user = relationship("User", foreign_keys=[user_id], back_populates="file_permissions")
    grantor = relationship("User", foreign_keys=[granted_by])
    revoker = relationship("User", foreign_keys=[revoked_by])


