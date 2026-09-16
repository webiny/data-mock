# AGENTS.md — webiny-mock-data

Single source of truth. Every agent and skill references this file.

## Overview

A multi-project tool for managing and seeding Webiny CMS systems. Registers Webiny checkouts on
disk, discovers their deployed environments by reading Pulumi state, and deploys, destroys and
seeds them. Syncs models/groups/tenants from live instances, generates realistic fake data
respecting CMS field validation rules, and sends entries via GraphQL. Includes a CLI, REST API
(Fastify), and web UI (React + Mantine).

---

## Quick Start

```bash
yarn install
yarn cli init            # generate .env (encryption key + ports)
yarn cli add-project     # add a Webiny project connection
yarn cli pull-models     # pull models from Webiny
yarn cli seed            # generate + send mock data
yarn dev                 # start API (port 4000) + UI (port 4001)
```

---

## Directory Structure

```
src/
├── shared/                              # Platform-agnostic (CLI, API, UI can all import)
│   ├── types.ts                         # Domain types (Project, SeedJob, ProjectModel, etc.)
│   ├── errors.ts                        # BaseError subclasses with statusCode
│   ├── abstractions/
│   │   └── HttpClient.ts               # HTTP client interface
│   ├── responses/                       # Zod response schemas (projects, tenants, models, seeding, entries, files, templates)
│   ├── routes/                          # Typed route definitions (shared by API + UI)
│   └── routing/                         # defineRoute, defineTypedRoutes, interpolatePath
│
│   └── node/                            # Node.js only — shared by CLI + API. UI must NEVER import.
│       ├── feature.ts                   # AppFeature — root bootstrap
│       ├── FetchHttpClient.ts           # fetch()-based HttpClient
│       ├── db/                          # SQLite (better-sqlite3 + drizzle-orm)
│       │   ├── schema.ts               # 14 tables
│       │   ├── client.ts               # createDatabaseClient()
│       │   ├── migrate.ts              # runMigrations()
│       │   └── migrations/             # SQL migrations (drizzle-kit)
│       ├── cache/                       # MemoryCache + CacheKey (no DI: constructed where used)
│       ├── encryption/                  # AES-256-GCM EncryptionService + KeyRotationService
│       ├── graphql/                     # GraphQLClient (retry, batching)
│       │   ├── endpoints/              # DI endpoint clients (CmsManage, CmsRead, CmsPreview, GraphQL)
│       │   └── operations/             # Operation registry + parseOperationResponse + defineOperation
│       │       └── base/               # All operations (strict Zod schemas, Zod-inferred types)
│       ├── generators/                  # 11 field generators + 5 validators + DI registry
│       │   ├── fields/                 # Text, Number, Boolean, DateTime, LongText, Json, File, RichText, Ref, Object, DynamicZone
│       │   ├── validators/             # MinLength, MaxLength, Pattern, DateGte, DateLte
│       │   └── createEntryVariables.ts # Generator→entry bridge
│       ├── fields/                      # GraphQL field-selection builders (per CMS field type)
│       ├── testing/
│       │   └── createTestContainer.ts  # Fully-wired DI container for tests
│       └── features/
│           ├── projects/               # CRUD + archive/restore (create/get/list/archive/remove)
│           ├── environments/           # Environment CRUD + archive/restore + stacks + EnvironmentContextService
│           ├── deletion/               # DeletionImpactService — counts what a purge would destroy
│           ├── scanRoots/              # CRUD for the directories scanned for checkouts
│           ├── filesystem/             # DirectoryBrowser + ProjectScanner
│           ├── webinyCli/              # Detection, checkpoint reading, sync, sync preview, CLI runner, deploy/destroy
│           ├── childProcesses/         # ChildProcessTracker — the orphan reaper's record of live children
│           ├── tenants/                # Sync + list + verify access
│           ├── models/                 # Sync + list + get + push + compare
│           ├── seeding/                # Seed service + job CRUD + entry audit log + dependency resolver
│           ├── templates/              # Seed template CRUD
│           └── files/                  # File upload + list + delete
│
├── cli/                                 # CLI layer (@clack/prompts)
│   ├── entry.ts                        # Bootstrap + command dispatch
│   ├── feature.ts                      # CliFeature
│   ├── abstractions/                   # Prompts, UI, Command
│   ├── testing/                        # createCliTestContainer + Prompts/UI stubs
│   └── commands/                       # 8 commands (see below)
│
├── api/                                 # Fastify API server (localhost:4000)
│   ├── entry.ts                        # Bootstrap + listen
│   ├── server.ts                       # createServer()
│   ├── feature.ts                      # ApiFeature
│   ├── routing/                        # routeFactory, environmentOwnership, sendTyped, sendError, createRequestContext
│   └── routes/                         # Route handlers (see below)
│
└── ui/                                  # React + Mantine + MobX (port 4001)
    ├── App.tsx, main.tsx               # Entry + DI container setup
    ├── di/                             # DiContainerProvider, useFeature, createFeature
    ├── features/
    │   ├── router/                     # Route registry, RouterView, defineRoute, navigate()
    │   ├── notifications/              # Mantine notifications service
    │   ├── filesystem/                 # Gateway (browse, scan, scan roots)
    │   ├── projects/                   # Gateway + Repository
    │   ├── tenants/                    # Gateway + Repository
    │   ├── models/                     # Gateway + Repository
    │   ├── seeding/                    # Gateway + Repository
    │   ├── jobs/                       # Gateway + Repository (MobX-observable)
    │   └── templates/                  # Gateway + Repository
    ├── infrastructure/httpClient/      # FetchHTTPClient for browser
    ├── presentation/
    │   ├── Projects/
    │   │   ├── ProjectList/            # List page + use cases (load, delete, sync tenants/models)
    │   │   ├── ProjectDetail/          # Detail page (sidebar: environments, system info, tenants, models, history)
    │   │   │                           #   ProjectDatasets + projectDatasetDefinitions: per-tab loading
    │   │   └── AddProject/             # Scan / Browse / Path / Remote tabs + use case
    │   └── Seeding/
    │       ├── SeedConfig/             # Seed configuration page
    │       └── SeedHistory/            # Seed history page
    ├── components/                     # AppLayout
    └── theme/                          # Mantine theme tokens
```

