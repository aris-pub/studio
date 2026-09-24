"""One active permission per user per file via a partial unique index

The old constraint was UNIQUE (file_id, user_id, deleted_at). NULL != NULL in a
unique constraint, so it never deduped active rows: a user removed and re-added
(soft-delete + new row) could end up with two rows whose deleted_at is NULL for
the same (file_id, user_id). Two active OWNER rows also let revocation be
bypassed, because revoking one row left the other active and the user's access
refresh kept succeeding (see std-3gj40g and std-knez).

This replaces that constraint with a partial unique index over (file_id,
user_id) WHERE deleted_at IS NULL, so at most one active permission can exist per
user per file while any number of soft-deleted rows remain.

Existing active duplicates are collapsed first, keeping the most recently granted
row per (file_id, user_id) and soft-deleting the rest, so the index can be built.

There is no data downgrade: the collapsed rows were duplicates and are not worth
restoring. The downgrade only puts the old constraint shape back.

Revision ID: k6f7a8b9c0d1
Revises: j5e6f7a8b9c0
Create Date: 2026-09-24

"""

import sqlalchemy as sa

from alembic import op


revision = "k6f7a8b9c0d1"
down_revision = "j5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Collapse active duplicates, then swap the constraint for a partial index."""
    # Keep the most recently granted active row per (file_id, user_id); soft-delete
    # any older active row for the same pair so the partial unique index can build.
    op.execute(
        """
        UPDATE file_permissions p
        SET deleted_at = NOW()
        WHERE p.deleted_at IS NULL
          AND EXISTS (
              SELECT 1 FROM file_permissions q
              WHERE q.file_id = p.file_id
                AND q.user_id = p.user_id
                AND q.deleted_at IS NULL
                AND (q.granted_at > p.granted_at
                     OR (q.granted_at = p.granted_at AND q.id > p.id))
          )
        """
    )
    op.drop_constraint("uq_file_user_permission", "file_permissions", type_="unique")
    op.create_index(
        "uq_active_file_user_permission",
        "file_permissions",
        ["file_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    """Restore the old constraint shape. Collapsed duplicates are not restored."""
    op.drop_index("uq_active_file_user_permission", table_name="file_permissions")
    op.create_unique_constraint(
        "uq_file_user_permission",
        "file_permissions",
        ["file_id", "user_id", "deleted_at"],
    )
