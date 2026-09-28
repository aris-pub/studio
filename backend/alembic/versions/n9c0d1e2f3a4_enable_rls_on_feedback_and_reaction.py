"""Enable Row Level Security on feedback and reaction

Migration c3d4e5f6a7b8 enabled RLS on every table that existed at the
time, but the feedback (c2c4fe54bfd7) and reaction (f1a2b3c4d5e6) tables
were added afterwards, so they were never covered. This migration
applies the same pattern to those two tables: enable RLS, add the
permissive postgres policy the FastAPI backend relies on, and revoke all
privileges from Supabase's anon and authenticated PostgREST roles.

The anon/authenticated roles only exist on Supabase, not on local
Docker, so the REVOKE is wrapped to ignore undefined_object errors, the
same as c3d4e5f6a7b8.

Revision ID: n9c0d1e2f3a4
Revises: m8b9c0d1e2f3
Create Date: 2026-09-28
"""

from alembic import op


revision = "n9c0d1e2f3a4"
down_revision = "m8b9c0d1e2f3"
branch_labels = None
depends_on = None

TABLES = [
    "feedback",
    "reaction",
]

SUPABASE_API_ROLES = ["anon", "authenticated"]


def upgrade():
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f'CREATE POLICY "{table}_service_full_access" ON {table} '
            f"FOR ALL TO postgres USING (true) WITH CHECK (true)"
        )

    # Revoke direct table access from Supabase PostgREST roles.
    # These roles only exist on Supabase instances, not local Docker,
    # so we catch undefined_object errors gracefully.
    for table in TABLES:
        for role in SUPABASE_API_ROLES:
            op.execute(
                f"DO $$ BEGIN "
                f"EXECUTE 'REVOKE ALL ON {table} FROM {role}'; "
                f"EXCEPTION WHEN undefined_object THEN NULL; "
                f"END $$"
            )


def downgrade():
    for table in TABLES:
        op.execute(f'DROP POLICY IF EXISTS "{table}_service_full_access" ON {table}')
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
