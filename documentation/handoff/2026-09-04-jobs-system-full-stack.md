# Session Handoff — 2026-09-04 — Jobs System Full-Stack

## What was done

30 commits, 155 files changed, +6481/-1505 lines. Complete jobs system implementation, multiple bug fixes, test coverage improvements, and UI features.

### Jobs System (background execution)
- `jobs` DB table + 2 migrations (jobs table, seed_entries.request_data column)
- `JobWorker`: enqueue, 3s poll, execute, cancel (running + pending), recovery on startup, drain on shutdown
- `JobExecutionContext`: log flushing (2s intervals), progress throttling (1s), WebSocket broadcast
- `JobExecutorRegistry` + 5 executors wrapping existing services (seed, sync-tenants, sync-models, cleanup, import)
- All 5 operation routes converted from synchronous to enqueue-and-return (HTTP 202)
- WebSocket: `FastifyWebSocketBroadcaster` + Fastify plugin (GET /ws), Vite proxy, UI `EventBridge` + `WebSocketListener` with auto-reconnect
- Job notification toasts on completion/failure (color-coded, human-friendly messages)
- Presenter auto-refreshes affected datasets when jobs complete via EventBridge subscription
- Jobs tab in project detail: list with clickable detail view (config, logs, duration), cancel button
- Seed batching: configurable batch size (1-50 concurrent mutations) with UI NumberInput
- Retry on HTTP 429 with exponential backoff (up to 3 retries, 1s/2s/4s)

### Bug Fixes
- `parseOperationResponse` null data guard (productCategory seed failure root cause)
- GraphQL mutations wrap user fields under `values` (Webiny v6 schema)
- Ref field sends only `{ modelId, id }` — removed `entryId` (RefFieldInput schema mismatch)
- Text generator falls through to default for unknown pattern presets (no more null for required fields)
- DynamicZoneGenerator optional chaining on `templates?.length`
- Plugin models kept in sync (seedable), only wby*/system models excluded via shared `isExcludedModel`
- FetchHTTPClient now appends query params to URL (was ignoring `args.query`)
- Duplicate API calls prevented via load guards (StrictMode double-invoke)

### UI Features
- URL-driven list state (URLListState from fundus) for entries filters + pagination
- Health badge on project list (API-cached 10min, clickable for force refresh)
- Audit log detail shows full error + request + response
- Model detail shows full model object (not just fields)
- Push models feature removed entirely (7 files deleted, 15 files cleaned)

### Tests & Coverage
- 275 tests (up from 182): endpoint clients (10), generators (37), CRUD features (17), seed service (2), parseOperationResponse (3), jobs system (22)
- Coverage: 52% → ~56% statements

### Reviews
- 2 rounds of Fable 5.1 review (server + UI), critical findings fixed:
  - EventBridge singleton dedupe (UI features use `~/ui/di/createFeature.js`)
  - Presenter disposes EventBridge subscription on unmount
  - API token redacted from stored request data
  - Error logs no longer overwritten by flush timer
  - Route handlers scope jobs by projectId

## Key decisions

- All operations (seed, sync, import, cleanup) go through the jobs system — no synchronous execution
- Shared `isExcludedModel()` function in `src/shared/node/models/excludedModels.ts` — single place to add system model exclusions
- `wby*` prefix and explicit model IDs excluded; plugin models are NOT excluded (entries are user data)
- GraphQL user fields always under `data.values` in mutations and `values { ... }` in response queries (Webiny v6)
- Ref field shape: `{ modelId, id }` only — no `entryId`
- Seed fails fast (breaks on first error per model)
- Health check cached at API level (10min TTL), `?force=true` bypasses cache
- UI features must use `~/ui/di/createFeature.js` (not `@webiny/stdlib`) for container-level dedupe

## Current state

- Branch: `bruno/refactor/project`, ~106 commits ahead of main (not pushed)
- Build: 0 type errors, 0 lint errors, format clean, 275 tests passing
- DB needs recreate for schema changes (jobs table, request_data column on seed_entries)
- All operations route through jobs — seed/sync/import/cleanup return 202

## What might come next

- **Browser testing** — no visual verification done this session; all UI changes are untested in browser
- **Seed batching validation** — test with large entry counts (1000+) to verify batch behavior under load
- **Job progress reporting** — executors don't call `setProgress()` yet, only `appendLog()`; add percentage progress per model
- **Signal propagation** — `AbortSignal` from job cancellation doesn't reach services (SeedService, CleanupService); cancel is cosmetic for running jobs
- **Jobs list pagination** — currently returns all jobs with no ordering; needs ORDER BY + LIMIT for large job counts
- **Seed config per-type validation** — generic `POST /jobs` accepts any config; executor-level Zod validation would give better 400 errors
- **CompareModelsService dead code** — deleted; verify no other dead code from push models removal
- **Test the `values` wrapper** — verify seeding works for productCategory, location, and other models with nested objects/dynamic zones
- **`seed_jobs` → `jobs` migration** — `seed_jobs` table is now legacy; consider migrating existing seed job data or dropping it
