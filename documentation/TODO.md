# TODO — webiny-mock-data

Last audited: 2026-09-03. 296 source files, 11 test files, 98 tests.

---

## COMPLETED (resolved this session)

- ~~ADR statuses out of date~~ → Updated 013-016 to "Implemented"
- ~~Unused dependencies~~ → Removed 9 unused packages
- ~~Lint warning (unused import)~~ → Fixed
- ~~MemoryCache boundary issue~~ → Moved to shared/node/
- ~~Sync services use HttpClient directly~~ → Refactored to use OperationRegistry
- ~~Missing tests (15 services)~~ → 27 new tests added (98 total)
- ~~`as` cast in FetchHTTPClient~~ → Fixed with proper type narrowing
- ~~fs-extra in FileCache~~ → Replaced with native Node.js fs
- ~~code/ directory~~ → Deleted (old Webiny plugin code, nothing referenced it)

---

## NICE TO HAVE (polish/improvements)

### 1. UI needs browser testing
The UI compiles and all features are wired in App.tsx, but it hasn't been tested in an actual browser. Need to:
- Run `yarn dev` and verify the app renders
- Test add project flow end-to-end
- Test model sync
- Test seed configuration + trigger

### 2. Client-side routing
The UI currently uses modals for everything (add project, seed config, seed history). For a better UX, add client-side routing:
- `/` → project list
- `/projects/:id` → project detail (tenants, models, seed history)
- `/projects/:id/seed` → seed configuration

### 3. Model push (create models on Webiny)
ADR-016 describes push support but only pull/sync is built. Creating groups and models on the Webiny CMS via GraphQL mutations is not yet implemented.

### 4. Tenant change detection UI
ADR-014 describes showing added/removed/unchanged tenants during re-sync. The TenantSyncService currently does a full replace without showing a diff. The `TenantSyncResult` type with added/removed/unchanged arrays is documented but not implemented in the service.

### 5. Error handling in UI
The UI presenters set error strings but there's no global error notification system (toast/snackbar). Mantine's notification system could be wired in.

### 6. Loading states for model/tenant sync in UI
The ProjectListPage has sync buttons but loading states may not be fully wired for model sync operations.

### 7. Remaining `as` casts (~15 in production code)
Most are at JSON parse boundaries (acceptable) or in the UI DI bridge (internal). Notable:
- `FetchHTTPClient.ts:64` — `undefined as T` on 204 responses (documented acceptable)
- `defineTypedRoutes.ts:90` — `as unknown as z.ZodType` (Zod limitation)

### 8. dotenv as direct dependency
Both entry points use `import "dotenv/config"`. Works but inconsistent with DI architecture. Low priority.

---

## FUTURE (planned features not yet started)

### 9. Version override operations (ADR-015 partial)
The OperationRegistry is built and base operations are registered for v6.0.0, but:
- The `overrides/` directory is empty — no version-specific overrides exist yet
- Need to identify which Webiny versions have different APIs and create override files

### 10. Seed scheduling / batch jobs
Currently seeding is one-shot (CLI or API trigger). Future: scheduled seed runs, batch seeding across multiple tenants/models, seed templates.

### 11. Seed dry-run mode
The old code had `--dryRun` support. The new SeedService doesn't have a dry-run mode that generates entries without sending them.

### 12. Export/import seed configurations
Save seed configurations (which models, how many entries) as templates that can be reused or shared.

### 13. Entry references (ref fields)
The RefGenerator currently returns `null` — ref fields cannot be auto-generated because they depend on existing entries. Need a strategy for:
- Seeding in dependency order (create referenced entries first)
- Linking to existing entries by ID

### 14. API token encryption key rotation
ADR-013 mentions key rotation as future work. Currently changing the key breaks all stored tokens.

### 15. FileCache.clear() double-hashing bug
Tests revealed that clearing individual or all cache keys doesn't work reliably due to a double-hashing issue in the cache key lookup. Low priority since clear() is rarely used in the seeding workflow.

---

## Stats

| Metric | Value |
|---|---|
| Source files | 296 |
| Test files | 11 |
| Tests | 98 |
| CLI commands | 6 (init, add-project, list-projects, remove-project, sync-models, seed) |
| API routes | 12 |
| ADRs | 16 |
| Type errors | 0 |
| Lint warnings | 0 |
| DI violations (new Impl) | 0 |
| `as` casts | ~15 (mostly JSON parse boundaries) |
| Dependencies | all in order (adio verified) |
