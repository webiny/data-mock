# Session Handoff — 2026-09-15 — Deletion Safety, Project Discovery, Deploy and Destroy

12 commits. Finished Phase 1 and Phase 2 of the system-management plan
(`~/.claude-work/plans/snug-frolicking-hare.md`), which is now complete end to end.

## What was done

**Deletion safety (1 commit).** Every child table cascades from both `projects` and
`project_environments`, so the existing `DELETE` destroyed seed entries, sync logs, job history,
models, tenants and files with no warning — and the UI already offered it behind a one-line "this
cannot be undone". `archived_at` now soft-deletes both; the cascade only runs from a separate
`DELETE .../purge`. `GET .../deletion-impact` counts what a purge would destroy, and both the UI
confirmation and `yarn cli remove-project` show those counts before offering the permanent delete.
Migration `0001_nice_thing.sql`.

**Filesystem discovery and scheduling (1 commit).** `GET /api/fs/browse` (directory names only,
`realpathSync`'d), `POST /api/fs/scan` over saved roots, and `scan_roots` CRUD. `SyncScheduler`
runs at boot and daily and only ever enqueues.

**Registering and inspecting from the UI (2 commits).** Add Project becomes Scan / Browse / Path /
Remote tabs. Project detail gains an Environments tab and a System Info panel. Environment
archive/restore/purge wired through the same two-step confirmation as projects, plus "Sync all" on
the project list.

**Job concurrency (1 commit).** `processPendingJobs` used to flip every pending row to `running`
and launch them all unawaited. Now capped at 4 globally with one running job per project
(`projectId === null` exempt), ordered by `created_at`, and the claim is guarded on the row still
being `pending`. This path had zero test coverage before; it has 8 tests now.

**Webiny CLI runner (1 commit).** Spawns the checkout's own `node_modules/.bin/webiny` with an
allow-listed environment, ANSI-stripped line streaming, and SIGTERM-then-SIGKILL on abort. Plus a
per-major argv builder and `parseJsonOutput`.

**Deploy and destroy (2 commits).** Two executors, a service, dedicated routes, and the UI —
two-step destroy confirmation showing apps, resource counts and named resources at risk, closed
region dropdown, and live log streaming (`job:log` had been broadcast with zero subscribers since
it was written).

**Remote Pulumi backends (1 commit).** `s3://` / `azblob://` / `gs://` now sync through
`webiny output --json` instead of stopping at "state is not on disk".

**Loose ends (2 commits).** `runMigrations` resolves from `import.meta.url` rather than
`process.cwd()`; project names that are paths collapse to their last segment; first UI presenter
tests (11 on `ProjectListPresenter`); `--preview` support for a dry-run deploy.

## Key decisions

- **`DELETE` archives; only `.../purge` cascades.** Archiving is idempotent — archiving twice keeps
  the original `archived_at`. Lists hide archived rows unless `?includeArchived=true`, but
  `GET /api/projects/:id` still returns an archived project so it can be restored.
- **Sync respects an archive.** It lists environments with `includeArchived: true` so discovery
  cannot insert a duplicate beside an archived stack name, then skips the archived ones and reports
  each skip. Rediscovery never un-archives. An archived environment is never auto-selected in the
  UI.
- **Never omit the app positional.** On v5 it trips the gate demanding `--confirm-destroy-env`; on
  v6, `destroy` with no app tears down admin, api and core in sequence **with no confirmation of
  any kind**. One app per child process, always.
- **Deploy and destroy are not enqueueable through `POST /api/projects/:projectId/jobs`.** That
  route's body is a bare `config` record, so allowing them would route around both confirmations.
  Destroy's own route requires the project name typed back and **checks it server-side**.
- **The child's environment is an allow-list, not a deny-list.** Both majors load the project
  `.env` WITHOUT override, so anything in the server's environment beats the project's own. `AWS_*`
  is kept as a prefix (minus `AWS_PROFILE`/`AWS_REGION`, set per project); `NODE_*` is not a glob —
  `NODE_EXTRA_CA_CERTS` by name, `NODE_ENV`/`NODE_OPTIONS` never. `CI=1` is load-bearing: it skips
  the v6 telemetry gate that otherwise hard-fails deploys. `HOME` is mandatory, for corepack.
- **The environment row is derived from EVERY stored stack, not just the apps just read.** Deriving
  from a partial read blanks `admin_url` after deploying `api` alone, and marks the whole
  environment not-deployed after destroying `admin` alone. A destroyed stack's stored output is
  never used for URLs.
- **Stack state is re-read after every run, including a failed one** — a failed deploy is rarely a
  no-op. A preview is the exception: it changed nothing, so there is nothing to re-read.
- **`stale-possible` outranks `partial`.** v6 answers `webiny output` from a cache it gives no way
  to bypass, so a read that succeeded but may be out of date is a different problem from one that
  failed.
- **A literal `null` from the CLI is `unknown`, never `not-deployed`.** It is what both majors print
  for a stack they cannot find; reading it as destroyed would blank a live environment's inventory.
  `{}` is the remote equivalent of a checkpoint with no `resources` key, and IS not-deployed.
- **Region is a closed set** (`src/shared/webiny/regions.ts`); `withRegion` throws otherwise.
- **The descriptor table is the single source for job type metadata.** Three hand-maintained copies
  were found and removed this session (`ProjectDetailPresenter`, `JobsTab`,
  `JobNotificationListener`) — all already drifted.
- **A pure module the UI needs belongs in `src/shared/`, not under `node/`.** `stackOutputKeyMap`
  had to move for the UI bundle to build.

## Current state

- Branch: `bruno/feat/system-management`
- Build: passing — 0 type errors, 0 lint warnings, format clean, UI bundle builds
- Tests: 504 across 43 files (was 369/33 at session start)
- Unpushed commits: 34 ahead of `origin/main` (22 from the previous session, 12 from this one)
- DB: migration `0001` adds `archived_at` to `projects` and `project_environments`; applied at boot

### Verified against the real machine

- All seven checkouts detect correctly. `webiny-js` core 20 / api 82 / admin 11;
  `webiny-js-next` 20 / 70 / 11; the two 6.x roots read `not-deployed`, not `unknown`;
  `testing/testing-v6` reproduces the partially-deployed case (core 16, api absent, null `api_url`).
- A scan of `~/work/webiny` found all seven with no `node_modules` noise.
- The runner spawned the real v6 binary in `webiny-js`, cleared the telemetry gate, and
  `webiny info --env dev` returned the same API URL, admin URL and region the checkpoint reader
  produces — cross-validating both paths.
- A **preview** deploy of `core` against `testing/webiny-v5` ran end to end through the tool:
  `Preview successful. Resources: + 21 to create`, 548 log lines streamed, and afterwards
  `project_stacks` held 0 rows, the environment row was untouched, the on-disk checkpoint still had
  no `resources` key, and the checkout was clean.
- That preview also closed the gap the plan called unresolvable — "confirm v5 core output key names
  against a real deployed v5 stack". A preview names the outputs it would create, and every v5 key
  in `StackOutputKeyMap` appeared verbatim, including the three that differ from v6:
  `elasticsearchDomainEndpoint`, `elasticsearchDynamodbTableName`, `logDynamodbTableName`.
- The three destroy gates were exercised over HTTP and all reject: wrong name, missing name, and
  the generic jobs route.

### Not exercised

**No resource-creating deploy or destroy has ever been run.** Both paths are covered by a recording
stub and a fake `webiny` binary; the live validation was a `--preview` only. That was a deliberate
choice, not an oversight.

## What might come next

1. **A real deploy + destroy against `testing/webiny-v5`.** The only way to confirm the
   post-deploy stack refresh, the cancel path killing a real pulumi child (`ps` should show no
   survivor), and `deployed → 0` / `resource_count → 0` after a destroy. Costs money, takes tens of
   minutes, needs explicit sign-off.
2. **Long-lived children outliving an API restart.** `recoverStaleJobs()` marks the row
   `interrupted` but cannot kill a process it no longer owns. A 20-minute deploy plus a server
   restart leaves an orphan writing to the stack.
3. **`webiny-js` HEAD ships `@webiny/cli-aws`**, not `cli-core`. The command surface was verified
   against 6.4/6.5/next; re-verify before targeting HEAD.
4. **UI presenter coverage is one file deep.** `ProjectListPresenter` has 11 tests;
   `ProjectDetailPresenter` (1,500 lines, the deployment dialog, live logs, system info) has none.
5. Smaller: `wcp` detects as v5 with `apps=[logs]` — harmless but worth a look if it ever gets
   registered. `testing/webiny-v5` resolves its version at the `package-json` rung rather than the
   `template:` field the plan predicted; same value, earlier rung.
