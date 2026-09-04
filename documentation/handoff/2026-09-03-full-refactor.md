# Session Handoff — 2026-09-03 — Full Architecture Refactor

## What was done

50 commits transforming `webiny-mock-data` from a single-project `.env`-based CLI into a multi-project tool with DI architecture, API server, and web UI.

### Infrastructure
- Replaced eslint/prettier with oxlint/oxfmt
- Added `@webiny/di` + `@webiny/stdlib` for DI container, Result pattern, BaseError, Logger
- SQLite database (better-sqlite3 + drizzle-orm) with 7 tables and 6 migrations
- AES-256-GCM API token encryption with key rotation support
- Versioned API operations registry (semver-aware, base v6.0.0 + overrides)
- Proper folder boundaries: `shared/` (platform-agnostic), `shared/node/` (CLI+API), `api/`, `cli/`, `ui/`

### CLI (9 commands)
- init, add-project, list-projects, remove-project, sync-models, push-models, seed, rotate-key, upload-files
- @clack/prompts for interactive UI
- Commands auto-discovered via DI `resolveAll(Command)`

### API Server (20+ routes)
- Fastify on localhost:4000, per-request child containers
- Shared typed route definitions (API + UI share contracts via Zod)
- Project CRUD, tenant sync, model sync/push/diff, seeding trigger/history, templates CRUD, file upload, seed entry audit log

### Web UI
- React 19 + Mantine 9 + MobX 7
- Proper route registry (Route DI abstraction, RouteRegistry, RouterView, URL-synced navigation)
- Gateway → Repository → UseCase → Presenter → React (dumb display)
- Project list, project detail (sidebar: tenants, models/groups, seed history, templates), add project modal, seed config, seed history
- Mantine Notifications for success/error toasts
- Delete confirmation via presenter-managed Modal

### Data Generation
- 11 field generators + 5 validators ported to DI (not global singletons)
- Ref field linking with topological dependency ordering
- FileGenerator picks from uploaded file pool when available
- Seed dry-run mode, seed templates, per-entry audit log with HTTP status

### Testing
- 104 tests across 12 files (vitest)
- createTestContainer: fully-wired DI container, mock only HttpClient
- Coverage: encryption, project CRUD, tenant sync, generators, models, seeding, FileCache, operations registry, dependency resolver

### Documentation
- 19 ADRs covering all major decisions
- 7 research docs (architecture, SQLite patterns, DI/stdlib, reference project layers, build setup, DI audit, DI patterns comparison)
- AGENTS.md as single source of truth for the architecture
- TODO.md, FINAL-AUDIT.md
- 3 agents (api-developer, ui-developer, ui-designer)
- 8 skills (project-architecture, cli-developer, api-developer, ui-developer, ui-design, dependency-injection, handoff, review-fix-loop)

## Key decisions

- `@webiny/di` (not @webiny/ioc) for DI container
- Single-method repositories and use cases (one `execute()` per class)
- `shared/node/` for code shared between CLI and API but not UI
- `registerInstance` only for pre-built infrastructure; everything else via `createImplementation`
- Abstraction imported as `Abstraction`, implementation unaliased
- API token encryption mandatory (ENCRYPTION_KEY in .env)
- Webiny version stored per project for versioned API operations
- Tenant sync auto after project create, with change detection diff
- All user input validated with Zod at every boundary
- Routes as DI instances — no if-chains, features register their own routes
- Default ports: API 4000, UI 4001

## Current state

- Branch: `bruno/refactor/project`
- Build: passing (typecheck, lint, format, 104 tests, deps check)
- Unpushed commits: 50

## What might come next

- **Browser testing** — run `yarn dev` and test the full UI flow end-to-end in a real browser
- **Implement ADR-018 file uploads UI** — drag-and-drop file upload in project detail, file pool management
- **Implement ADR-019 audit log UI** — seed entry viewer in project detail, filters, export
- **Model push UI** — push models section in project detail page
- **Seed scheduling** — recurring seed jobs, batch seeding across tenants
- **Real Webiny version overrides** — identify actual API differences between versions
- **Edit project** — update project credentials/settings
- **Delete old src/apps/ references from CodeGraph** — the index still references deleted files
- **Consider react-router** — if URL routing needs become more complex (nested routes, guards)
