"""File assets: owner_id FK CASCADE -> SET NULL, make nullable

Assets live with the file (file_id FK has CASCADE). owner_id is attribution
only and must not drive asset lifetime — so when the uploader leaves, assets
must persist for all collaborators.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-18
"""

import sqlalchemy as sa

from alembic import op


revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        # SQLite doesn't enforce FK constraints; batch mode recreates the table
        # with the column made nullable, which is all that matters here.
        with op.batch_alter_table("file_assets", schema=None) as batch_op:
            batch_op.alter_column("owner_id", existing_type=sa.Integer(), nullable=True)
    else:
        op.alter_column("file_assets", "owner_id", existing_type=sa.Integer(), nullable=True)
        op.drop_constraint("file_assets_owner_id_fkey", "file_assets", type_="foreignkey")
        op.create_foreign_key(
            "fk_file_assets_owner_id",
            "file_assets",
            "users",
            ["owner_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("file_assets", schema=None) as batch_op:
            batch_op.alter_column("owner_id", existing_type=sa.Integer(), nullable=False)
    else:
        op.drop_constraint("fk_file_assets_owner_id", "file_assets", type_="foreignkey")
        op.create_foreign_key(
            "file_assets_owner_id_fkey",
            "file_assets",
            "users",
            ["owner_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.alter_column("file_assets", "owner_id", existing_type=sa.Integer(), nullable=False)
