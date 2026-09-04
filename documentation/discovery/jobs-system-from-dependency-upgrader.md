# Jobs System — Discovery from dependency-upgrader

Source: `/Users/brunozoric/private/dependency-upgrader`

## Architecture Overview

The dependency-upgrader uses a background job system for long-running operations (scans, upgrades, changelogs). Jobs run server-side with real-time progress pushed to the UI via WebSocket.

## Job Lifecycle

```
enqueue() → pending row in DB → processNextJob() picks it up
  → status: "running" → executor.execute(context)
  → chain follow-up jobs → finishJob()
  → status: "completed" | "failed" | "cancelled"
```

## Core Components

### JobWorker (orchestrator)
- `enqueue(type, payload)` — inserts a pending row in DB; runs a security check for certain job types before inserting
- `processNextJob()` — called on 3-second `setInterval` from `server.ts` (`POLL_INTERVAL_MS = 3000`)
- Picks up all pending jobs, marks them running, fires `executeJob()` concurrently
- Each running job gets an `AbortController` for cancellation
- `cancelJob(id)` — two paths: if running, aborts the controller; if still pending, directly updates to cancelled in DB
- `drain()` — `Promise.all(inFlight)` — waits for all in-flight promises on shutdown
- `recoverStaleJobs()` — on startup, resets jobs stuck in **running OR pending** to "interrupted" status (handles crash recovery)

### JobExecutorRegistry
- Maps job `type` string → executor implementation
- 14 executor types (scan, clone, dependency upgrade, changelog, etc.)
- Each implements: `IJobExecutor { type: string; execute(context): Promise<void> }`

### JobExecutionContext (per-job)
- Created by `JobExecutionContextFactory` (DI-registered factory, not instantiated directly)
- `appendLog(line)` — logs flushed to DB every 2 seconds (`LOG_DB_FLUSH_INTERVAL_MS = 2000`)
- `setProgress({ percent, label })` — written to DB throttled at 1-second intervals (`PROGRESS_DB_WRITE_THROTTLE_MS = 1000`)
- Both are broadcast via WebSocket immediately (no polling)
- Provides `abortSignal` for cooperative cancellation
- `dispose()` — flushes remaining logs, clears the flush timer. Called in `finally` block.

### JobQueryHelper
- Internal helper for DB queries: `getJob`, `listAllJobs`, `waitForJob`, `waitForJobs`, `getRunningJobsForReference`
- `waitForJob(id, abortSignal)` — polls DB until a job reaches terminal status, respecting AbortSignal. Used for job composition.
- `waitForJobs(ids, abortSignal)` — same but for multiple jobs in parallel

### Job Chaining
- After a job completes, automatically enqueues follow-up jobs via `chainRefreshTransientIfNeeded` and `chainScanAfterJobIfNeeded`
- Parent-child relationship via `parentJobId`
- Executors can also wait for child jobs to complete (`waitForJob`/`waitForJobs` with abort signal propagation), enabling job composition beyond simple chaining

### ErrorReporter
- Dependency for reporting job failures
- On scan failure, also broadcasts `scan:failed` event

## DB Schema (`upgrade_jobs`)

| Column | Type | Purpose |
|---|---|---|
| id | text PK | Job ID |
| referenceId | text | What the job operates on (e.g., project ID) |
| referenceType | text | Type of reference |
| type | text | Job type (maps to executor) |
| status | text | pending / running / completed / failed / cancelled / interrupted |
| packages | text (JSON) | Job-specific payload |
| logs | text | Accumulated log lines |
| startedAt | integer | When execution began |
| completedAt | integer | When execution finished |
| warning | text | Warning message if any |
| progress | integer | 0-100 percentage |
| progressLabel | text | Current step description |
| parentJobId | text FK | Parent job for chaining |

Status notes:
- `interrupted` is specifically for crash recovery (set by `recoverStaleJobs` on startup)
- Terminal statuses: completed, failed, cancelled, interrupted

## Real-Time Updates

WebSocket broadcasts three event types:
- `job:status` — status transitions (pending → running → completed)
- `job:log` — streaming log lines
- `job:progress` — progress percentage + label

UI subscribes to these events — no polling needed.

## Key Patterns for webiny-mock-data

### What Maps Well
- **Seed jobs** → executor type "seed", runs the SeedService with progress per model
- **Sync tenants** → executor type "sync-tenants", runs TenantSyncService
- **Sync models** → executor type "sync-models", runs SyncModelsService
- **Cleanup** → executor type "cleanup", runs CleanupService
- **Import** → executor type "import", runs ImportEntriesService

### What We'd Need
1. **`jobs` table** — status, type, projectId, config (JSON), logs, progress, progressLabel, startedAt, completedAt, parentJobId
2. **JobWorker** — enqueue + process loop + cancellation (running + pending paths) + recovery
3. **JobExecutorRegistry** — maps type → service executor
4. **JobExecutionContextFactory** — creates per-job context with progress + logging + dispose
5. **JobQueryHelper** — getJob, listJobs, waitForJob for composition
6. **WebSocket** — Fastify WebSocket plugin for real-time updates to UI
7. **Job chaining** — auto-sync-tenants after project creation, auto-sync-models after tenant sync

### What We Already Have
- `seed_jobs` table — tracks seed jobs with status/config/result (could be generalized)
- `sync_logs` table — tracks sync operations (could merge into jobs)
- SeedService, TenantSyncService, SyncModelsService, CleanupService, ImportEntriesService — all are potential executors

### Migration Path
1. Generalize `seed_jobs` into a unified `jobs` table
2. Create JobWorker with interval-based processing (3s poll)
3. Create JobExecutionContextFactory with log flushing + progress throttling
4. Wrap existing services as JobExecutor implementations
5. Add WebSocket for real-time UI updates
6. Convert sync/seed routes from synchronous to enqueue-and-return
7. Add job chaining rules
8. Add recovery on startup + drain on shutdown
