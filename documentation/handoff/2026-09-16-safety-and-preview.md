# Session Handoff — 2026-09-16 — Orphan reaping, sync previews and a safety sweep

## What was done

35 commits. No new feature area was opened; the session hardened what the
previous one built, then followed the bugs that hardening turned up.

**Child processes that outlive the server.** `webiny` children are now spawned
`detached`, so each leads its own process group — cancelling one reaches the
pulumi run underneath it, which signalling the pid alone never did. Every spawn
is recorded in a new `child_processes` table, boot kills whatever a previous run
left behind before marking stale jobs `interrupted`, and shutdown terminates
this server's own children before draining.

**Sync shows its diff first.** `POST /api/sync/preview` starts a `sync-preview`
job that reads everything a sync reads and stores none of it, leaving the diff
on a new `jobs.result` column. Applying enqueues the real sync. Sync all shows
the same diff across every project. The boot and daily scheduled syncs are gone
entirely — nothing rewrites stored state without being asked.

**Confirmation before anything that starts a job** — pull tenants, pull models,
pull files, import entries, the placeholder-image download — through one shared
`ActionConfirmation`.

**A safety sweep over the API.** Twenty-three routes carried both a project id
and an environment id and almost none checked that the two agree; the check now
runs in `routeFactory`. Deploy and destroy resolve both ids before queueing.
Purge refuses unless its confirmation is in the purge step, in both presenters.
Project names and checkouts are unique.

**A sweep over swallowed failures.** Roughly a dozen places dropped a gateway's
error: failed deletes reported as done, empty pages with no reason, a tab left
blank for the session after one failed read, a sync reporting success over
writes that did not happen. Three dead use cases were deleted.

**Add Project.** Several scanned checkouts are added at once; one whose name
matches a project that has no checkout is offered as "attach to existing"
instead of silently creating a second row for the same system. `.projects.json`
can finally carry a `rootPath`.

**Project list.** The health badge is back, asking per environment. Seed Data
and History appear only where there is an API to seed into.

**Tests: 504 → 676 across 57 files.** The project detail presenter and the four
remaining UI presenters got their first coverage, through a shared
`StubHttpClient`. Route tests for deploy, destroy, sync preview and the four
environment job endpoints. The child-process tests spawn real processes.

## Key decisions

- **The preview is not the sync with a dry-run flag.** That flag threaded
  through the writes is where a preview stops matching what it previews. The two
  share `mergeStackRead` and `deriveEnvironmentState` instead, both used by the
  write path. Applying re-reads rather than replaying the diff.
- **The `sync-preview` job is global** (`projectId: null`). It writes nothing,
  so per-project serialization has nothing to protect, and scoping it would park
  the dialog behind a twenty-minute deploy.
- **Two guards stand between the reaper and a stranger's process**: a row is
  only an orphan when the process that spawned it is gone, and a pid is only
  killed when its start time and argument vector still match what was recorded.
  `EPERM` from signal 0 counts as alive.
- **Nothing syncs on its own.** No boot sync, no periodic sync. A sync is always
  started by a person, and shows its diff first.
- **A failed read is never marked as loaded.** Marking one loaded left a tab
  blank for the rest of the session with nothing asking again.
- **"No API to reach" is not a failure.** A checkout that has never been
  deployed reads "no API", not unreachable — a red badge on every fresh one
  trains people to ignore the badge.
- **The environment-ownership check lives in `routeFactory`**, not in handlers,
  so a route added later cannot forget it.

## Current state

- Branch: `bruno/feat/system-management`
- Build: passing — 676 tests / 57 files, 0 type errors, 0 lint warnings, format
  clean, UI builds, `adio` clean
- Coverage: ~70% statements, ~59% branches, ~74% functions
- Unpushed commits: 70 ahead of `origin/main` (35 from this session)
- **No resource-creating deploy or destroy has ever been run.** Both paths are
  still covered only by a recording stub and a fake `webiny` binary.

## What might come next

1. **Job executor tests.** `jobs/executors` is at 31.6% statements, 6.8%
   branches — the layer that actually runs seed, import, cleanup, upload-files,
   pull-picsum, sync-system, deploy, destroy and sync-preview. The route tests
   prove jobs are enqueued correctly; almost nothing proves the executors behave
   when the queue runs them. Every bug found this session came from this kind of
   untested seam.
2. **Live deploy + destroy against `testing/webiny-v5`.** Still the only way to
   confirm the post-deploy refresh, group-kill on cancel, orphan reaping across
   a restart, and the preview against real stack output. Costs money, tens of
   minutes, needs sign-off.
3. **CLI is 0% covered** — all 8 commands. `remove-project` archives, restores
   and purges; `rotate-key` re-encrypts every stored token. Both destructive.
4. **`WebSocketBroadcaster` is 0% covered** — the transport behind live logs,
   job status and progress.
5. **Push the branch.** Nothing has left the machine in three sessions.
6. **`ProjectDetailPresenter` is still 1757 lines.** The dataset-loading half is
   the remaining large piece; it needs a dozen gateways and repositories to move
   with it.
7. **`parentJobId` is dead** — a column, a type field, a schema field, a mapper
   line and an enqueue input, all carrying `null` forever. Left in place:
   dropping a column is a migration for no functional gain, and a job that
   spawns sub-jobs would want it.
