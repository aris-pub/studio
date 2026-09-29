"""Annotations and annotation messages."""

import enum

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from aris.models.base import Base


class AnnotationVisibility(str, enum.Enum):
    PRIVATE = "private"
    SHARED = "shared"


class Annotation(Base):
    __tablename__ = "annotation"
    __table_args__ = (
        Index("ix_annotation_file_id", "file_id"),
        Index("ix_annotation_owner_id", "owner_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    # CASCADE on both: an annotation is personal content, removed when either its
    # file or its author's account is deleted.
    file_id = Column(
        Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    color = Column(String, nullable=False, default="purple")
    visibility: Column[AnnotationVisibility] = Column(
        Enum(AnnotationVisibility), nullable=False, default=AnnotationVisibility.PRIVATE
    )
    anchor_data = Column(JSON, nullable=False)
    selected_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    # Resolve is distinct from delete: the thread is settled and hidden by default
    # but kept, so it can be reopened or restored later (std-9325). resolved_by is
    # attribution only, SET NULL on erasure like the other actor columns.
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    messages = relationship(
        "AnnotationMessage", back_populates="annotation", cascade="all, delete-orphan"
    )
    file = relationship("File", back_populates="annotations")
    # foreign_keys pinned: the table now has two FKs to users (owner_id, resolved_by).
    owner = relationship(
        "User", foreign_keys=[owner_id], back_populates="owned_annotations"
    )


class AnnotationMessage(Base):
    __tablename__ = "annotation_message"
    __table_args__ = (
        Index("ix_annotation_message_annotation_id", "annotation_id"),
        Index("ix_annotation_message_owner_id", "owner_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    annotation_id = Column(
        Integer, ForeignKey("annotation.id", ondelete="CASCADE"), nullable=False
    )
    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    annotation = relationship("Annotation", back_populates="messages")
    owner = relationship("User", back_populates="annotation_messages")


