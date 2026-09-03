# TODO — webiny-mock-data

Last audited: 2026-09-03. 304 source files, 8 test files, 71 tests.

---

## MUST FIX (blocking a working product)

### 1. ADR statuses out of date
ADRs 013, 014, 015, 016 all say "Planned" but are implemented. Update statuses to "Accepted" or "Implemented".

### 2. Unused dependencies in package.json
These are no longer imported anywhere in `src/`:
- `@webiny/api-aco` — not imported (was only used by old `src/apps/`)
- `yargs` + `@types/yargs` — CLI was replaced with @clack/prompts, no yargs imports remain
- `slugify` — not imported (AGENTS.md says replace with `transliteration`, but neither is used now)
- `write-json-file` — not imported
- `pino` + `pino-pretty` — replaced by `PinoLoggerFeature` from `@webiny/stdlib/node` (stdlib bundles pino internally)
- `graphql-tag` — not imported
- `nanoid` — not imported (replaced by `generateId` from `@webiny/stdlib`)

Note: `@webiny/api-headless-cms` IS still used — `src/shared/types.ts` imports CMS type definitions from it.

### 3. Lint warning — unused import
`src/ui/components/AppLayout.tsx:2` — `Button` imported but never used. Remove it.

### 4. MemoryCache imports from shared/node (boundary issue)
`src/shared/MemoryCache.ts` imports from `~/shared/node/cache/types.js` and `~/shared/node/cache/CacheKey.js`. This means MemoryCache is NOT actually platform-agnostic — CacheKey depends on Node `crypto`. If UI ever needs MemoryCache, this breaks. Options:
- Move MemoryCache to `shared/node/` (honest about its Node dependency)
- Extract a platform-agnostic CacheKey that uses Web Crypto API

### 5. SyncModelsService and TenantSyncService use HttpClient directly
These services build raw fetch calls with project-specific headers instead of using the GraphQLClient properly. They should create a project-scoped GraphQLClient (with the project's URL, decrypted token, tenant) and use it through the standard GraphQL abstraction. The SeedService already does this correctly.

---

## SHOULD FIX (quality/correctness)

### 6. Missing tests — 15 untested services/repositories
The following have zero test coverage:
- **Models:** SyncModelsService, CompareModelsService, ListProjectGroupsRepository, ListProjectModelsRepository, SyncProjectGroupsRepository, SyncProjectModelsRepository, GetProjectModelRepository
- **Seeding:** SeedService, CreateSeedJobRepository, UpdateSeedJobRepository, ListSeedJobsRepository
- **Tenants:** VerifyProjectAccessService
- **Other:** FileCache, OperationRegistry (has 8 tests but base operations are untested)

### 7. `as` casts in production code — 20 instances
Most are at JSON parse boundaries (acceptable) or in the UI DI bridge (internal). The notable ones:
- `src/ui/infrastructure/httpClient/FetchHTTPClient.ts:63` — `undefined as T` (should use a proper empty return)
- `src/ui/infrastructure/httpClient/FetchHTTPClient.ts:17` — `args as { params }` (should type the function properly)
- `src/shared/routing/defineTypedRoutes.ts:90` — `as unknown as z.ZodType` (documented limitation)

### 8. `fs-extra` still used in FileCache
`src/shared/node/cache/FileCache.ts` imports `fs-extra`. Per AGENTS.md this should be replaced with `@webiny/stdlib/node` FileToolFeature or plain Node `fs`. Low priority since it works.

### 9. `dotenv` still a direct dependency
Both entry points use `import "dotenv/config"`. Per AGENTS.md this should be replaced with `ProcessEnvFeature` from `@webiny/stdlib/node`. The current approach works but is inconsistent with the DI architecture.

### 10. `transliteration` package not added
AGENTS.md says `slugify` → `transliteration`, but neither is currently imported. If slugification is needed (e.g., for model slug generation), add `transliteration` and remove `slugify`.

---

## NICE TO HAVE (polish/improvements)

### 11. UI needs browser testing
The UI compiles and all features are wired in App.tsx, but it hasn't been tested in an actual browser. Need to:
- Run `yarn dev` and verify the app renders
- Test add project flow end-to-end
- Test model sync
- Test seed configuration + trigger

### 12. Client-side routing
The UI currently uses modals for everything (add project, seed config, seed history). For a better UX, add client-side routing:
- `/` → project list
- `/projects/:id` → project detail (tenants, models, seed history)
- `/projects/:id/seed` → seed configuration

### 13. Model push (create models on Webiny)
ADR-016 describes push support but only pull/sync is built. Creating groups and models on the Webiny CMS via GraphQL mutations is not yet implemented.

### 14. Tenant change detection UI
ADR-014 describes showing added/removed/unchanged tenants during re-sync. The TenantSyncService currently does a full replace without showing a diff. The `TenantSyncResult` type with added/removed/unchanged arrays is documented but not implemented in the service.

### 15. Error handling in UI
The UI presenters set error strings but there's no global error notification system (toast/snackbar). Mantine's notification system could be wired in.

### 16. Loading states for model/tenant sync in UI
The ProjectListPage has sync buttons but loading states may not be fully wired for model sync operations.

---

## FUTURE (planned features not yet started)

### 17. Version override operations (ADR-015 partial)
The OperationRegistry is built and base operations are registered for v6.0.0, but:
- The `overrides/` directory is empty — no version-specific overrides exist yet
- No mechanism to add overrides at runtime or via configuration
- Need to identify which Webiny versions have different APIs and create override files

### 18. Seed scheduling / batch jobs
Currently seeding is one-shot (CLI or API trigger). Future: scheduled seed runs, batch seeding across multiple tenants/models, seed templates.

### 19. Seed dry-run mode
The old code had `--dryRun` support. The new SeedService doesn't have a dry-run mode that generates entries without sending them.

### 20. Export/import seed configurations
Save seed configurations (which models, how many entries) as templates that can be reused or shared.

### 21. Entry references (ref fields)
The RefGenerator currently returns `null` — ref fields cannot be auto-generated because they depend on existing entries. Need a strategy for:
- Seeding in dependency order (create referenced entries first)
- Linking to existing entries by ID

### 22. Remove old `code/` directory
There's still a `code/` directory at the project root with old Webiny plugin code (authorization, tenants). This is separate from the `src/` code — verify it's not needed and delete.

### 23. API token encryption key rotation
ADR-013 mentions key rotation as future work. Currently changing the key breaks all stored tokens.

---

## Stats

| Metric | Value |
|---|---|
| Source files | 304 |
| Test files | 8 |
| Tests | 71 |
| CLI commands | 6 (init, add-project, list-projects, remove-project, sync-models, seed) |
| API routes | 12 |
| ADRs | 16 |
| Type errors | 0 |
| Lint errors | 1 (unused import) |
| DI violations (new Impl) | 0 |
| `as` casts | ~20 (mostly JSON parse boundaries) |