---

## Database Schema (14 tables)

A **project** is a Webiny system — a checkout on disk (`root_path`), or a remote-only connection.
An **environment** is one Pulumi stack name (`dev`, `dev___blue`) within it. Everything that
belongs to a running Webiny instance hangs off the environment, not the project.

| Table | Key columns | Purpose |
|---|---|---|
| `projects` | id, name, root_path, webiny_version, version_source, version_major, operations_version, pulumi_backend, aws_profile, aws_region, last_synced_at, last_sync_status, archived_at | A Webiny system. `webiny_version` is detected and display-only (null for a framework workspace root); `operations_version` is NOT NULL and drives the GraphQL operation registry. `archived_at` is the soft-delete marker — see Deletion below. |
| `project_environments` | project_id FK, env, variant, region, deployed, api_url, admin_url, api_token (encrypted), tenant, last_synced_at, archived_at | One Pulumi stack name. `variant` is `""` not NULL — SQLite treats NULLs as distinct in unique indexes. `deployed` means any app is deployed; `api_url` is null when the api app is not. `archived_at` soft-deletes it while keeping its slot in the unique index. |
| `project_stacks` | environment_id FK, app, deployed, resource_count, stack_output (JSON), read_state, synced_at | Per-app Pulumi state. `read_state` is `deployed` / `not-deployed` / `unknown`; an unknown read never overwrites a stored `stack_output`. `resource_count` is null on a remote backend — only the checkpoint has one. |
| `scan_roots` | path | Directories scanned for Webiny projects |
| `project_tenants` | project_id FK, environment_id FK, tenant_id, name | Discovered tenants per environment |
| `project_groups` | project_id FK, environment_id FK, slug, name, remote_id | CMS content model groups |
| `project_models` | project_id FK, environment_id FK, model_id, singular_api_name, plural_api_name, group_slug, plugin, fields (JSON) | CMS models + field definitions |
| `jobs` | project_id FK (nullable), environment_id FK (nullable), type, status, config (JSON), logs, **result (JSON)**, progress, progress_label | Background jobs in three scopes: global (neither id, e.g. pull-picsum, sync-preview), project (project only, e.g. sync-system) and environment (both, e.g. seed). `result` is the job's own answer, written through `context.setResult` — for jobs whose point is what they return rather than what they write. |
| `child_processes` | pid, owner_pid, job_id, command, cwd, started_at | One row per live child this server spawned. The handle that survives the server, so the next boot can kill a `webiny deploy` that outlived it. |
| `seed_jobs` | project_id FK, environment_id FK, status, config (JSON), result (JSON) | Legacy seeding job tracking |
| `seed_templates` | project_id FK, name, config (JSON) | Saved seed configurations — project-scoped on purpose, so one config is reusable across environments |
| `seed_entries` | job_id FK (nullable), project_id FK, environment_id FK, tenant, model_id, entry_data (JSON), request_data (JSON), response_data (raw), status | Per-entry audit log with full request/response |
| `project_files` | project_id FK, environment_id FK, tenant, file_key, file_url, file_type | Uploaded file references |
| `sync_logs` | project_id FK, environment_id FK, type, status, message, request (JSON), response (JSON) | Sync operation logs |

Env-scoped tables keep `project_id` alongside `environment_id`. It is derivable through the join,
but reads must narrow on `environment_id`: an un-narrowed `eq(x.projectId, …)` compiles cleanly and
silently returns rows merged across every environment. Writes carry both — the project owns the
row, the environment scopes it.

---

## Registering and syncing projects

A project is registered from a folder on disk. Three ways to name that folder, all in the Add
Project modal: **Scan** (the saved scan roots), **Browse** (a directory picker), **Path** (typed).
A fourth tab, **Remote**, creates a project with no checkout — seedable, but not deployable,
destroyable or syncable.

- **Scanning stops at the first marker.** A checkout's own `apps/` holds nothing that is a separate
  project, and the framework monorepo carries dozens of `webiny.config.tsx` files below its root
  that are fixtures, not systems. `node_modules` is never entered — every checkout has one holding
  packages that carry a marker of their own.
- **Already-registered checkouts stay in the scan result**, flagged and unselectable. The list is a
  picture of the disk, not a queue that empties as you use it.
