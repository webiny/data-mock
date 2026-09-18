# Session Handoff — 2026-09-17 — Bugs and Coverage

## What was done

29 commits. Started from a coverage push and turned into a bug hunt: nearly every gap
covered produced a defect, and several were data-destroying.

**Data safety**

- **Key rotation was all-or-nothing in name only.** `KeyRotationService` rotated row by row and
  returned on the first failure, leaving the database holding two keys while `.env` still named the
  old one — every already-rotated token unreadable, with no recovery. Now in a transaction, with
  the failure thrown so the rollback happens. 15% → 100% statements.
- **The four sync repositories delete before they insert.** Run loose, a failure part-way through
  left an environment with fewer rows than it started with — a sync that failed destroyed the
  inventory it was refreshing. All four now transactional. Before this session the codebase had
  zero `db.transaction` calls.
- **A failed stack read blanked a live environment.** `RefreshEnvironmentStacksService` derived the
  environment row from `stored.isOk() ? stored.value : []`, so a transient database error after a
  deploy recorded a deployed environment as never deployed.
- **A seeded project cannot be deleted.** `.projects.json` recreates it on every boot, so a purge
  destroyed its history and handed back an empty project of the same name.

**Seeding correctness**

- A cancelled run was recorded as `completed` (new `cancelled` status through schema, route guard
  and badge); a failed outcome write stranded the row at `running`; the first failed entry
  abandoned the rest of a model silently; three audit writes were dropped.
- `sendMutation` retried only 429 and did not catch a throw at all — one dropped socket marked a
  ten-thousand-entry run FATAL. Now retries 5xx and network errors, failing a single entry.
- Resume a run that stopped early, from what it did not create (`ResumeSeedService`, a route and a
  Seed History button).

**Generators — five bugs, all legal CMS configurations that made seeding throw**

`minLength`/`maxLength` are characters but were passed to `faker.lorem.words` as a word count, so
any long-text field with a minimum above 25 was unseedable; `createTime` appended `:00` to every
bound and used `faker.date.future` for one-sided bounds, so the time of day came out unconstrained;
a dynamic zone with `settings.current` past its last template threw; the registry's "not found"
error named `"Function"` for every class. Generators now at 98.3% branches.

**UI**

- Both project pages marked themselves loaded after a *failed* load, so neither could retry.
- A sync that discovered a project's first environment listed it while still saying there were
  none, with nothing selected.
- A tab opened before its environment resolved never fetched — fixed by making the effect depend on
  the resolved environment, not by giving the presenter memory.
- Jobs lists no longer ship the log column they never render; the panel fetches it on open.
- The health cache moved out of a module-level `Map` into the container, and is invalidated on
  update, archive and purge.
- The checkout path stayed hidden behind the API URL on the detail header.

**Removed**

The `GraphQLClient` subsystem (registered nowhere, resolved only by its own test), `lodash`,
`p-retry`, eleven UI barrels trimmed to abstractions, `JobQueryHelper.waitForJob`, `SyncAllUseCase`,
seven unused CLI abstractions. Migrations squashed to one baseline.

**Tests**: 806 → 987 across 76 files. Coverage ~86% statements, ~76% branches; thresholds raised.

## Key decisions

- **Barrels export abstractions only** — never a feature, never an implementation. A feature is
  registered once and imported from its own `feature.ts`. An implementation is never imported
  outside its domain directory; in practice only that domain's `feature.ts` imports it. Three
  skills disagreed on this and now say the same thing (AGENTS.md rules 13 and 14).
- **React owns *when* data is fetched; the presenter owns *how*.** A tab's effect depends on the
  resolved environment as well as the view. A presenter that remembered which tab was open was
  tried and reverted — the component already knows when it is on screen.
- **A presenter test must observe.** `vm` is a MobX computed: with no observer it recomputes on
  every read, so a test that only reads `presenter.vm` passes whether or not the view would ever
  update. `__tests__/reactivity.test.ts` wraps reads in `autorun`.
- **A dataset skipped for want of an environment is not marked loaded**, which is what makes the
  above safe.
- **A seeded project can be archived but never deleted.** `Project.seeded` is derived from
  `.projects.json` on every read, not stored, so removing an entry makes it deletable with no
  restart.
- **Generators are held near 100%** — every bug found in them was a legal CMS field configuration
  that made seeding throw, and a failed entry ends the whole model.
- **Nothing is run automatically on the user's behalf.** The live `webiny deploy --preview` is
  theirs to start.

## Current state

- Branch: `bruno/feat/system-management`, PR #4 open against `main`, body rewritten
- Build: passing — 987 tests, 0 type errors, 0 lint warnings, format clean, `adio` clean, UI builds
- Unpushed commits: 4 at the time of writing (this handoff and the three fixes before it).
  The branch normally pushes as it goes, so check `git status -sb` rather than assuming.
- The local database was deleted with the migration squash. Projects re-added; only
  `webiny-js-6.5` returns from `.projects.json` — and that is the one project that can no longer
  be deleted.

## What might come next

- **Split `ProjectDetailPresenter` per tab.** It is 1486 lines driving fifteen tabs, and
  `VIEW_DATASETS` plus `activateView` exist only because tabs do not own their own loading. Per-tab
  presenters resolved by their tab components would delete both. The user raised this directly.
- **The live `webiny deploy --preview` on `testing/webiny-v5`** — still never run. Pulumi is not
  installed, so the first run downloads it into `~/.webiny`. Nothing in the suite has ever touched
  a real `webiny` binary.
- **Remaining low coverage**: `UploadGlobalFilesToProjectService` 20% branches, `SyncModelsService`
  42%, `listContentEntries` 37%, `JobWorker` 69%.
- **`webiny-v5` reported "nothing deployed"** — the tab-activation race is the likely cause and is
  fixed, but it was never confirmed against the running UI.
- Review PR #4: 111 commits, 566 files.
