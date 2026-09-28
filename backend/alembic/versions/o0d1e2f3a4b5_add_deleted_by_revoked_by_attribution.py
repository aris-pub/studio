"""Add deleted_by and revoked_by attribution columns

Records who soft-deletes a file or user and who revokes a permission. These
are attribution only, nullable, and ON DELETE SET NULL so GDPR erasure of the
acting account anonymizes them rather than orphaning the row or blocking the
retention purge. Same pattern as file_permissions.granted_by (std-x4a4h9).

Revision ID: o0d1e2f3a4b5
Revises: n9c0d1e2f3a4
Create Date: 2026-09-28
"""

import sqlalchemy as sa

from alembic import op


revision = "o0d1e2f3a4b5"
down_revision = "n9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "file_permissions", sa.Column("revoked_by", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_file_permissions_revoked_by_users",
        "file_permissions",
        "users",
        ["revoked_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("files", sa.Column("deleted_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_files_deleted_by_users",
        "files",
        "users",
        ["deleted_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("users", sa.Column("deleted_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_deleted_by_users",
        "users",
        "users",
        ["deleted_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_users_deleted_by_users", "users", type_="foreignkey")
    op.drop_column("users", "deleted_by")

    op.drop_constraint("fk_files_deleted_by_users", "files", type_="foreignkey")
    op.drop_column("files", "deleted_by")

    op.drop_constraint(
        "fk_file_permissions_revoked_by_users", "file_permissions", type_="foreignkey"
    )
    op.drop_column("file_permissions", "revoked_by")