- **A checkout whose name matches a project that has none is offered as "attach to existing"**, not
  as new. A project seeded from `.projects.json` never had a `rootPath`, so the scan saw its folder
  as unknown and would have created a second row for one system. Picking it points the existing
  project at the checkout instead. Offered, not applied — a remote-only project can legitimately
  share a name with an unrelated folder.
- **Several checkouts are added in one go.** Each takes its folder's name; one request per project,
  so a single failure does not stop the rest.
- **A project name and a checkout are both unique.** Two rows for one checkout means two
  inventories of the same stacks, each overwriting the other on sync; two rows with one name makes
  every list, badge and destroy confirmation ambiguous. Enforced on create and on update, seeing
  through a path spelled differently and counting archived projects.
- **Unreadable roots are reported**, never dropped. A scan that silently skipped half the tree
  would read as "nothing is there".
- **Browsing returns directory names only** and resolves the path through `realpathSync` first, so
  what comes back is the real location rather than the link that pointed at it. The API binds to
  127.0.0.1 (ADR 006), which is what keeps this off the network.
- **Adding a project with a checkout enqueues a sync immediately** — until it runs, the project has
  no version, environments or stack output.

**Nothing syncs on its own.** A sync rewrites the version, environments and stack output stored for
a project from whatever is on disk, so it is always started by the user. There is no boot sync and
no periodic one.

**A sync shows its diff first.** `POST /api/sync/preview` starts a `sync-preview` job that reads
everything the sync reads and stores none of it, leaving the diff on `jobs.result`: per project
field, per environment and per app. The dialog polls the job rather than listening for the
websocket event, so a dropped socket shows a slow dialog rather than one that never answers.
Accepting it enqueues the real `sync-system` job, one per project.

- The preview job is **global** (`projectId: null`) on purpose. It writes nothing, so the
  per-project serialization has nothing to protect, and scoping it would park the dialog behind a
  twenty-minute deploy.
- **It is not the sync with a dry-run flag.** That flag threaded through the writes is where a
  preview stops matching what it previews. What the two share instead is `mergeStackRead` and
  `deriveEnvironmentState` in `src/shared/stackOutput/stackState.ts`, used by the write path too.
- **Applying re-reads rather than replaying the diff.** It is a preview of an intent, not a
  transaction.

**Every action that starts a job confirms first** — pull tenants, pull models, pull files, import
entries, the placeholder-image download. `ActionConfirmation` in
`src/ui/presentation/shared/confirmation/` is the one dialog they all use, and the copy is built
where the action is, so it names the checkout, environment and tenant involved.

---

## Remote Pulumi backends

A backend of `s3://`, `azblob://` or `gs://` keeps its state in a bucket, so there are no
checkpoints and the local glob finds nothing. Sync falls back to `webiny output --json` per app.
It is strictly worse than reading checkpoints and is used only because there is nothing to read:

- **No discovery.** Environments must be added manually; the glob finds nothing whether the project
  is deployed or not. A project with no active environment reports that, rather than reporting a
  clean success over zero rows.
- **No resource counts.** They exist only in the checkpoint.
- **`deployed` comes from `{}` vs non-empty**, not from `resources`. `{}` is the remote equivalent
  of a checkpoint with no `resources` key.
- **A literal `null` is `unknown`, never `not-deployed`.** It is what both majors print for a stack
  they cannot find, and reading it as destroyed would blank a live environment's inventory.
- **v6 answers from a cache it gives no way to bypass**, maintained only by its own deploy/destroy
  decorators — so anything changed outside the CLI leaves it stale indefinitely. Those syncs stamp
  `stale-possible`, which outranks `partial`: a read that succeeded but may be out of date is a
  different problem from one that failed.
- **`--json` is mandatory.** Without it the null path prints prose and there is nothing to parse.
- On a never-built v6 checkout this path builds the app workspace as a side effect, so the first
  remote sync of a fresh checkout is slow and writes into `.webiny/`.

The environment row is derived by the same code as the local path
(`RefreshEnvironmentStacksService`, via its `readStack` hook), so the two cannot disagree about how
`api_url`, `admin_url` and `deployed` are computed.

---

## Deploy and destroy

Both run as background jobs, through the checkout's own `node_modules/.bin/webiny`.

- **One app per child process, always.** Never omit the app positional: on v5 it trips the gate
  that demands `--confirm-destroy-env`, and on v6 `destroy` with no app tears down admin, api and
  core in sequence **with no confirmation of any kind**. An empty app list means "every deployable
  app", expanded by the tool, ordered `core → api → admin` for deploy and reversed for destroy.
- **Neither type is enqueueable through `POST /api/projects/:projectId/jobs`.** That route's body
  is a bare `config` record, so allowing them would let a plain POST deploy or destroy with no
  confirmation. They have their own routes. Destroy's requires the project name typed back and
  **checks it server-side** — a confirmation that exists only in the browser is not a confirmation.
- **The child's environment is an allow-list.** Both majors load the project `.env` WITHOUT
  override, so anything in the server's environment beats the project's own. `AWS_*` is kept as a
  prefix (minus `AWS_PROFILE`/`AWS_REGION`, which the tool sets per project) because an allow-list
  of named credential vars is unmaintainable. `NODE_*` is not a glob: `NODE_EXTRA_CA_CERTS` is kept
  by name, `NODE_ENV` and `NODE_OPTIONS` are not. `CI=1` is load-bearing — it skips the v6
  telemetry gate that otherwise hard-fails deploys. `HOME` is mandatory, for corepack.
