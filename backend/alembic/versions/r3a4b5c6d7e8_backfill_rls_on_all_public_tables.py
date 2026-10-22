"""Backfill Row Level Security on every public table, name-agnostic

Migrations c3d4e5f6a7b8 (the original 13 tables), n9c0d1e2f3a4 (feedback,
reaction), and q2f3a4b5c6d7 (file_invitations) each enabled RLS on a
hardcoded list of table names. That approach misses any table added later
that forgets the pattern, and any table created by hand in the Supabase
SQL editor, which is why the Security Advisor kept flagging one table even
after we thought it was handled.

This migration stops tracking table names. It loops over every base table
in the public schema that the migration role owns, enables RLS, adds the
same permissive postgres policy the FastAPI backend relies on (the backend
connects as the table owner, which bypasses RLS, so the policy is a safety
net), and revokes all privileges from the anon and authenticated PostgREST
roles.

It is idempotent: enabling RLS on an already-enabled table is a no-op, the
policy is created only when it is absent, and the REVOKEs are wrapped for
the local case where anon/authenticated do not exist. Re-running it is
safe, which is why the weekly rls-health-check workflow can treat this as
the steady state.

The owner filter (tableowner = current_user) means a table owned by some
other role is skipped rather than failing the whole batch. That case is
not expected on this schema, and if it ever happens the health check
surfaces it to a human instead of breaking a deploy.

RLS and role grants cannot be exercised by the SQLite test suite or a
local dump (anon/authenticated do not exist and --no-privileges strips
grants), so this ships as a routine, idempotent migration. Confirm with
the read-only precheck against prod right after deploy.

Revision ID: r3a4b5c6d7e8
Revises: d7e8f9a0b1c2
Create Date: 2026-10-22
"""

from alembic import op


revision = "r3a4b5c6d7e8"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        DO $$
        DECLARE
            t text;
            policy_name text;
        BEGIN
            FOR t IN
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                  AND tableowner = current_user
            LOOP
                EXECUTE format(
                    'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t
                );

                policy_name := t || '_service_full_access';
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename = t
                      AND policyname = policy_name
                ) THEN
                    EXECUTE format(
                        'CREATE POLICY %I ON public.%I '
                        'FOR ALL TO postgres USING (true) WITH CHECK (true)',
                        policy_name, t
                    );
                END IF;

                BEGIN
                    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
                    EXECUTE format(
                        'REVOKE ALL ON public.%I FROM authenticated', t
                    );
                EXCEPTION WHEN undefined_object THEN
                    NULL;
                END;
            END LOOP;
        END $$;
        """
    )


def downgrade():
    # No downgrade. This migration only hardens access: it enables RLS and
    # removes the anon/authenticated grants. Reversing it in bulk would
    # re-expose every table to the public PostgREST roles, which is never
    # the intended state. To undo RLS on one specific table, write a
    # targeted migration for it.
    pass
