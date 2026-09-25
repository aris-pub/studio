"""Add missing indexes on annotation, annotation_message, and files

The annotation and annotation_message tables had no indexes beyond their
primary keys, and files was only indexed on version and prev_version_id. Common
lookups (annotations by file or owner, messages by annotation or owner, files by
owner, soft-delete filtering, and recent-edit ordering) had no index to use.

This adds the missing indexes. It does not touch reaction or file_permissions:
their indexes already exist (migrations f1a2b3c4d5e6 and k6f7a8b9c0d1).

Revision ID: l7a8b9c0d1e2
Revises: k6f7a8b9c0d1
Create Date: 2026-09-25

"""

from alembic import op


revision = "l7a8b9c0d1e2"
down_revision = "k6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_annotation_file_id", "annotation", ["file_id"])
    op.create_index("ix_annotation_owner_id", "annotation", ["owner_id"])
    op.create_index(
        "ix_annotation_message_annotation_id", "annotation_message", ["annotation_id"]
    )
    op.create_index(
        "ix_annotation_message_owner_id", "annotation_message", ["owner_id"]
    )
    op.create_index("ix_files_owner_id", "files", ["owner_id"])
    op.create_index("ix_files_deleted_at", "files", ["deleted_at"])
    op.create_index("ix_files_last_edited_at", "files", ["last_edited_at"])


def downgrade() -> None:
    op.drop_index("ix_files_last_edited_at", table_name="files")
    op.drop_index("ix_files_deleted_at", table_name="files")
    op.drop_index("ix_files_owner_id", table_name="files")
    op.drop_index(
        "ix_annotation_message_owner_id", table_name="annotation_message"
    )
    op.drop_index(
        "ix_annotation_message_annotation_id", table_name="annotation_message"
    )
    op.drop_index("ix_annotation_owner_id", table_name="annotation")
    op.drop_index("ix_annotation_file_id", table_name="annotation")
