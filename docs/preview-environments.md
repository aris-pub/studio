# Preview environments

Every PR against `aris-pub/studio` gets its own ephemeral environment:

- **Backend**: `aris-backend-pr-N.fly.dev` (fly app + attached fly postgres at `aris-backend-pr-N-db`).
- **Frontend**: `pr-N--<netlify-site>.netlify.app` (Netlify deploy preview).
- **Test user**: `preview-pr-N@aris.pub`, password is the `PREVIEW_TEST_PASSWORD` repo secret.

The PR comment includes all three URLs once the deploy finishes (~2-3 min).

## Lifecycle

| Event | What happens |
|---|---|
| PR opened / reopened | `preview.yml` provisions fly app + db, deploys backend, builds + uploads frontend, comments URLs |
| Push to PR | Re-deploys onto the existing app (idempotent — app + db are reused) |
| PR closed or merged | `preview.yml`'s `destroy` job tears down the fly app and its db |
| Weekly Sunday 04:17 UTC | `cleanup-orphans.yml` cross-checks fly's preview apps against open PRs, destroys any orphans |

## Manual cleanup

Sometimes the close-event hook misses (workflow cancelled, webhook hiccup, etc). The
weekly cron is the catch-all, but to clean up immediately:

```bash
flyctl apps destroy aris-backend-pr-N --yes
flyctl apps destroy aris-backend-pr-N-db --yes
```

Always destroy the app before the db so the postgres attachment resolves cleanly.

To list all preview apps that fly currently knows about:

```bash
flyctl apps list --json | jq -r '.[].Name | select(test("^aris-backend-pr-[0-9]+(-db)?$"))'
```

To force-run the orphan-cleanup cron without waiting for Sunday:

```bash
gh workflow run cleanup-orphans.yml --repo aris-pub/studio
```

## What this replaced

Until April 2026, studio had a persistent `aris-backend-staging` fly app + a permanently
running fly postgres for staging. It was idle ~65% of the time and cost ~$8/mo. The
old `staging.yml` workflow has been deleted; per-PR previews cover its use cases at
~$3/mo across actual development cadence.

If you need a long-lived demo URL, open a PR labelled `demo` and leave it open — its
preview environment stays up for the PR's lifetime.

## Cost expectations

- Per-PR fly postgres: `shared-cpu-1x / 512MB / 1GB volume` ≈ $5/mo prorated 24/7.
- At ~23 PR-days/month average cadence: total ≈ $3-4/mo.
- Set a fly spend alert at $20/mo as a runaway-cost canary.

## When things go wrong

- **Preview deploy stuck or failing**: check the GitHub Action run, then `flyctl logs --app aris-backend-pr-N`.
- **Seed step fails loudly** (no longer silenced): the test user couldn't be created. Likely causes: idempotency bug in `scripts/reset_test_user.py`, transient ssh, or DB not actually ready. The wait loop on `/docs` (line 167 of `preview.yml`) already gates on uvicorn being up — and uvicorn only starts after `alembic upgrade head` runs in the Dockerfile CMD — so migration timing is not the cause.
- **Orphan cleanup destroyed something it shouldn't have**: it shouldn't, because it `exit 1`s if `gh pr list` fails. But if it does, the only data loss is a per-PR test database; the PR itself is unaffected and the next workflow run will re-provision.
