"""Enable Row Level Security on all tables

Supabase Security Advisor flagged 28 errors because no tables had RLS
enabled. This migration enables RLS on every table and adds a
permissive policy for the postgres role (table owner) so the FastAPI
backend — which connects as postgres — is unaffected.

Additionally revokes all privileges from Supabase's anon and
authenticated PostgREST roles (defense-in-depth). RLS already denies
access when no matching policy exists, but explicit revocation blocks
even schema-level enumeration.

Note: the postgres role (table owner/superuser) bypasses RLS by
default, so the explicit allow-all policy is a safety net in case the
connection role changes in the future.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-27
"""

from alembic import op


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None

TABLES = [
    "users",
    "profile_pictures",
    "files",
    "file_tags",
    "file_versions",
    "tags",
    "file_assets",
    "user_settings",
    "file_settings",
    "annotation",
    "annotation_message",
    "signups",
    "file_permissions",
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
