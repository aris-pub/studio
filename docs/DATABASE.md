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
