# Refactoring Phases

See AGENTS.md for the authoritative version. This document adds detail per phase.

## Phase 1: Foundation

**Goal:** Add new dependencies, create the shared and database layers, wire DI.

1. Add dependencies: `@webiny/di`, `@webiny/stdlib`, `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `zod`
2. Create `src/shared/` — move types, create errors (BaseError subclasses), shared abstractions
3. Create `src/db/` — schema.ts (projects + seed_jobs tables), client.ts, migrate.ts, DatabaseClient abstraction, DatabaseFeature
4. Copy shared routing infrastructure from reference project (`defineRoute`, `defineTypedRoutes`, `interpolatePath`)
5. Create root feature composition (`AppFeature`)
6. Ensure `.webiny/` directory is created at startup if it doesn't exist

**Exit criteria:** `yarn compile` passes. Container boots and resolves DatabaseClient. Migrations run and create tables in `.webiny/data-mock.db`.

## Phase 2: Extract Core Services

**Goal:** Port existing functionality into DI-managed services.

1. Extract `GraphQLApplication` → `src/graphql/` with abstraction + feature
2. Port generators to `src/generators/` — registry as DI-scoped service (not global singleton)
3. Port cache → register FileCache and MemoryCache via DI
4. Replace logger with `PinoLoggerFeature` from `@webiny/stdlib/node`
5. Replace dotenv with `ProcessEnvFeature`

**Exit criteria:** All services resolve from container. Existing CLI functionality works through DI.

## Phase 3: CLI Refactor

**Goal:** Proper CLI with DI-backed commands.

1. Create `src/cli/` with entry point, CliFeature
2. Add `@clack/prompts` — wrap as Prompts + UI abstractions
3. Port existing commands: create-data, fetch-data, create-tenants, create-data-per-tenant
4. Add new commands: add-project, list-projects, remove-project
5. Project selection replaces `.env` — pick project from DB, load its config

**Exit criteria:** `yarn cli add-project` stores a project in SQLite. `yarn cli seed` seeds data for a selected project.

## Phase 4: API Layer

**Goal:** Fastify server providing a REST API for the UI.

1. Add `fastify` dependency
2. Create `src/api/` — server.ts, ApiFeature
3. Copy routing infrastructure from reference (routeFactory, registerRoute, sendTyped, createRequestContext)
4. Define shared routes + response schemas in `src/shared/routes/` and `src/shared/responses/`
5. Implement routes: project CRUD, model listing (proxy to Webiny CMS), seeding trigger/status

**Exit criteria:** `yarn api` starts Fastify. CRUD for projects works via HTTP. Model listing proxies to Webiny.

## Phase 5: UI

**Goal:** React + Mantine web interface.

1. Add `react`, `react-dom`, `@mantine/core`, `@mantine/hooks`
2. Copy UI DI infrastructure from reference (createFeature, DiContainerProvider, useFeature, registerFeatures)
3. Copy HTTP client infrastructure (FetchHTTPClient + abstractions)
4. Build headless features: projects (Gateway + Repository), seeding (Gateway + Repository)
5. Build presentation features: ProjectList, ProjectDetail, ModelSelection, SeedingDashboard
6. Theme setup with Mantine tokens

**Exit criteria:** UI shows project list, can add/edit/remove projects, select models, trigger seeding, view progress.
