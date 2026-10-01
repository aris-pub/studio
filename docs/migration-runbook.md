# Migration runbook (Alembic, Supabase, Fly)

One engineer plus agents, pre-beta, near-zero rows. This is the short version of
how to ship an Alembic migration without a bad day. It is deliberately not an
enterprise change-management process. Related: `docs/DATABASE.md` (schema and
deletion policy).

## How a deploy applies migrations

The Fly image runs `alembic upgrade head` before `supervisord` (see
`backend/Dockerfile`), and `backend/alembic/env.py` runs the whole batch in one
transaction. Postgres DDL is transactional, so an upgrade is atomic: if any
migration fails, the entire batch rolls back (including the `alembic_version`
bump), the container exits non-zero, the new machine never passes its health
check, and Fly keeps serving the old machine. Prod stays up and the database sits
at the pre-deploy revision, consistent. This is why most "partial migration"
worries do not apply here.

## Every migration: the read-only precheck

Before `just deploy-backend`, run the read-only precheck against prod. Base64 a
small Python script and run it with `fly ssh console -a aris-backend`, using
asyncpg with `connect_args={"statement_cache_size": 0}` (the Supabase pooler
requires that). Print only:

- the current head revision, so you know exactly which migrations are about to run,
- that the columns and tables the migration assumes exist (or do not, for an add),
- a row-count sense of scale.

Never print secrets. For a routine migration this is the only check you need.

## Is this migration risky?

Risky if it does any of these:

- (a) writes or deletes existing rows (a backfill, repair, or collapse),
- (b) drops or renames a column or table, or changes a column type,
- (c) adds a NOT NULL, unique, or check constraint that existing rows must satisfy,
- (d) changes RLS policies or role grants,
- (e) switches which column the app reads, or otherwise reinterprets existing data.

Quick tell: a plain `op.add_column` / `op.create_table` / `op.create_index` is
routine. Raw `op.execute`, a backfill, a constraint on existing rows, or a foreign
key change is risky.

Routine (add a nullable column, a new table, an index, a column with a default the
old code tolerates): precheck, then deploy. Risky: dry-run first.

## Risky migration: dry-run before deploy

Run the migration against a local Postgres loaded with real prod data. Local is
faithful enough because the risk is almost always about what the rows look like,
and the backend connects as the table owner, which bypasses RLS the same way
locally and on Supabase.

1. Trigger the backup workflow by hand (`workflow_dispatch` on
   `database-backup.yml`), download the artifact, `gunzip` it.
2. `createdb aris_dryrun` on a local Postgres, then `psql aris_dryrun < dump.sql`.
   The dump is `--schema=public --no-owner --no-privileges` plain SQL, so it loads
   into a fresh local superuser DB with no fixups.
3. Point Alembic at it (`ALEMBIC_DB_URL_LOCAL`) and run `alembic upgrade head`.
4. Verify the thing the migration claims to do (for a data repair, that the bad
   rows are gone; for a constraint, that it built and the duplicates are absent;
   for a drop, that nothing the app needs is gone), then run a hot read query or
   two against the migrated DB.

Two notes:

- Run migrations against the direct or session connection, not the transaction
  pooler (DDL through the transaction pooler is unreliable). The read-only
  precheck stays on the pooler with `statement_cache_size=0`. Confirm which
  connection `ALEMBIC_DB_URL_PROD` points at before the first risky deploy.
- RLS or role-grant changes cannot be tested locally: the dump strips grants
  (`--no-privileges`) and the Supabase `anon` / `authenticated` roles do not exist
  locally. Use a Supabase branch if your plan has branching. If not, lean on the
  boot-time safety net and re-run the read-only precheck against prod right after
  deploy to confirm the app role still reads what it should.

## Two-phase changes (only when the rollover window would break old code)

During a deploy Fly keeps the old machine serving until the new one is healthy, so
for a moment the old code runs against the new schema. Split a change into two
deploys only when that window would break the still-running old code, which is
exactly two cases:

- dropping or renaming something the deployed code still reads or writes, or
- tightening a constraint (NOT NULL, unique) that the old code's inserts would
  violate because old code does not set the new value.

Pattern: Phase 1 adds the new column or table, backfills it, and has the new code
write both old and new. Phase 2, a later ordinary deploy, switches reads to the
new, stops writing the old, and drops the old. Phase 2 is not special machinery,
just the next deploy. Everything else (a nullable column, a new table, an index)
ships in one migration. Do not phase changes that do not need it.

## If a deploy fails

- Failed to boot (the common case): nothing applied, the DB is untouched, the old
  machine is still serving. Fail forward: fix the migration or pre-clean the data,
  deploy again. There is nothing to roll back.
- A bad migration committed and is live (rare): for a schema change that has a real
  `downgrade`, run it by hand with `fly ssh console -a aris-backend -C "alembic
  downgrade <rev>"`. For a destructive data change (this repo's convention is no
  data downgrade), restore the affected rows from the daily dump or write a
  forward-fix migration. This is the real reason the daily backup matters.
- A true `alembic_version` vs schema mismatch can only happen if a migration steps
  outside the single transaction (`CREATE INDEX CONCURRENTLY`, an explicit
  `COMMIT`, or hand-run SQL). None of the current migrations do. If you ever write
  one, make its operations idempotent (`IF NOT EXISTS`, drop-before-create) and fix
  a mismatch with `alembic stamp <rev>`, then re-run.

## Project gotchas

- Tests run on SQLite, prod on Postgres plus Supabase, and migrations branch on
  the dialect (the FK-cascade migration literally skips the FK work on SQLite). So
  a green test suite does not exercise FK cascades, partial unique indexes, RLS, or
  Supabase REVOKEs. The risky parts are the Postgres-only parts the tests skip,
  which is the whole reason to dry-run risky migrations against real Postgres.
- A new table does not get RLS for free. Supabase's Security Advisor flags every
  table without it. Pair a new-table migration with ENABLE RLS, a postgres policy,
  and a REVOKE, and put the REVOKE in a `DO ... EXCEPTION WHEN undefined_object`
  block because the `anon` / `authenticated` roles do not exist on local Docker.
- Tightening a constraint means cleaning the data in the same migration, above the
  constraint (collapse duplicate active rows before building the partial unique
  index). Skip that and the build fails, which fails the boot.
- On soft-deleted tables do not put a nullable `deleted_at` in a plain UNIQUE
  constraint: NULL is not equal to NULL, so it never dedupes active rows. Use a
  partial unique index `WHERE deleted_at IS NULL`. This repo soft-deletes heavily,
  so it recurs.

## Deliberately out of scope (current scale)

No staging mirror, approval gates, maintenance windows, blue/green, or a
CONCURRENTLY / online-DDL playbook: the tables are tiny, there is no write traffic
to block, there is one engineer, and Fly already holds the old machine until the
new one is healthy. Revisit index strategy and PITR (a Supabase Pro item) when
there is real traffic.