- **Cancel kills the child's whole process group.** The child is spawned `detached`, so it leads
  its own group: `webiny` is a launcher, and the run that holds the stack is pulumi several
  processes below it, which signalling the pid alone leaves running. SIGTERM first so pulumi can
  unwind, SIGKILL after a grace period; a pulumi run killed outright can leave a stack lock that
  blocks the next deploy.
- **A child outlives the server, and the next boot reaps it.** Owning its own group is what makes
  it killable, and what stops it dying with the server — so every spawn is recorded in
  `child_processes`, and boot terminates whatever a previous run left behind before marking stale
  jobs `interrupted`. Two guards stand between the reaper and a stranger's process: the row is only
  an orphan when the process that spawned it is gone (so a server booting beside a running CLI
  deploy leaves it alone), and a pid is only killed when its start time and argument vector still
  match what was recorded. Shutdown terminates this server's own children before draining.
- **Stack state is re-read after every run, including a failed one.** A failed deploy is rarely a
  no-op. The refresh derives the environment row from every stored stack, not just the apps just
  read — otherwise deploying `api` alone blanks `admin_url`, and destroying `admin` alone marks the
  whole environment not-deployed.
- **Region is a closed set** (`src/shared/webiny/regions.ts`, copied from `@webiny/project`);
  `withRegion` throws for anything else. Variants named `none`, `empty` or `blank` are rejected.
- Flags are deploy-only where the CLI says so: verified against both checkouts, neither major's
  `destroy` accepts `--build` or a deployment-logs flag, and the log flag's name differs by major.

### Job concurrency

`MAX_CONCURRENT_JOBS = 4` globally, and **one running job per project** — which is what stops a
sync from reading a checkpoint a deploy is halfway through rewriting. `projectId === null` is never
blocked. A skipped job stays `pending` with `progressLabel = "waiting: project busy"`,
cleared on claim. The claim update is guarded on the row still being `pending`.

### Route guards

**Every route whose path carries both `:projectId` and `:environmentId` checks that the two agree**,
in `routeFactory` rather than in each handler, so one added later cannot forget it — see
`src/api/routing/environmentOwnership.ts`. Twenty-three routes carried both and almost none checked:
purge destroyed whatever the second id named, cleanup wiped another environment's data, and a
destroy could be confirmed by typing the name of the project in the path while tearing down a stack
belonging to a different one. The cost is one indexed read from local SQLite.

---

## Deletion

Every child table cascades from both `projects` and `project_environments`, so a real delete
destroys that row's seed entries, sync logs, job history, models, tenants, stacks and files. Nothing
in the product deletes by default:

- **`DELETE` archives.** It sets `archived_at` and returns the row. Nothing is removed and
  `POST .../restore` undoes it.
- **Purging is a separate request** — `DELETE .../purge` — and is the only path that cascades.
- **`GET .../deletion-impact`** counts what a purge would destroy. The UI and the CLI both show
  those counts before offering the permanent delete, and report a failed count as unknown rather
  than as "nothing stored".
- **Lists hide archived rows** unless `?includeArchived=true`. `GET /api/projects/:id` still
  returns an archived project, so it can be restored.
- **Archiving is idempotent**: archiving twice keeps the original `archived_at`.
- **Both UIs run the same two steps.** The project list and the Environments tab each open a
  confirmation whose default action is Archive, with the impact counts on screen, and only move to
  the permanent delete when the user explicitly asks. Archived rows stay visible with a Restore
  next to them. `toDeletionImpactLines` is shared, so the UI and the CLI never disagree on what a
  delete would destroy.
- **An archived environment is never auto-selected.** Archiving is "stop looking at this stack";
  landing on one would undo that on every page load.
- **Purge refuses unless the confirmation is in its purge step.** Both presenters check it, not
  just the dialog: the first step is the reversible one, and nothing else should be able to reach
  the second.
- **A delete that failed is reported as failed.** Archive, restore and purge all return a Result;
  announcing "and all of its data were deleted" over a refused request, with the row still in the
  list, is worse than the failure.
- **Sync respects an archive.** `sync-system` lists environments with `includeArchived: true` so
  discovery cannot insert a duplicate beside an archived stack name, skips archived environments,
  and reports each one it skipped. Rediscovery never un-archives.

---

## Conventions worth knowing

- **`runMigrations` resolves its folder from `import.meta.url`, not `process.cwd()`.** A
  cwd-relative path fails silently: the database opens, the tables are simply absent, and the first
  query fails with "no such table" far from the cause.
- **Project names are normalised through `toProjectName`.** A path pasted into the name field
  becomes its last segment. Older `.projects.json` entries carry a whole path as their name, which
  then appears in every list, badge and confirmation dialog.
- **`.projects.json` can carry `rootPath`.** Without it the seeded project is remote-only: it can
  be seeded, but not deployed, destroyed or synced from disk, and Deploy/Destroy are hidden for it.
  A re-seed never clears a `rootPath` registered through the UI, and skips an entry whose checkout
  another project has already claimed.
- **A failed read is never marked as loaded.** Every project-detail dataset stayed marked loaded
  whether or not it loaded, so a one-second outage left a tab blank for the rest of the session
  with nothing asking again. Reopening the tab now retries, and the failure says so.
