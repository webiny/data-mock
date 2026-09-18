# Session Handoff — 2026-09-14 — Environment Scoping & System Discovery

## What was done

21 commits. 278 files, +6028/−4147.

**Planning (5 review rounds before any code).** Grilled the feature, then wrote and reviewed an
implementation plan five times against the real Webiny sources. Rounds found 13, 15, 18, 12 and 7
issues; two of them were architectural and would have shipped broken. Plan lives at
`~/.claude-work/plans/snug-frolicking-hare.md`.

**Baseline fix (`39753c9`, mergeable on its own).** `main` already had 24 type errors from the
dependency update. `@clack/prompts` 1.8.0 narrowed `isCancel` to `value is typeof CANCEL_SYMBOL`;
excluding a unique symbol from `string | symbol` leaves the union untouched, so all 25 cancel
guards silently stopped narrowing. Added `isCancelled()` to restore it. The 24th was
`defineOneRoute` hitting an index-signature widening that `defineListRoute` had been papering over
with an inline double cast — both now share one documented `envelopeSchema()` helper.

**Phase 0 — the data model is environment-scoped.** A project is now a Webiny system (a checkout on
disk, or a remote-only connection); an environment is one Pulumi stack name within it. 13 tables,
single regenerated migration, `environment_id` on the seven env-scoped tables, credentials moved
from `projects` to `project_environments`. Touched every layer: schema, types, responses, routes,
repositories, services, jobs, API, UI, CLI, and 18 of 32 test files.

**Phase 1 (partial) — detection and sync.** `WebinyProjectDetector` identifies v5/v6 and resolves
the version through a four-rung chain. `PulumiCheckpointReader` reads Pulumi's local file backend
directly. The `sync-system` job writes environments and per-app stack state into the database.
Verified against all six Webiny checkouts on this machine.

**Verified end to end.** Fresh database, API booted, real sync run against the deployed `webiny-js`
checkout — produced the same `api_url`, `admin_url`, `region` and `env` as the `yarn webiny info`
output pasted at the start of the session, plus resource counts and full stack output the CLI never
shows, in about a second with no AWS calls.

## Key decisions

- **Environments are addressed by stack name in URLs** (`/projects/:id/env/dev/models`), not by id.
  The database is a clean break and will be recreated again; generated ids would break every
  bookmark. Stack names are stable and already unique per project.
- **The environment route registers before the bare project route.** `RouteRegistry` is
  first-match-wins, so `/projects/:projectId/*` would otherwise swallow `env/dev/models`.
- **`webiny_version` is split from `operations_version`.** The detected version is display-only and
  legitimately null for a framework workspace root (four of six checkouts here). `operations_version`
  is NOT NULL and drives the GraphQL operation registry, which does `version.split(".")` — null
  throws and `"0.0.0"` silently selects the lowest registered operation set.
- **Sync reads Pulumi checkpoints, it does not run the CLI.** Checkpoint outputs are byte-identical
  to `pulumi stack output --json`. The CLI route would mean a cache that cannot be bypassed on v6
  (`GetAppStackOutput` takes no options), a stream mixing JSON with other output on v5, and a spawn
  per app per environment.
- **Stack reads are three-state.** `deployed` / `not-deployed` / `unknown`. A destroyed stack keeps
  its file but drops the `resources` key — distinct from a file that could not be read. An `unknown`
  read never overwrites a stored `stack_output`, because that record is what a destroy dialog reads
  to say what is about to be deleted. Both CLI versions report `{}` for the destroyed case, which is
  why deployment is decided on the resources array, not on output emptiness.
- **Reads narrow on `environment_id`; writes carry both ids.** Env-scoped tables keep `project_id`
  alongside. An un-narrowed `eq(x.projectId, …)` compiles cleanly and silently merges rows across
  environments — the compiler cannot help, so the sweep is deliberate.
- **`EnvironmentContextService` owns the partial-deploy rule.** An environment with core deployed
  but no api app has no `api_url` and cannot be seeded; it fails with `EnvironmentNotConnectedError`
  (409). `testing/testing-v6` is in exactly this state.
- **One job-type descriptor table** replaces six hand-maintained lists. `enqueueable` is a per-type
  flag, not derived: the enqueue route takes a bare config record, so deriving it would let
  `{"type":"destroy"}` start a destroy with an unvalidated config once Phase 2 lands.
- **Deploy and destroy will always pass one app per CLI invocation.** Never omit the app positional.
  This sidesteps v5's `--confirm-destroy-env` gate and v6 destroying `admin → api → core` with no
  confirmation at all.
- **CLI selects an environment, skipping the prompt when there is only one.** Most projects have
  only `dev`.

## Current state

- Branch: `bruno/feat/system-management` (off `bruno/feat/project-manager`, which is identical to `main`)
- Build: passing — 0 type errors, 0 lint warnings, format clean, 369 tests across 33 files
- Unpushed commits: 21
- Database rebuilt from the new migration; pre-migration copy archived at
  `.webiny/backups/data-mock-preEnvMigration-20260914-210108.db` (28 models, 1674 seed entries, 20 jobs)

## What might come next

**1. Deletion loses data — decide before exposing delete in the UI.**
Every child table cascades from both `projects` and `project_environments`. Deleting a project
destroys its seed entries, sync logs, job history, models, tenants, files and templates; deleting an
environment destroys the same minus templates. The archived database held 1674 seed entries — one
confirm-and-delete would have taken all of it. Worse, `sync-system` *creates* environments
automatically, so a renamed env or an added variant leaves the old environment holding all the
history while a new empty one appears beside it. Options:
- Soft delete (`archived_at` on projects and environments), hidden from lists, nothing cascades
- Change the audit tables (`seed_entries`, `sync_logs`, `jobs`) to `ON DELETE SET NULL` so history
  survives detached
- Require an explicit second confirmation naming what will be destroyed, with counts
- Export to file before deleting

**2. Finish Phase 1.** Scan/browse endpoints (`/api/fs/browse`, `/api/fs/scan`, `scan_roots` CRUD)
so projects can be registered without typing paths — registering still needs a `PUT` with
`rootPath`. Then the boot/daily sync scheduler (must enqueue through the job queue, not run
directly, so it cannot race a deploy), and the UI: environments tab, System Info panel, sync button
on the project list.

**3. Phase 2 — deploy and destroy.** `WebinyCliRunner` (`node:child_process`, env whitelist —
keep every `AWS_*` except `AWS_PROFILE`/`AWS_REGION`, keep `HOME` for corepack, `CI=1` is
load-bearing on v6 as it skips a telemetry gate that otherwise hard-fails deploys), per-version
`WebinyCommandBuilder`, job concurrency (global cap + per-project serialization, `projectId === null`
never blocked), live log streaming (nothing listens to `job:log` today), and the two-step destroy
confirmation.

**4. Loose ends.**
- Project names still come from `.projects.json` and read like paths (`Users/brunozoric/work/...`)
- `runMigrations` uses a hardcoded relative path against `process.cwd()`, so migrations only apply
  when started from the repo root
- `JobWorker.processPendingJobs` still launches every pending job at once, unawaited — fine for
  seeding, not for 10–20 minute deploys
- No test covers UI presenters; the one real bug found there (tenants written under a project key,
  read under an environment key) surfaced only from a lint warning
