"""Pending magic-link collaborator invitations (std-nbpwwn).

A file owner can invite a collaborator by email. If that email has no Studio
account yet, we store a pending invitation here and email a magic link. The link
carries a high-entropy token; we store only its SHA-256 hash, so a database read
never reveals a live invite link. One-time use is enforced at consume time by a
conditional update of ``consumed_at``.
"""

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aris.models.base import Base
from aris.models.permission import FileRole


class FileInvitation(Base):
    """An outstanding invitation to collaborate on a file, keyed by a hashed token."""

    __tablename__ = "file_invitations"
    __table_args__ = (
        Index("uq_file_invitations_token_hash", "token_hash", unique=True),
        Index("ix_file_invitations_file_id", "file_id"),
        Index("ix_file_invitations_invited_email", "invited_email"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    # SHA-256 hex of the raw token. The raw token lives only in the emailed link.
    token_hash = Column(String(64), nullable=False)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    invited_email = Column(String, nullable=False)
    role: Mapped[FileRole] = mapped_column(Enum(FileRole, name="filerole"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    # Attribution only: SET NULL so removing the inviting account does not block
    # the hard-delete job (the row itself goes via the file_id CASCADE).
    granted_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    file = relationship("File")
    grantor = relationship("User", foreign_keys=[granted_by])