- **Health is an environment fact, and cached for ten minutes server-side.** The project list asks
  per environment and shows online / partly online / unreachable with the count; a project with no
  API to reach reads "no API", not unreachable. The badge is clickable and that click passes
  `force`, or it would get the same cached answer and look like it did nothing.
- **Seed Data and History appear only where an environment has an API.** Both open one, so on a
  project that has never been deployed they could only lead to "this environment cannot be seeded".

---

## CLI Commands (8)

| Command | Description |
|---|---|
| `yarn cli init` | Generate .env with encryption key + port config |
| `yarn cli add-project` | Add a Webiny project (prompts for name, URL, token, version, tenant) |
| `yarn cli list-projects` | Show all configured projects |
| `yarn cli remove-project` | Archive, restore or permanently delete a project (shows the row counts a permanent delete would destroy) |
| `yarn cli pull-models` | Pull models/groups from a Webiny project into local DB |
| `yarn cli seed` | Generate + send mock entries (select project → tenants → models → amounts) |
| `yarn cli rotate-key` | Rotate the API token encryption key |
| `yarn cli upload-files` | Upload files to a Webiny project's file manager |

---

## API Routes (63)

Environment-scoped routes live under `/api/projects/:projectId/environments/:environmentId/*`.
Project-scoped routes (jobs, templates, sync) and the four global file routes stay where they are.

All long-running operations (seed, pull-tenants, pull-models, import, cleanup, pull-picsum,
sync-system) return a `Job` object with HTTP 202 — work runs in the background. Progress is pushed via WebSocket. All list endpoints support server-side pagination (`page`, `limit`), ordering (`sortField`, `sortDir`), and endpoint-specific filtering via query params.

### Projects
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project (Zod-validated) |
| GET | `/api/projects/:id` | Get project by ID |
| PUT | `/api/projects/:id` | Update project (partial, at least one field) |
| DELETE | `/api/projects/:id` | Archive project (soft delete — keeps all data) |
| POST | `/api/projects/:id/restore` | Restore an archived project |
| DELETE | `/api/projects/:id/purge` | Permanently delete project + everything that cascades |
| GET | `/api/projects/:id/deletion-impact` | Count the rows a purge would destroy |
| POST | `/api/projects/:id/health` | Check if project's Webiny API is reachable |

### Environments
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/environments` | List environments |
| POST | `/api/projects/:projectId/environments` | Add one manually (for remote Pulumi backends) |
| GET | `/api/projects/:projectId/environments/:environmentId` | Get one |
| PUT | `/api/projects/:projectId/environments/:environmentId` | Update connection details |
| DELETE | `/api/projects/:projectId/environments/:environmentId` | Archive (soft delete — keeps all data) |
| POST | `/api/projects/:projectId/environments/:environmentId/restore` | Restore an archived environment |
| DELETE | `/api/projects/:projectId/environments/:environmentId/purge` | Permanently delete + cascade |
| GET | `/api/projects/:projectId/environments/:environmentId/deletion-impact` | Count the rows a purge would destroy |
| GET | `/api/projects/:projectId/environments/:environmentId/stacks` | Per-app Pulumi state |
| POST | `/api/projects/:projectId/environments/:environmentId/health` | Is this environment's API reachable |
| POST | `/api/projects/:projectId/sync` | Sync version, environments and stack output from disk |
| POST | `/api/projects/:projectId/environments/:environmentId/deploy` | Deploy apps (202, job) |
| POST | `/api/projects/:projectId/environments/:environmentId/destroy` | Destroy apps — requires `confirmProjectName` (202, job) |
| GET | `/api/projects/:projectId/deployable-apps` | Apps this project's Webiny version can deploy |

### Filesystem
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/fs/browse?path=` | List a directory's subdirectories, flagging Webiny checkouts. Directory names only — never files or file contents. Defaults to `$HOME`. |
| POST | `/api/fs/scan` | Scan the saved roots (or `paths` in the body) for checkouts |
| GET | `/api/scan-roots` | List the directories scanned |
| POST | `/api/scan-roots` | Add one |
| DELETE | `/api/scan-roots/:id` | Remove one — projects added from it are kept |

### Tenants
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/tenants` | List project tenants |
| POST | `/api/projects/:projectId/tenants/pull` | Pull tenants from Webiny (logs to sync_logs) |

### Models
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/models` | List local models |
| POST | `/api/projects/:projectId/models/pull` | Pull models from Webiny (logs to sync_logs) |

### Seeding
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/projects/:projectId/seed` | Trigger seeding (revisions, publish strategy, dry-run) |
| GET | `/api/projects/:projectId/seed-jobs` | Seed job history |
| POST | `/api/projects/:projectId/import` | Import existing entries from Webiny |
| POST | `/api/projects/:projectId/cleanup` | Delete seeded entries from Webiny (optional jobId filter) |

### Seed Entries (Audit Log)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/entries` | List seeded entries (paginated, filterable) |
| GET | `/api/projects/:projectId/entries/:entryId` | Get single entry |
| DELETE | `/api/projects/:projectId/entries` | Clear audit log |

