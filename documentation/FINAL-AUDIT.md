# Final Audit — webiny-mock-data

**Date:** 2026-09-03
**Auditor:** Claude Opus 4.6

---

## Check Results

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | `yarn typecheck` | **PASS** | 0 errors |
| 2 | `yarn lint` | **PASS** | 0 warnings |
| 3 | `yarn test` | **PASS** | 104 tests, 12 files, all pass |
| 4 | `yarn deps:check` | **PASS** | All dependencies in order |
| 5 | DI violations (`new XxxImpl`) | **PASS** | 0 found in production code |
| 6 | Code markers (TODO/FIXME/HACK) | **PASS** | 0 found |
| 7 | UI boundary (imports from shared/node) | **PASS** | 0 violations |
| 8 | CLI commands | **PASS** | 7 commands listed (see note below) |
| 9 | API starts | **PASS** | GET /api/projects returns 200 |
| 10 | Duplicate files | **PASS** | All old locations cleaned up |
| 11 | Circular barrel imports | **PASS** | None detected |
| 12 | ADR statuses | **PASS** | All 16 ADRs have correct statuses |
| 13 | Stale scripts | **MINOR** | `"main": "dist/index.js"` in package.json is stale (no dist), harmless |
| 14 | tsconfig.json | **MINOR** | `ts-node` section is stale (uses tsx now), harmless |
| 15 | .env.example | **PASS** | Exists, documents ENCRYPTION_KEY, DB_PATH, API_PORT |
| 16 | AGENTS.md vs actual structure | **PASS** | Matches (verified after restructuring) |
| 17 | TODO.md up to date | **PASS** | Updated with completed items |
| 18 | Test pattern (createTestContainer) | **PASS** | 10/12 use it; 2 test pure utilities in isolation (acceptable) |
| 19 | drizzle.config.ts | **PASS** | Points to `src/shared/node/db/schema.ts` and `src/shared/node/db/migrations` |
| 20 | Unused abstractions | **PASS** | All registered abstractions are resolved somewhere in the codebase |

---

## Issues Found

### ISSUE 1: `rotate-key` CLI command not discoverable (LOW)

**File:** `src/cli/commands/rotateKey/RotateKeyCommand.ts`
**Problem:** Uses `RotateKeyCommand` abstraction via `Abstraction.createImplementation()` instead of `Command.createImplementation()`. The entry point uses `container.resolveAll(Command)` to discover commands, so `rotate-key` doesn't appear in the help listing.
**Fix:** Change to `Command.createImplementation()` like the other commands, or add special handling in entry.ts (like `init` already has).

### ISSUE 2: Stale `"main"` in package.json (COSMETIC)

**File:** `package.json:4`
**Problem:** `"main": "dist/index.js"` — we never build to dist, this is a dev-only app.
**Fix:** Remove the `main` field or point it at the CLI entry.

### ISSUE 3: Stale `ts-node` section in tsconfig.json (COSMETIC)

**File:** `tsconfig.json:18-21`
**Problem:** `ts-node` config with `tsconfig-paths/register` — we use tsx, not ts-node.
**Fix:** Remove the `ts-node` section.

### ISSUE 4: `bootstrap.ts` still exists (COSMETIC)

**File:** `src/bootstrap.ts`
**Problem:** One-off verification script created during Phase 1. No longer needed.
**Fix:** Delete it.

---

## Final Stats

| Metric | Value |
|---|---|
| Total source files (.ts/.tsx) | 351 |
| Test files | 12 |
| Tests | 104 |
| Abstraction files | 91 |
| Feature files | 33 |
| CLI commands | 8 (init, add-project, list-projects, remove-project, sync-models, push-models, seed, rotate-key) |
| API routes | 15 |
| DB migrations | 5 (0000–0004) |
| ADRs | 16 |
| Type errors | 0 |
| Lint warnings | 0 |
| DI violations | 0 |
| Code markers | 0 |
| UI boundary violations | 0 |

### File distribution

| Directory | Files | Purpose |
|---|---|---|
| `src/shared/` (top) | 22 | Platform-agnostic types, errors, routing, responses |
| `src/shared/node/` | 172 | Node.js shared: DB, cache, graphql, generators, features |
| `src/api/` | 32 | Fastify server, routing, routes |
| `src/cli/` | 33 | CLI commands, abstractions |
| `src/ui/` | 91 | React + Mantine + MobX UI |

---

## Recommendations for Next Session

1. **Fix Issue 1** — `rotate-key` command binding (5 min fix)
2. **Fix Issues 2–4** — cosmetic cleanup (5 min)
3. **Browser testing** — run `yarn dev`, test the full UI flow in a browser
4. **Seed template UI** — the backend supports templates but the UI doesn't have a template picker yet
5. **Model diff UI** — the diff API route exists but the UI doesn't display model change detection
6. **Tenant diff UI** — TenantSyncService now returns diffs but the UI notification doesn't show the details
7. **Integration testing** — test the full flow against a real Webiny instance
8. **CI pipeline** — set up GitHub Actions for typecheck + lint + test on PRs
