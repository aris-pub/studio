# Environments

RSM Studio runs in four environments. They differ in how services are
orchestrated and — importantly — where the `rsm` dependency comes from.

| Environment | Purpose | Orchestration | Where it runs |
|---|---|---|---|
| **Dev** | Local development | Docker Compose (`docker/docker-compose.dev.yml`) | Developer's machine |
| **Test (CI)** | Automated tests on every push / PR | Docker Compose for E2E; bare runners for unit | GitHub Actions |
| **Staging (preview)** | Per-PR ephemeral deploy for human review | Single containerized image | Fly.io (`aris-backend-pr-N`) + Netlify |
| **Prod** | The live service | Single containerized image | Fly.io (`aris-backend`) + Netlify |

## The `rsm` dependency

`rsm` ships in three pieces, and each environment sources them slightly
differently. This is the most common source of "works here, not there"
confusion, so it is spelled out explicitly.

- **`rsm-lang`** — the Python package. Contains the RSM renderer and the
  browser-served static assets (`rsm/static/*.js`, including `libraries.js`).
- **`rsm-lsp`** — the Node/TypeScript language server. Has no npm publish
  flow; the only way to deploy it is to build from source.
- **`tree-sitter-rsm`** — the grammar. Ships a Node native addon and a
  Python C extension.

| Environment | `rsm-lang` (Python) | `rsm-lsp` (Node) | `tree-sitter-rsm` |
|---|---|---|---|
| **Dev** | host's local `../../rsm` checkout (volume mount, editable) | same mount, built on container start | same mount |
| **Test (CI)** | `git clone aris-pub/rsm` main (editable) | same clone, built on container start | same clone |
| **Staging** | `git clone aris-pub/rsm` main (editable, built into image) | same clone, built into image | same clone |
| **Prod** | `git clone aris-pub/rsm` main (editable, built into image) | same clone, built into image | same clone |

**Dev** uses whatever is on the developer's disk — including uncommitted
edits. That is the point of a volume mount: you can change `rsm` and `studio`
together without publishing anything.

**Test, Staging, and Prod** all clone `aris-pub/rsm` at its `main` branch
HEAD. None of them pull `rsm` from PyPI. A fix merged to `rsm` main reaches
all three on their next build; it does **not** require a PyPI release.

> Historical note: Staging and Prod used to install `rsm-lang` from PyPI
> while building `rsm-lsp`/`tree-sitter-rsm` from the clone — an asymmetry
> that meant Python-side `rsm` fixes silently failed to propagate. The
> `backend/Dockerfile` now copies the cloned `rsm` into the image and
> installs `rsm-lang` editable from it, matching Dev and CI.

## Dev

```bash
just dev
```

- `docker/docker-compose.dev.yml` starts separate containers: `backend`,
  `multiplayer`, `frontend`, `site`, `postgres`.
- The host's `../../rsm` is volume-mounted to `/workspace/rsm`.
- `docker/backend/docker-entrypoint.sh` runs `uv sync` against the mounted
  `rsm`, then builds `tree-sitter-rsm` and `rsm-lsp` from it.
- `uvicorn --reload` watches `/workspace/rsm`, so editing `rsm` on the host
  hot-reloads the backend.
- Process management: `docker/supervisord.dev.conf`.

Tests run from **outside** the containers (see `.claude/CLAUDE.md`), mirroring
how production receives external requests.

## Test (CI)

GitHub Actions, `.github/workflows/ci.yml`. Every job clones `aris-pub/rsm`
main into `../rsm`.

| Job | rsm usage |
|---|---|
| `unit-backend` | `uv sync` against the cloned `rsm` (editable); runs `pytest` |
| `unit-frontend`, `unit-site` | only reads `tree-sitter-rsm`'s query files; no Python `rsm` at runtime |
| `e2e-site`, `e2e-frontend`, `e2e-collab` | `COMPOSE_FILE=docker/docker-compose.dev.yml` — the cloned `rsm` is mounted into the same Docker Compose stack as Dev |

The E2E jobs are deliberately identical to Dev: same compose file, same
`Dockerfile.dev`, same entrypoint, same `supervisord.dev.conf`.

## Staging (preview)

`.github/workflows/preview.yml`. Every PR gets an ephemeral environment.

- **Backend**: `aris-backend-pr-N.fly.dev` — a single Fly container built
  from `backend/Dockerfile` (multi-stage, production-style).
- **Frontend**: `pr-N--<netlify-site>.netlify.app`.
- **Database**: a separate Fly Postgres app, `aris-backend-pr-N-db`.
- The workflow clones `aris-pub/rsm` main into the build context; the
  `Dockerfile` copies it into the image and installs `rsm-lang` editable
  from it (see the rsm table above).
- Process management: `docker/supervisord.conf` (the production variant).

Staging exercises the **production build path** — the multi-stage
`Dockerfile`, `supervisord.conf`, the single-container topology. This is
deliberate: a bug that only manifests in the prod image (for example, a
`supervisord.conf` that fails to forward an environment variable) will
surface in Staging review rather than in Prod.

See [preview-environments.md](preview-environments.md) for the per-PR
lifecycle, URLs, and cleanup.

## Prod

The live service: `aris-backend.fly.dev` + the production Netlify site.

- Built from the same `backend/Dockerfile` and `backend/fly.toml` as
  Staging.
- Deployed manually (`flyctl deploy -a aris-backend`) — there is no
  push-to-deploy workflow.
- Process management: `docker/supervisord.conf`.

Because Prod and Staging share the build definition, a green Staging deploy
is strong evidence that a Prod deploy of the same commit will behave
identically.

## Summary of differences

| Aspect | Dev | Test (CI) | Staging | Prod |
|---|---|---|---|---|
| Orchestration | Docker Compose | Compose (E2E) / bare runner (unit) | single Fly container | single Fly container |
| Build definition | `Dockerfile.dev` | `Dockerfile.dev` (E2E) | `backend/Dockerfile` | `backend/Dockerfile` |
| Process manager config | `supervisord.dev.conf` | `supervisord.dev.conf` (E2E) | `supervisord.conf` | `supervisord.conf` |
| `rsm` delivery | host volume mount | cloned, mounted (E2E) | cloned, baked into image | cloned, baked into image |
| `rsm` source ref | host working tree | `aris-pub/rsm` main | `aris-pub/rsm` main | `aris-pub/rsm` main |
| Hot reload | yes (`uvicorn --reload`) | no | no | no |
| Deploy trigger | `just dev` | push / PR | PR open / push | manual `flyctl deploy` |