### Templates
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/templates` | List seed templates |
| POST | `/api/projects/:projectId/templates` | Save template |
| DELETE | `/api/projects/:projectId/templates/:templateId` | Delete template |

### Files
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/files` | List uploaded files |
| POST | `/api/projects/:projectId/files/upload` | Upload a file |
| DELETE | `/api/projects/:projectId/files/:fileId` | Delete file reference |
| POST | `/api/projects/:projectId/files/pull` | Pull files from a project's file manager |
| POST | `/api/projects/:projectId/files/upload-global` | Upload all unlinked global pool images to a project's file manager |
| POST | `/api/files/picsum/pull` | Pull placeholder images from picsum.photos (background job, returns Job) |
| GET | `/api/files/local` | List local files in `.webiny/images/` with per-project upload status |
| POST | `/api/files/local/upload` | Save a dropped file to `.webiny/images/` |
| DELETE | `/api/files/local/:fileName` | Delete a file from `.webiny/images/` |
| GET | `/api/files/local/:fileName/content` | Serve raw file bytes for thumbnail display (raw Fastify route, not typed) |

### Jobs
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/jobs` | List all jobs globally (not project-scoped) |
| GET | `/api/jobs/:jobId` | Get a job, whatever project it belongs to |
| POST | `/api/jobs/:jobId/cancel` | Cancel a job, whatever project it belongs to — the project-scoped routes below cannot reach one that has none |
| POST | `/api/sync/preview` | Start a `sync-preview` job over one or more projects. Body carries `projectIds` |
| POST | `/api/projects/:projectId/jobs` | Enqueue a new job (type + config) |
| GET | `/api/projects/:projectId/jobs` | List jobs for a project (paginated, filterable by type/status) |
| GET | `/api/projects/:projectId/jobs/:jobId` | Get a single job |
| POST | `/api/projects/:projectId/jobs/:jobId/cancel` | Cancel a running or pending job |

### WebSocket
| Protocol | Path | Purpose |
|---|---|---|
| WS | `/ws` | Real-time job status, progress, and log events |

### Sync Logs
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/sync-logs` | List sync operation logs |
| DELETE | `/api/projects/:projectId/sync-logs/:logId` | Delete a sync log entry |

---

## UI Routes

| URL | Page | Layout |
|---|---|---|
| `/` | Project list | Contained |
| `/files` | Global file manager (drag-drop, picsum, thumbnails) | Contained |
| `/activity` | Every job, including the ones belonging to no project | Contained |
| `/projects/:projectId/env/:envName/*` | Project detail shell, explicit environment | Full width |
| `/projects/:projectId/*` | Same shell, resolves to the first environment | Full width |

`envName` is the Pulumi **stack name** (`dev`, `dev___blue`), not an id — generated ids break every
bookmark when the database is recreated. The environment route is registered **first**, because
`RouteRegistry` is first-match-wins and `/projects/:projectId/*` would otherwise swallow
`env/dev/models` as a subPath.

The detail route uses a `/*` wildcard — `subPath` determines the active view:

| Sub-path | View |
|---|---|
| (empty) / `tenants` | Tenants tab |
| `models` | Models & Groups tab |
| `files` | Files tab (merged global + project files, drag-drop, multi-select upload) |
| `entries` | Audit Log tab (seed entries) |
| `history` | Seed History tab |
| `templates` | Templates tab (hidden from sidebar) |
| `jobs` | Background Jobs (paginated, filterable by type/status) |
| `activity` | Activity Log (paginated, filterable by type/status) |
| `pull-tenants` | Pull Tenants (log table + run button) |
| `pull-models` | Pull Models (log table + run button) |
| `pull-images` | Pull Images from FM (log table + run button) |
| `seed` | Seed Config (embedded, group accordion) |
| `import` | Import Entries |

URL is the source of truth for tab selection and for the selected environment — no presenter state
for either. The environment selector renders only when a project has more than one environment.

Sidebar sections: **Data** (7 tabs, Templates hidden), **Pull** (3 tabs), **Actions** (Seed Data, Import, Cleanup, Edit Project).

---

## Technology Stack

| Concern | Package | Version |
|---|---|---|
| DI container | `@webiny/di` | ^1.0.2 |
| Stdlib | `@webiny/stdlib` | ^0.0.17 |
| SQLite | `better-sqlite3` | ^13.0.3 |
| Query builder | `drizzle-orm` | ^0.45.2 |
| Migrations | `drizzle-kit` | ^0.31.10 |
| Fake data | `@faker-js/faker` | ^10.6.0 |
| HTTP retry | `p-retry` | ^8.0.0 |
| CLI prompts | `@clack/prompts` | ^1.7.0 |
| UI framework | `react` + `@mantine/core` | ^19.2.8 + ^9.5.2 |
| UI state | `mobx` + `mobx-react-lite` | ^7.0.3 + ^5.0.3 |
| Notifications | `@mantine/notifications` | ^9.5.2 |
| File upload UI | `@mantine/dropzone` | ^9.5.2 |
| API server | `fastify` | ^5.12.1 |
| Validation | `zod` | ^4.5.4 |
| Code viewer | `@monaco-editor/react` | ^4.7.0 |
| Testing | `vitest` | ^4.1.11 |
| Coverage | `@vitest/coverage-v8` | latest |
| Linting | `oxlint` | ^1.80.0 |
| Formatting | `oxfmt` | ^0.65.0 |
| Dep checker | `adio` | ^3.0.1 |
| TypeScript | `typescript` | 7.0.2 |
| Dev runner | `concurrently` | ^10.0.5 |
| UI bundler | `vite` + `@vitejs/plugin-react` | ^8.2.2 + ^6.1.1 |
| Package manager | `yarn` | 4.18.0 |

