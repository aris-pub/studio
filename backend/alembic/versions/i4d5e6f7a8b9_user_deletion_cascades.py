"""User deletion cascades: let the DB purge an account's data on user delete

Aligns the foreign keys that reference users (and the annotation/file chain
reachable from them) with the ORM's already-declared cascade intent, so the
hard-delete retention job can run a plain DELETE FROM users and have the
database remove the account's owned content transitively.

- CASCADE for owned content:
    files.owner_id, annotation.owner_id, annotation.file_id,
    annotation_message.owner_id, annotation_message.annotation_id
- SET NULL for attribution-only references that must survive on other users'
  files (mirrors file_assets.owner_id):
    file_versions.created_by, file_permissions.granted_by
- SET NULL for the self-referential files.prev_version_id

created_by and granted_by become nullable to allow the SET NULL. The original
constraints carried no ON DELETE clause (database default), so downgrade
restores them without one.

Revision ID: i4d5e6f7a8b9
Revises: h3c4d5e6f7a8
Create Date: 2026-07-14
"""

import sqlalchemy as sa

from alembic import op


revision = "i4d5e6f7a8b9"
down_revision = "h3c4d5e6f7a8"
branch_labels = None
depends_on = None


# (table, column, ref_table, ref_column, existing_constraint_name, new_ondelete)
# existing names are the real ones in the DB: all follow "<table>_<column>_fkey"
# except annotation.owner_id, which an earlier migration named fk_annotation_owner_id.
_CASCADES = [
    ("files", "owner_id", "users", "id", "files_owner_id_fkey", "CASCADE"),
    ("files", "prev_version_id", "files", "id", "files_prev_version_id_fkey", "SET NULL"),
    ("file_versions", "created_by", "users", "id", "file_versions_created_by_fkey", "SET NULL"),
    ("annotation", "owner_id", "users", "id", "fk_annotation_owner_id", "CASCADE"),
    ("annotation", "file_id", "files", "id", "annotation_file_id_fkey", "CASCADE"),
    (
        "annotation_message",
        "owner_id",
        "users",
        "id",
        "annotation_message_owner_id_fkey",
        "CASCADE",
    ),
    (
        "annotation_message",
        "annotation_id",
        "annotation",
        "id",
        "annotation_message_annotation_id_fkey",
        "CASCADE",
    ),
    (
        "file_permissions",
        "granted_by",
        "users",
        "id",
        "file_permissions_granted_by_fkey",
        "SET NULL",
    ),
]

# Columns that must become nullable so ON DELETE SET NULL is legal.
_NULLABLE = [("file_versions", "created_by"), ("file_permissions", "granted_by")]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        # SQLite does not enforce FK ON DELETE; only the nullability matters.
        for table, column in _NULLABLE:
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.alter_column(column, existing_type=sa.Integer(), nullable=True)
        return

    for table, column in _NULLABLE:
        op.alter_column(table, column, existing_type=sa.Integer(), nullable=True)
    for table, column, ref_table, ref_column, old_name, new in _CASCADES:
        op.drop_constraint(old_name, table, type_="foreignkey")
        op.create_foreign_key(
            f"fk_{table}_{column}", table, ref_table, [column], [ref_column], ondelete=new
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        for table, column in _NULLABLE:
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.alter_column(column, existing_type=sa.Integer(), nullable=False)
        return

    # Restore the original constraints (name + no ON DELETE clause).
    for table, column, ref_table, ref_column, old_name, _new in _CASCADES:
        op.drop_constraint(f"fk_{table}_{column}", table, type_="foreignkey")
        op.create_foreign_key(old_name, table, ref_table, [column], [ref_column])
    for table, column in _NULLABLE:
        op.alter_column(table, column, existing_type=sa.Integer(), nullable=False)
