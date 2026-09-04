# Session Handoff — 2026-09-03 — Schema Validation, UI Overhaul, Endpoint Clients

## What was done (13 commits, 96 files, +2372/-837)

### GraphQL Schema Alignment & Validation
- Fixed `listTenants` query: `id` + `values { name }` (was `entryId` + `name`)
- Fixed `listContentModels`: `group` is `String!` scalar (was object sub-selection)
- Icon is `{ type, name, value? }` object (not string) — Zod schema + DB storage updated
- All static operation Zod schemas now use `.strict()` — extra fields break validation
- Full field-level validation: models validate `singularApiName`, `pluralApiName`, `group`, `tags`, `plugin`, nested `fields` with `predefinedValues`, `validation`, `listValidation`
- Zod-inferred types (`CmsContentModel`, `CmsContentModelField`, `CmsContentModelGroup`) replace manual interfaces — `ApiCmsModel`/`ApiCmsModelField` in `shared/types.ts` are now aliases

### Operation System Refactor
- `parseOperationResponse` — shared utility replacing copy-paste `getResult` boilerplate
- `defineOperation` — factory for static operations (auto-wires `getResult` from schema)
- `OperationQuery<T>` — builders return `{ query, responseKey, dataSchema }` not bare strings
- Revision operations now have Zod validation (had none before)
- Deleted 6.4.0 override — `description` merged into base `listContentModels`

### Endpoint Client Architecture
- 4 DI endpoint clients: `CmsManageEndpointClient`, `CmsReadEndpointClient`, `CmsPreviewEndpointClient`, `GraphQLEndpointClient`
- Each appends its path (`/cms/manage`, `/cms/read`, `/cms/preview`, `/graphql`) to the base URL
- All 6 services migrated from raw `HttpClient` + manual URL concatenation
- Base URL stored in DB (no `/cms/manage` suffix)

### UI Overhaul
- **Lazy view loading** — only loads data for the active sidebar menu item, not everything on mount
- **Pagination** on all list views (25 items per page, groups paginate by group not model)
- **Server-side pagination** for audit log with `page`/`limit`/`jobId`/`modelId`/`tenant`/`status` query params
- **Audit log filters** — model, tenant, status dropdowns + job filter badge from seed history
- **Clickable rows** — audit log shows entry data JSON, models show field definitions JSON
- **Seed history → audit log** — click a seed job to see its entries filtered
- **Health check** — auto-checks on project load, badge in header (Online/Unreachable/Checking)
- **Seed config** — global defaults (amount, revisions), per-model override behind toggle, `wby*` excluded, dry run default ON, confirmation dialog for real seeding
- **Plugin field** — models from code marked "code model" (seedable, not modifiable)
- **Named VM types** — all tab components use `IModelVM`, `IEntryVM`, etc. instead of `Presenter.VM["..."]` lookups
- Removed all redundant `<Title>` components from content areas
- `routeFactory` now exposes `query` params to handlers
- `Clear All` audit log has confirmation dialog

### Infrastructure
- `.projects.json` seed file — auto-inserts projects + root tenant on server start (gitignored)
- Root tenant guaranteed on project creation and seed
- Recursive ref extraction in `ModelDependencyResolver` — walks object fields and dynamic zone templates
- Sync logs store `request` and `response` separately (new `request` column)
- Migrations regenerated from scratch (clean single migration)

### Discovery Docs
- `docs/discovery/jobs-system-from-dependency-upgrader.md` — full architecture analysis
- `docs/discovery/websocket-and-notifications.md` — WebSocket broadcaster + EventBridge + notification patterns

## Key decisions

- **Strict Zod schemas** — `.strict()` not `.passthrough()`. Extra fields from Webiny fail validation immediately. Prevents silent data corruption.
- **Zod is single source of truth for types** — `ApiCmsModel`, `ApiCmsModelField` are re-exports from Zod-inferred types. No more manual Pick types from `@webiny/api-headless-cms`.
- **`settings` uses `z.record(z.string(), z.any())`** — it's a JSON blob that varies per field type, generators access it as `Record<string, any>`.
- **Endpoint clients via DI** — each endpoint is a separate abstraction with its own token, all sharing `IEndpointClient` interface. Services inject the specific endpoint they need.
- **No React hooks for dialog state** — all dialog/confirm state lives in presenters (MobX observable).
- **URL is source of truth for tab selection** — no MobX state for active tab.
- **`wby*` models excluded from seed config** — system models (wbyTenant, wbyLanguage, backgroundTaskSettings).
- **Plugin models seedable** — `plugin: true` means model definition is from code (can't delete/modify the model), but entries CAN be created.

## Current state

- Branch: `bruno/refactor/project`, ~75 commits ahead of main (not pushed)
- Build: 182 tests passing, 0 type errors, lint clean, format clean
- DB: needs delete + recreate for schema changes (plugin column, request column, migration regenerated)

## Known bugs

- **`productCategory` seed fails** — `"Cannot convert undefined or null to object"` — JS error before HTTP call, likely in `createModelFields` or mutation construction for that specific model's field structure. No response data stored. Needs investigation: check `productCategory` model fields in DB, trace through `createModelFields()` and `buildCreateEntryQuery()`.
- **Tests needed for endpoint clients** — the `createEndpointClient` factory and endpoint feature have no dedicated tests (integration-tested via existing service tests)

## What might come next

### Priority 1 — Bug fix
- Fix `productCategory` seed failure (`Cannot convert undefined or null to object`)
- Write test for the failing model's field structure to reproduce

### Priority 2 — Jobs system (discovery docs complete, coding plan needed)
- Background job execution for seed/sync/cleanup/import
- `jobs` table replacing `seed_jobs` + `sync_logs`
- `JobWorker` with interval-based processing (3s poll)
- `JobExecutorRegistry` mapping type → service
- `JobExecutionContext` with progress + log streaming
- WebSocket for real-time UI updates (`@fastify/websocket`, `WebSocketBroadcaster`)
- `EventBridge` on UI side (source-agnostic event bus)
- Job chaining (auto-sync-tenants after project creation, etc.)

### Priority 3 — UI polish
- URL-driven list state (like prijevodi-online's `URLListState`) — filter/pagination state in URL params
- Endpoint client tests
- Test coverage improvement (currently ~52%)
- Browser testing — no visual verification done this session
