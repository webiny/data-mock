# Session handoff — 2026-09-21: splitting the project detail presenter, four coverage holes, and a 404 nobody saw

## What this session did

Two tasks, run in parallel by subagents with disjoint file ownership.

### 1. `ProjectDetailPresenter` split into per-tab presenters

`ProjectDetailPresenter.ts` was 1593 lines driving fifteen tabs. Two constructs existed only
because tabs did not own their loading: `VIEW_DATASETS`, a table mapping a view name to the
datasets it needs, and `activateView(view)`, the shell loading them on the component's behalf.
Both are gone.

Twelve tabs are now presentation units of their own under
`src/ui/presentation/Projects/ProjectDetail/tabs/<Name>/`, each with `abstractions/`, an
implementation, a `feature.ts`, `components/` and `__tests__/`: Tenants, Models, Files, Entries,
SeedHistory, Templates, Jobs, Activity, PullTenants, PullModels, PullImages, ImportEntries.

`tabs/Tenants/` is the worked reference; every other unit copies its shape. The contract is in
`documentation/plans/2026-09-18-project-detail-tab-split.md`.

| | before | after |
|---|---|---|
| `ProjectDetailPresenter.ts` | 1593 | 737 |
| `abstractions/ProjectDetailPresenter.ts` | 340 | 182 |
| `components/ProjectDetailPage.tsx` | 577 | 435 |
| tests | 987 / 76 files | 1193 / 90 files |

**Not split**: Environments, System Info and the deployment dialog. They *are* the environment
resolution — selecting, archiving, purging, restoring, deploying — and giving two owners the same
state is how the bugs of the last session were born. The page frame keeps them, and reads the one
dataset they need through `loadStacks()`, which the page calls when either view is on screen.

**Deleted**: `ProjectDatasets.ts`, `projectDatasetDefinitions.ts`, their test, the twelve old tab
components and the old `useCases/DeleteTemplate/`. `LiveJobLogs.ts` moved into `tabs/Jobs/`.
`components/JobsTab.tsx` became `src/ui/components/JobsTable.tsx`, a dumb props-driven component
rendered both by the Jobs tab and by the global Activity page, which had been reusing it.

### 2. The four remaining coverage holes, and the bugs behind them

| target | branches before | after |
|---|---|---|
| `UploadGlobalFilesToProjectService` | 20% | 100% |
| `SyncModelsService` | 42.3% | 100% |
| `JobWorker` | 64.1% | 100% |
| `listContentEntries` | 37.5% | 91.7% |

`listContentEntries`'s remaining two arms are `?? "unknown"` fallbacks on a Zod issue message,
which `safeParse` always populates — unreachable, left alone.

## Bugs found

- **`JobWorker.finishJobWithLogs` had no error handling on the terminal-status write**, alone in
  that subsystem. A throwing write reached `executeJob`'s catch, which called `finishJobWithLogs`
  again with the same payload shape; a deterministic failure threw again, `processPendingJobs`
  swallowed it with `.catch(() => {})`, and the row read `running` for ever. Fixed: log, then a
  bare `{status, completedAt}` fallback write, and if that fails too it is logged and left to the
  boot-time `recoverStaleJobs()` sweep. Residual, deliberately not changed: the `job:status`
  broadcast still fires after a doubly-failed write, so the UI is told a job finished that the
  database does not record as finished. Recovery corrects it at restart.
- **`ProjectDetailPresenter.clearEntries` passed a project id to
  `EntriesRepository.clearEntries(environmentId)`**, which filters on `entry.environmentId`. It
  pruned nothing: after clearing, the rows stayed in the client cache and only the count went to
  zero. It also used a `!` assertion. Both died with the shell code; the Entries tab does it right.
- **`JobsTab`'s cancel was gated on a resolved environment**, though `cancelJobRoute` is
  `/api/projects/:projectId/jobs/:jobId/cancel` — no environment in the path. On a project with no
  environment the list rendered and Cancel silently did nothing. The Jobs tab guards on the project.

### 3. Three list endpoints had been answering 404 for months

While the split was being verified against the running app, the Entries and Seed History tabs came
back empty. Three gateways built their URL by hand and stopped at the project:

    /api/projects/:projectId/entries
    /api/projects/:projectId/seed-jobs
    /api/projects/:projectId/sync-logs