---

## DI Conventions

### Abstraction (one per file, in `abstractions/` directory)
```ts
import { createAbstraction } from "@webiny/stdlib";

interface IListProjectsRepository {
  execute(input: ListProjectsRepository.Input): Promise<Result<ListProjectsRepository.Output, ListProjectsRepository.Error>>;
}

export const ListProjectsRepository = createAbstraction<IListProjectsRepository>("Projects/ListProjectsRepository");

export namespace ListProjectsRepository {
  export type Interface = IListProjectsRepository;
  export type Input = { /* ... */ };
  export type Output = { projects: Project[] };
  export type Error = ProjectPersistenceError;
}
```

### Implementation (separate file, same directory as feature — NOT in `abstractions/`)
```ts
import { ListProjectsRepository as Abstraction } from "./abstractions/ListProjectsRepository.js";

class ListProjectsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}
  public async execute(input: Abstraction.Input): Promise<Result<Abstraction.Output, Abstraction.Error>> { /* ... */ }
}

export const ListProjectsRepository = Abstraction.createImplementation({
  implementation: ListProjectsRepositoryImpl,
  dependencies: [DatabaseClient],
});
```

### Feature (registers implementations into DI container)
```ts
export const ProjectsFeature = createFeature({
  name: "Projects/ProjectsFeature",
  register(container) {
    container.register(ListProjectsRepository).inSingletonScope();
    container.register(CreateProjectRepository).inSingletonScope();
    // ...
  },
});
```

### Import convention
- Abstraction imported as `Abstraction`: `import { Xxx as Abstraction } from "./abstractions/Xxx.js"`
- Implementation imported unaliased: `import { Xxx } from "./Xxx.js"`

---

## Seeding Behavior

- **Environment-scoped**: seeding targets one environment. An environment whose `api` app is not
  deployed has no `api_url` and cannot be seeded — `EnvironmentContextService` fails it with
  `EnvironmentNotConnectedError` (409) rather than dereferencing null
- **Ref field shape**: `{ modelId, id }` only — never send `entryId` in mutation input variables
- **Dependency ordering**: models are topologically sorted by ref dependencies before seeding — referenced models seed first
- **Available refs**: before seeding, all existing entries (both `created` and `imported`) are preloaded into the `availableRefs` map so ref generators can pick from them
- **Batch size**: configurable (1–50 concurrent mutations per batch), set on the confirmation dialog
- **Fail fast**: seeding stops for a model on first error
- **Retry**: HTTP 429 (rate limit) retries up to 3 times with exponential backoff
- **Confirmation dialog**: shows tenant, model count, entries per model, revisions, batch size (editable), publish strategy, publish percent, and include-unpublish-cycles before confirming

---

## Key Rules

1. **Single responsibility** — one `execute()` per use case and repository. No multi-method classes.
2. **Folder boundaries** — `src/shared/` is platform-agnostic. `src/shared/node/` is CLI+API only. UI must NEVER import from `src/shared/node/`, `src/api/`, or `src/cli/`. A pure module the UI needs belongs in `src/shared/`, not under `node/` — `stackOutput/` and `webiny/` live there for exactly that reason.
3. **Abstractions separate from implementations** — always in `abstractions/` subdirectory, separate file.
4. **Never export Impl classes** — only the `createImplementation` result is exported.
5. **Result pattern** — all operations return `Result<T, E>`, never throw for expected failures.
6. **Errors extend BaseError** — with namespaced `code` and `statusCode`.
7. **All user input validated with Zod** — at every boundary (CLI, API, UI, repository).
8. **No `as` casts** — fix types at source. Only acceptable at JSON parse boundaries.
9. **Thin routes** — resolve use case, call execute, send result. No business logic.
10. **Routes as DI instances** — features register their own routes. No centralized if/switch.
11. **`registerInstance` only for pre-built infrastructure** — DatabaseClient, GraphQLConfig, EncryptionKey, BaseUrl. Everything else via `createImplementation`.
12. **Constructor deps are `private readonly`** with explicit access modifiers on all methods.

### Scoping
| Type | Scope |
|---|---|
| UseCase | Transient (default) |
| Repository / Service / Gateway | `.inSingletonScope()` |
| Presenter | Transient |
| Command (CLI) | `.inSingletonScope()` |

---

## Tooling

| Script | Command | Purpose |
|---|---|---|
| `yarn cli` | `tsx src/cli/entry.ts` | CLI tool |
| `yarn api:dev` | `tsx --watch src/api/entry.ts` | API server (port 4000) |
| `yarn ui:dev` | `vite dev` | UI dev server (port 4001) |
| `yarn dev` | `concurrently` | API + UI together |
| `yarn build:ui` | `vite build` | Production UI build |
| `yarn typecheck` | `tsc --noEmit` | Type checking |
| `yarn test` | `vitest run` | Run tests |
| `yarn test:watch` | `vitest` | Watch mode |
| `yarn lint` | `oxlint --deny-warnings src/` | Lint check |
| `yarn lint:fix` | `oxlint --fix` | Lint auto-fix |
| `yarn format:check` | `oxfmt --check src/` | Format check |
| `yarn format:fix` | `oxfmt src/` | Format fix |
| `yarn db:generate` | `drizzle-kit generate` | Generate migration |
| `yarn db:migrate` | `drizzle-kit migrate` | Run migrations |
| `yarn deps:check` | `adio` | Check unused/missing deps |

