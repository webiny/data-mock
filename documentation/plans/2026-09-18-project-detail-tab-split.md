# Splitting ProjectDetailPresenter into per-tab presenters

## Why

`ProjectDetailPresenter` is 1593 lines driving fifteen tabs. Two constructs exist only because
tabs do not own their own loading:

- `VIEW_DATASETS` — a table mapping a view name to the datasets it needs.
- `activateView(view)` — the shell loading those datasets on the component's behalf.

When a tab owns its data, both disappear: the tab's component asks its own presenter to activate,
and the presenter reads exactly what it owns.

## Target structure

One presentation unit per tab, under `src/ui/presentation/Projects/ProjectDetail/tabs/<Name>/`:

```
tabs/<Name>/
  abstractions/<Name>TabPresenter.ts   createAbstraction + the VM types this tab owns
  <Name>TabPresenter.ts                the implementation, exported via createImplementation
  feature.ts                           registers the presenter, exports { presenter }
  components/<Name>Tab.tsx             the component, resolving its presenter with useFeature
  __tests__/<Name>TabPresenter.test.ts presenter tests, through the real DI feature
```

**`tabs/Tenants/` is the worked reference.** Read all five of its files before writing your own;
copy its shape rather than inventing one.

## The contract

Every tab presenter exposes exactly this, plus whatever actions its tab offers:

```ts
interface I<Name>TabPresenter {
  readonly vm: I<Name>TabVM;
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
}
```

`ProjectDetailTabContext` (`tabs/abstractions/ProjectDetailTabContext.ts`) is a plain value —
`projectId`, `ref` (the resolved environment or null), `envName`, `tenant` — passed down from
`ProjectDetailPage` as a prop. It is deliberately not a service in the container: the shell
resolves the environment asynchronously and React is what knows when a tab is on screen.

Rules that fall out of it, all of them load-bearing:

- **React owns *when*, the presenter owns *how*.** The component's effect calls `activate`; its
  dependencies are the presenter, `context.projectId` and `context.ref?.environmentId`. A presenter
  never remembers which tab is open in order to re-fetch for itself.
- **A read skipped for want of an environment is not marked loaded**, so the next activation — the
  one that arrives with a resolved environment — actually reads.
- **A failed read is never marked loaded either.** A one-second outage must not leave the tab blank
  for the rest of the session.
- **The tab re-reads itself when a job that writes its dataset finishes.** Subscribe to
  `job:status` on the `EventBridge`, ignore other projects and non-terminal statuses, and ask
  `getJobTypeDatasets(event.type)` whether it includes the dataset this tab owns. That descriptor
  table is the single source for the mapping; a local copy is what drifted before.
- **`dispose()` unsubscribes.** The component returns it from its effect.

## What a tab presenter is allowed to depend on

The gateways and repositories it needs, `NotificationService`, `EventBridge`, and
`URLListStateFactory` for a paged list. Inject them directly, exactly as `ProjectDatasets` and the
shell presenter do today — this is a move, not a redesign. Do not introduce new use cases for reads
that are gateway-plus-repository today.

## Architecture rules (AGENTS.md)

- Abstraction in `abstractions/`, one per file. Implementation beside `feature.ts`, never in
  `abstractions/`. Never export the `Impl` class.
- Rule 13: barrels export abstractions only. Rule 14: an implementation is imported only by its own
  domain's `feature.ts`.
- Constructor dependencies are `private readonly`; every method carries an explicit access modifier.
- `Result<T, E>` everywhere; nothing throws for an expected failure.
- Presenters are transient (`container.register(X)` with no scope); gateways and repositories stay
  singletons in their own features.
- A tab's `feature.ts` declares the feature dependencies it needs and nothing more.

## Testing

Follow `tabs/Tenants/__tests__/TenantsTabPresenter.test.ts`. Build a `Container`, register
`HTTPClientFeature` and the tab's own feature, register the `StubHttpClient` and — for a paged tab
— `stubListStateFactory()`. **A presenter test must observe**: `vm` is a MobX computed, so a test
that only reads `presenter.vm` passes whether or not a real view would update. Wrap at least one
assertion in `autorun`.

Cover, at minimum: nothing read without an environment; read once the environment arrives; read
once per context; a failed read asks again; a finishing job of the right type re-reads; a job from
another project or a non-terminal status does not; `dispose` stops the subscription.

## Staged, so the tree always compiles

The old tab components under `ProjectDetail/components/` and the shell presenter keep working while
this lands. Nobody deletes them except the coordinator, in the final step, when `ProjectDetailPage`
switches over to the new components and the migrated fields leave `ProjectDetailPresenter` and its
abstraction.

So: **create your own directory, port your component into it, and delete nothing.**

## Ownership

| Unit | Directory | Dataset | Old component it ports |
|---|---|---|---|
| Tenants (reference) | `tabs/Tenants/` | `tenants` | `components/TenantsTab.tsx` |
| Models | `tabs/Models/` | `models` | `components/ModelsTab.tsx` |
| Templates | `tabs/Templates/` | `templates` | `components/TemplatesTab.tsx` |
| Files | `tabs/Files/` | `files` | `components/FilesTab.tsx` |
| Entries | `tabs/Entries/` | `entries` | `components/AuditLogTab.tsx` |
| SeedHistory | `tabs/SeedHistory/` | `seedJobs` | `components/SeedHistoryTab.tsx` |
| Jobs | `tabs/Jobs/` | `jobs` | `components/JobsTab.tsx` |
| Activity | `tabs/Activity/` | `syncLogs` | `components/SyncLogTable.tsx` |
| PullTenants | `tabs/PullTenants/` | `syncLogs` | `components/SyncTenantsTab.tsx` |
| PullModels | `tabs/PullModels/` | `syncLogs` | `components/SyncModelsTab.tsx` |
| PullImages | `tabs/PullImages/` | `syncLogs` | `components/PullImagesTab.tsx` |
| ImportEntries | `tabs/ImportEntries/` | `tenants`, `models` | `components/ImportEntriesTab.tsx` |

Not split: Environments, System Info and the deployment dialog stay with the shell presenter. They
are the environment resolution itself — selecting, archiving, purging, restoring and deploying —
and splitting them would hand two owners the same state. Seed keeps its own existing feature.

Files owned by the coordinator alone: `ProjectDetailPage.tsx`, `ProjectDetailPresenter.ts` and its
abstraction, `ProjectDatasets.ts`, `projectDatasetDefinitions.ts`, `ProjectDetail/feature.ts`,
`tabs/abstractions/ProjectDetailTabContext.ts`, `App.tsx`, and everything under
`ProjectDetail/__tests__/`.

## Verification

`yarn vitest run src/ui/presentation/Projects/ProjectDetail/tabs/<Name>` and
`yarn typecheck 2>&1 | grep tabs/<Name>`. The full suite, `yarn lint`, `yarn format` and
`yarn adio` are the coordinator's gates once every unit has landed.