The server has served all three under `/environments/:environmentId/` since `4f609e2`, which moved
the routes and left these three clients behind. Entries, Seed History, Activity and the three Pull
tabs read nothing from that commit until this one. Confirmed against the running server: the
environment-scoped paths answer 200, the project-scoped ones 404.

Nothing caught it because these are the untyped half of the client — they build their own query
string rather than going through a typed route, and `StubHttpClient` answers `urlData` keyed by
whatever literal path the gateway asks for. The tests encoded the broken URL and agreed with it.

Fixed in two steps: the paths by hand, then the cause. All four hand-built URLs — the three above
plus `jobs`, which was correct but built the same way — now go through
`httpClient.request(route, { params, query })`. The typed client already carried an optional
`query` for every route whether or not it declares a querystring schema, `FetchHTTPClient` already
appended it, and the server reads it loosely through `parseListQuery`, so there was never a reason
to bypass. A route that moves is now a type error.

`StubHttpClient` records the query it was asked for. Tests that could only count calls — the
untyped path stripped the query string before recording it — now assert the filter, page and sort
the gateway actually sent. `syncLogSchema` narrows `type` and `status` to their unions instead of
`z.string()`, which removes the cast that the mapping onto the domain `SyncLog` otherwise needed;
type-level only, since `routeFactory` validates params and body and never the response.

## Decisions worth keeping

- **`ProjectDetailTabContext` is a prop, not a service.** The shell resolves the environment
  asynchronously and React is what knows when a tab is on screen. A tab presenter is handed the
  context on `activate` and remembers no view.
- **Each tab subscribes to `job:status` for its own dataset**, asking `getJobTypeDatasets` rather
  than keeping a local table. The page frame keeps only `environments` and `stacks`.
- **Templates has no subscription at all** — no descriptor writes `templates`; they come from the
  seed config screen. The subscription and its five tests (which had to mock the descriptor table
  to fire) were removed rather than kept as decoration.
- **The four sync-log tabs filter by log type client-side** as well as in the request. They share
  one `SyncLogsRepository` singleton, so a sibling's fetch landing later would otherwise leak its
  rows into the table on screen.
- **A gateway addresses the server through its typed route** — AGENTS.md rule 15. The path lives
  in one place, and `StubHttpClient` can no longer agree with a URL the server does not serve.
- **The "Cleanup Seeded Data" sidebar link is gone.** The action and its dialog live in the Import
  Entries tab, which owns the presenter behind them. Two triggers on two presenter instances was
  the alternative.

## State

- Branch `bruno/feat/system-management`, PR #4 still open against `main`. 116 commits ahead of
  `main`; 4 of them are this session's and are **not pushed**.
- 1193 tests / 90 files, 0 type errors, 0 lint warnings, format clean, `adio` clean, UI builds.
- Skills copied from another of Bruno's projects and adapted to this repo:
  `.claude/skills/safe-refactor/` and `.claude/skills/verify-and-stop/`.

## What might come next

1. **`ProjectDetailPage.tsx` is still 435 lines**, most of it the sidebar. A `ProjectNav` component
   taking the active view and a `goTo` callback would take about 120 of them.
2. **The shell presenter is still 737 lines**, and roughly half is the deployment dialog. It is the
   one candidate left for a unit of its own, and unlike the tabs it has no data of its own to own.
3. **The live `webiny deploy --preview` on `testing/webiny-v5`** — still never run. Pulumi is not
   installed, so the first run downloads it into `~/.webiny`.
4. **`webiny-v5` reported "nothing deployed"** — the tab-activation race is fixed and the mechanism
   it blamed no longer exists, but this has never been confirmed against the running UI.
5. **`StubHttpClient`'s typed list branch always computes `total: items.length`**, so no test can
   fake a total larger than the page it returns. The pagination tests assert the page they sent
   instead. A total override on the stub would let them prove `totalCount` again.
6. **`listSeedEntriesRoute` and `deleteProjectEntriesRoute` share a path template** (GET vs
   DELETE), so `call.path` alone no longer tells them apart in a test; use
   `http.callsTo(path, "DELETE")`.
7. Review PR #4.