**Before every commit:** `yarn lint && yarn format:check && yarn typecheck && yarn test`

---

## Agents

| Agent | Model | Scope |
|---|---|---|
| `api-developer` | sonnet | `src/api/`, `src/shared/`, `src/shared/node/` |
| `ui-developer` | sonnet | `src/ui/` |
| `ui-designer` | sonnet | `src/ui/theme/`, `src/ui/components/`, `*.tsx` visual only |

## Skills

| Skill | When to use |
|---|---|
| `project-architecture` | Before writing any feature code |
| `dependency-injection` | Before writing any DI-related code |
| `cli-developer` | Before writing CLI commands |
| `api-developer` | Before writing API routes |
| `ui-developer` | Before writing UI features |
| `ui-design` | Before visual/style changes |
| `handoff` | End of session |
| `review-fix-loop` | Iterative review + fix cycles |

---

## Testing

- **806 tests** across 64 files (vitest)
- **Coverage**: v8 provider, ~83% statements, ~71% branches, ~85% functions. Thresholds enforced via `vitest.config.ts`.
- **Nothing in the suite spawns a real deploy.** The CLI runner is exercised against a fake
  `webiny` binary written into a temp checkout; deploy and destroy are exercised against a
  recording stub. Both are deliberate — a test that deploys costs money and takes tens of minutes.
  The route tests enqueue jobs and never run the queue, so nothing reaches a live CMS either.
- **`StubHttpClient`** (`src/ui/testing/`) answers every typed route from a table keyed by path,
  building the same envelope the server does, and the untyped `get`/`post` half from a second table
  keyed by the literal path. UI presenters are tested through their own DI feature with it
  underneath, which keeps the gateways and repositories real — they are where the shapes a
  presenter reads come from. Its list-state stub calls `onChange` like the real one; without that
  no test reaches a filter or pagination path.
- **CLI commands are tested through `createCliTestContainer()`** (`src/cli/testing/`). Only
  `Prompts` and `UI` are replaced: the prompt stub answers from a script in the order the command
  asks, and the UI stub records what was printed and on which channel. Everything below those two
  is production code, because a command's job is to turn answers into those calls. A select is
  answered by the label the command printed — `pick("Blog")` — since the values it offers are rows
  it has just read and the test has no handle on them.
- **Job executors are tested against a stub execution context** (`src/shared/node/jobs/__tests__/`)
  rather than through the worker. What an executor owns is its guard clauses, its config parsing
  and the mapping from a service Result to logs and to a thrown error; running the queue to reach
  that would prove the queue instead.
- **The child-process tests spawn real processes.** `ChildProcessTracker` is about killing process
  groups, which a fake cannot demonstrate: they start detached `node` processes, some with children
  of their own, and assert the whole group is gone.
- **Coverage excludes**: abstractions, feature.ts, index.ts, types, schemas, UI, routing, and the
  two @clack adapters (`src/cli/Prompts.ts`, `src/cli/UI.ts`) — only business logic is measured.
- **`createTestContainer()`** — fully-wired DI container for tests. In-memory SQLite (`:memory:`), real generators, real cache. Mock only HttpClient.
- Pass `{ httpClient: mockHttpClient }` to override HTTP. Everything else is production code.
- API integration tests use `app.inject()` (Fastify's built-in).
- Run with coverage: `yarn test --coverage`

---

## Architecture Decision Records (21)

| # | Title | Status |
|---|---|---|
| 001 | Technology Stack | Accepted |
| 002 | Runtime Data Directory (.webiny/) | Accepted |
| 003 | Single Central Database | Accepted |
| 004 | DI Package (@webiny/di) | Accepted |
| 005 | MobX for UI State | Accepted |
| 006 | No Auth, Localhost Only | Accepted |
| 007 | Single Package with Path Aliases | Accepted |
| 008 | Clean Break Migration | Accepted |
| 009 | Dev Serving Pattern | Accepted |
| 010 | Generators Reuse + DI Rewrite | Accepted |
| 011 | Thin Routes | Accepted |
| 012 | Test Container Pattern | Accepted |
| 013 | API Token Encryption (AES-256-GCM) | Implemented |
| 014 | Multi-Tenant Discovery | Implemented |
| 015 | Versioned API Operations | Implemented |
| 016 | Model & Group Sync | Implemented |
| 017 | Project Detail Page | Implemented |
| 018 | File Uploads | Implemented |
| 019 | Seed Data Audit Log | Implemented |
| 020 | Environments as First-Class Scope | Implemented |
| 021 | Read Pulumi State, Not the CLI | Implemented |

---

## Runtime Data

All runtime data in `.webiny/` (gitignored):
```
.webiny/
├── data-mock.db    # SQLite database
├── cache/          # File cache
└── logs/           # Log files
```

Default DB path: `.webiny/data-mock.db`. Override via `DB_PATH` in `.env`.

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ENCRYPTION_KEY` | Yes (except for `init`) | — | 64-char hex string for AES-256-GCM |
| `API_PORT` | No | 4000 | Fastify server port |
| `UI_PORT` | No | 4001 | Vite dev server port |
| `DB_PATH` | No | .webiny/data-mock.db | SQLite database path |
