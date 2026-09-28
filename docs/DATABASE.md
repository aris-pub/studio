# Database

Prod uses **Supabase** Postgres (`aws-0-eu-central-1.pooler.supabase.com`). The
app connects through the transaction pooler (port 6543); backups use the session
pooler (port 5432) because `pg_dump` needs session-level connections.

## Backups

Bootstrap-phase backups run as GitHub Actions (mirrors the Press repo), no paid
tier required.

- **`.github/workflows/database-backup.yml`** — daily at 2 AM UTC (and manual via
  `gh workflow run database-backup.yml`). Runs `pg_dump --schema=public`, gzips,
  verifies the dump contains the core tables (`users`, `files`), and uploads it as
  a private GitHub Actions **artifact**. Retention 30 days; a cleanup job keeps the
  7 most recent.
- **`.github/workflows/backup-health-check.yml`** — twice daily (9 AM / 9 PM UTC).
  Emails an alert (Resend) and fails the run if the latest backup artifact is
  missing or older than 48 hours.

Only the `public` schema is dumped: that is where all studio application data
lives. Supabase-managed schemas (`auth`, `storage`, extensions) are Supabase's
responsibility and the app role cannot fully dump them.

## Deletion policy

Everything soft-deletes by default: a delete sets a `deleted_at` timestamp and
the row stays, so application queries filter it out while the data remains
recoverable. Hard deletion (physically removing the row) happens in exactly one
place, the GDPR retention purge below (`hard_delete_expired_users`), which
erases accounts for good once the grace window has passed.

Two deliberate exceptions, where soft delete would not help:

- **`reaction`** is an ephemeral per-paragraph emoji badge (one per user per
  node, toggled on and off). Un-reacting hard-deletes the row. There is no
  meaningful history to keep.
- **`signup`** is the mailing-list record, keyed by email and not part of the
  application's own data. It is hard-deleted when the matching account is
  deleted, which is the correct behaviour for a contact record.

Who acted is recorded for attribution, not only when: `file_permissions.granted_by`
and `revoked_by`, `file_versions.created_by`, `file_assets.owner_id`,
`files.deleted_by`, and `users.deleted_by`. All are nullable and `ON DELETE SET
NULL`, so erasing an account anonymizes these references (the contribution
survives without naming the erased user) instead of orphaning the row or
blocking the purge.

## Account deletion (GDPR erasure)

Two stages:

1. **Soft delete (immediate).** `DELETE /users/{id}` (`aris.crud.user.soft_delete_user`)
   cascades a `deleted_at` timestamp across every table holding the account's
   data, so "delete my account" removes it from the application at once.
   Contributions to other users' files (uploaded assets, named versions) are
   kept as attribution-only and survive.
2. **Hard delete (after 30 days).** The **`.github/workflows/purge-deleted-accounts.yml`**
   cron (daily at 3 AM UTC, after the backup; `dry_run` input for a count-only
   run) permanently deletes accounts whose `deleted_at` is older than 30 days.
   It is two `DELETE`s; the database does the rest through the `ON DELETE`
   cascades added in the `user_deletion_cascades` migration
   (`CASCADE` for owned content, `SET NULL` for attribution). This mirrors
   `aris.crud.user.hard_delete_expired_users` — keep the 30-day window in sync.

A deleted account's data can therefore persist for up to ~60 days total: the
30-day soft-delete grace window plus the 30-day backup-artifact retention.

### Restore (manual)

```bash
# download the artifact from the workflow run, then:
gunzip -c studio_backup_YYYYMMDD_HHMMSS.sql.gz | \
  psql "postgresql://<user>:<pw>@<host>:5432/postgres"
```

### Required GitHub secrets

`DATABASE_HOST`, `DATABASE_PORT` (5432), `DATABASE_NAME`, `DATABASE_USER`,
`DATABASE_PASSWORD`, plus `RESEND_API_KEY` and `FROM_EMAIL` for the health-check
alert.

### Later

Graduate to Supabase Pro (daily backups + point-in-time recovery) or push dumps to
external object storage (S3/R2) as the user base grows. End-to-end restore
rehearsal into a throwaway DB is a worthwhile follow-up.
