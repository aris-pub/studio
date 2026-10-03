"""add file_invitations table for magic-link collaborator invites (std-nbpwwn)

Additive new table. Routine per the migration runbook: precheck then deploy, no
dry-run. A new table does not get RLS for free, so this mirrors the project RLS
pattern (enable RLS, allow the postgres app role, revoke from the Supabase
PostgREST roles, which only exist on Supabase, hence the guarded block). Re-run
the read-only prod precheck after deploy, since the RLS part cannot be exercised
against SQLite locally.

Revision ID: q2f3a4b5c6d7
Revises: p1e2f3a4b5c6
Create Date: 2026-10-03
"""

import sqlalchemy as sa

from alembic import op


revision = "q2f3a4b5c6d7"
down_revision = "p1e2f3a4b5c6"
branch_labels = None
depends_on = None

TABLE = "file_invitations"
SUPABASE_API_ROLES = ["anon", "authenticated"]


def upgrade():
    op.create_table(
        TABLE,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "file_id",
            sa.Integer(),
            sa.ForeignKey("files.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("invited_email", sa.String(), nullable=False),
        # Reuse the existing filerole enum type; do not recreate it.
        sa.Column(
            "role",
            sa.Enum("OWNER", "EDITOR", "COMMENTER", name="filerole", create_type=False),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "granted_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("uq_file_invitations_token_hash", TABLE, ["token_hash"], unique=True)
    op.create_index("ix_file_invitations_file_id", TABLE, ["file_id"])
    op.create_index("ix_file_invitations_invited_email", TABLE, ["invited_email"])

    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f'CREATE POLICY "{TABLE}_service_full_access" ON {TABLE} '
        f"FOR ALL TO postgres USING (true) WITH CHECK (true)"
    )
    for role in SUPABASE_API_ROLES:
        op.execute(
            f"DO $$ BEGIN "
            f"EXECUTE 'REVOKE ALL ON {TABLE} FROM {role}'; "
            f"EXCEPTION WHEN undefined_object THEN NULL; "
            f"END $$"
        )


def downgrade():
    op.execute(f'DROP POLICY IF EXISTS "{TABLE}_service_full_access" ON {TABLE}')
    op.execute(f"ALTER TABLE {TABLE} DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_file_invitations_invited_email", table_name=TABLE)
    op.drop_index("ix_file_invitations_file_id", table_name=TABLE)
    op.drop_index("uq_file_invitations_token_hash", table_name=TABLE)
    op.drop_table(TABLE)
