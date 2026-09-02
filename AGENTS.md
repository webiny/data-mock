# AGENTS.md — Refactoring Guide for webiny-mock-data

This document is the single source of truth for agents refactoring this project. Every agent and skill references it. Read it before writing any code.

## Vision

Transform `webiny-mock-data` from a single-project CLI tool into a multi-project tool with:
- **SQLite database** for project configuration (replacing `.env`)
- **Web UI** for managing projects, selecting models, configuring seeding, and monitoring progress
- **Webiny DI** (`@webiny/di` + `@webiny/stdlib`) replacing manual wiring
- **Clean architecture** with abstractions, features, and the Result pattern

## Current State

A CLI tool that creates mock data in Webiny CMS via GraphQL. See `documentation/research/01-current-architecture.md` for full details.

**What works well (preserve):**
- `src/apps/tenants/helpers/generators/` — field generator registry (11 types + recursive object/dynamicZone)
- `src/apps/tenants/helpers/generators/validators/` — validation-aware generation
- `src/apps/utils/fields/` — GraphQL field selection builders
- `src/cache/` — FileCache + MemoryCache (wire through DI)
- `src/apps/GraphQLApplication.ts` — HTTP client with retry/batching (extract into abstraction)

**What needs replacing:**
- `.env` for project config → SQLite database
- Manual constructor wiring in `Application.ts` → DI container
- Boolean-flag CLI routing → proper commands via DI
- Hardcoded model definitions → dynamic from API + user selection
- Global singleton registry → DI-scoped generator registry

---

## Target Architecture

### Directory Structure

```
src/
├── shared/                          # Cross-layer shared code
│   ├── types.ts                     # Domain types (Project, Model, Entry, etc.)
│   ├── errors.ts                    # BaseError subclasses
│   └── abstractions/                # Shared abstractions
│       ├── GraphQLClient.ts         # GraphQL HTTP client abstraction
│       ├── GeneratorRegistry.ts     # Field generator registry abstraction
│       └── ProjectRepository.ts     # Project config CRUD abstraction
├── db/                              # SQLite database layer
│   ├── schema.ts                    # Drizzle sqliteTable definitions
│   ├── client.ts                    # createDatabaseClient() — better-sqlite3 + drizzle
│   ├── migrate.ts                   # Run migrations at startup
│   ├── migrations/                  # SQL migration files (drizzle-kit generate)
│   ├── abstractions/
│   │   └── DatabaseClient.ts        # DI token for { db: BetterSQLite3Database }
│   └── feature.ts                   # DatabaseFeature — registers client as singleton
├── generators/                      # Field generators (ported from apps/tenants/helpers/generators)
│   ├── fields/                      # Per-type generators
│   ├── validators/                  # Per-rule validators
│   ├── registry.ts                  # Registry — wired via DI, not global singleton
│   ├── abstractions/
│   │   └── GeneratorRegistry.ts
│   └── feature.ts                   # GeneratorFeature
├── graphql/                         # Webiny CMS GraphQL client (ported from GraphQLApplication)
│   ├── GraphQLClient.ts             # Implementation with retry/batching
│   ├── abstractions/
│   │   └── GraphQLClient.ts
│   └── feature.ts                   # GraphQLFeature
├── cli/                             # CLI layer
│   ├── entry.ts                     # CLI entry: Container + CliFeature.register() + yargs
│   ├── feature.ts                   # CliFeature — composes command features + services
│   ├── abstractions/                # CLI-specific abstractions (Prompts, UI)
│   └── commands/
│       ├── addProject/              # Add a new Webiny project connection
│       ├── seedEntries/             # Seed entries (select project → models → amount)
│       ├── listProjects/            # List configured projects
│       └── fetchEntries/            # Fetch existing entries (ported from FetchEntriesApplication)
├── api/                             # Local API server (backend for UI)
│   ├── server.ts                    # API entry: Container + ApiFeature.register()
│   ├── feature.ts                   # ApiFeature — composes route features
│   └── routes/
│       ├── projects/                # CRUD for project configs
│       ├── models/                  # List models from a connected project
│       └── seeding/                 # Trigger/monitor seeding jobs
└── ui/                              # Web UI
    ├── App.tsx                      # UI entry: Container + UiFeature.register()
    ├── features/                    # Headless (Gateway + Repository)
    │   ├── projects/
    │   └── seeding/
    ├── presentation/                # Presentation (Presenter + React)
    │   ├── ProjectList/
    │   ├── ProjectDetail/
    │   ├── ModelSelection/
    │   └── SeedingDashboard/
    ├── theme/                       # Design tokens + theme builder
    ├── components/                  # Shared components + wrappers
    └── di/                          # DI utilities
```

### Runtime Data Directory

All runtime data lives in `.webiny/` (already gitignored):

```
.webiny/
├── data-mock.db          # SQLite database (projects, seed jobs)
├── cache/                # File cache (API response caching)
└── logs/                 # Log files (if file logging is enabled)
```

The database path defaults to `.webiny/data-mock.db`. Cache and logs also go here — nothing runtime gets committed.

### Database Schema (SQLite)

```
projects
├── id          TEXT PK
├── name        TEXT NOT NULL
├── api_url     TEXT NOT NULL
├── api_token   TEXT NOT NULL
├── tenant      TEXT DEFAULT 'root'
├── created_at  INTEGER NOT NULL
└── updated_at  INTEGER NOT NULL

seed_jobs
├── id          TEXT PK
├── project_id  TEXT FK → projects.id ON DELETE CASCADE
├── status      TEXT NOT NULL (pending | running | completed | failed)
├── config      TEXT NOT NULL (JSON: { models: [{ modelId, amount }] })
├── result      TEXT (JSON: { created, errors })
├── started_at  INTEGER
├── finished_at INTEGER
└── created_at  INTEGER NOT NULL
```

### DI Bootstrapping

```
CLI entry:
  Container → DatabaseFeature → GraphQLFeature → GeneratorFeature → CliFeature → resolve(Command)

API entry:
  Container → DatabaseFeature → GraphQLFeature → GeneratorFeature → ApiFeature → start server

UI entry:
  Container → UiFeature → features + presentation → render App
```

---

## Technology Stack

| Concern | Library | Version |
|---|---|---|
| DI container | `@webiny/di` | ^1.0.2 |
| Stdlib (Result, BaseError, etc.) | `@webiny/stdlib` | ^0.0.17 |
| SQLite driver | `better-sqlite3` | ^13.x |
| Query builder | `drizzle-orm` | ^0.45.x |
| Migration CLI | `drizzle-kit` | ^0.31.x |
| Fake data | `@faker-js/faker` | ^10.x |
| GraphQL tags | `graphql-tag` | ^2.x |
| HTTP retry | `p-retry` | ^8.x |
| CLI prompts | `@clack/prompts` | ^0.x |
| UI framework | `react` + `@mantine/core` | ^19.x + ^7.x |
| UI state | `mobx` + `mobx-react-lite` | ^6.x + ^4.x |
| API server | `fastify` | ^5.x |
| Testing | `vitest` | ^3.x |
| Validation | `zod` | ^3.x |
| Dev runner | `concurrently` | ^9.x |
| UI bundler | `vite` + `@vitejs/plugin-react` | ^6.x |
| API bundler | `esbuild` | ^0.x |
| Linting | `oxlint` | ^1.80.x |
| Formatting | `oxfmt` | ^0.65.x |
| TypeScript | `typescript` | 7.x |
| Package manager | `yarn` | 4.x (Berry) |

### Dependencies to Add
- `@webiny/di`, `@webiny/stdlib`
- `better-sqlite3`, `@types/better-sqlite3`, `drizzle-orm`, `drizzle-kit`
- `zod`
- `fastify`
- `@clack/prompts`
- `react`, `react-dom`, `@mantine/core`, `@mantine/hooks`
- `mobx`, `mobx-react-lite`
- `vite`, `@vitejs/plugin-react`, `postcss`, `postcss-preset-mantine` (dev)
- `esbuild`, `concurrently` (dev)
- `vitest` (dev)

### Dependencies to Remove (after migration)
- `pino`, `pino-pretty` → replaced by `PinoLoggerFeature` from `@webiny/stdlib/node`
- `nanoid` → replaced by `generateId` from `@webiny/stdlib`
- `write-json-file` → replaced by `JsonFileToolFeature` from `@webiny/stdlib/node`
- `fs-extra` → replaced by `DirectoryToolFeature` + `FileToolFeature`
- `dotenv` → replaced by `ProcessEnvFeature` from `@webiny/stdlib/node`

### Dependencies to Keep
- `@faker-js/faker`, `graphql-tag`, `lodash`, `slugify`, `p-retry`

---

## DI Conventions

Full details in the `project-architecture` skill. Summary:

### Abstractions
```ts
// abstractions/ProjectRepository.ts
import { createAbstraction } from "@webiny/stdlib";

export interface IProjectRepository { ... }
export const ProjectRepository = createAbstraction<IProjectRepository>("Feature/ProjectRepository");
export namespace ProjectRepository {
  export type Interface = IProjectRepository;
}
```

### Implementations
```ts
// ProjectRepository.ts (separate file, NOT in abstractions/)
class ProjectRepositoryImpl implements ProjectRepository.Interface { ... }
export const ProjectRepository = Abstraction.createImplementation({
  implementation: ProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
```

### Features
```ts
// feature.ts
export const ProjectsFeature = createFeature({
  name: "Projects/ProjectsFeature",
  register(container) {
    container.register(ProjectRepository).inSingletonScope();
    container.register(CreateProjectUseCase);
  },
});
```

### Rules
- Abstractions and implementations in **separate files, separate directories**
- Implementation classes have `Impl` suffix, exported consts do NOT
- All operations return `Result<T, E>` — never throw for expected failures
- Errors extend `BaseError` with namespaced `code` (e.g., `"Project/NotFound"`)
- All user input validated with Zod
- No `as` type casts — fix types at source
- Constructor deps are `private readonly`
- All class methods have explicit access modifiers

### Scoping
| Layer | Scope |
|---|---|
| UseCase | Transient (default) |
| Service / Repository / Gateway | `.inSingletonScope()` |
| Presenter | Transient |
| Command (CLI) | `.inSingletonScope()` |

---

## SQLite Conventions

See `documentation/research/02-sqlite-patterns-reference.md` for full patterns.

- **Driver:** `better-sqlite3` with WAL mode, busy_timeout=5000, foreign_keys=ON
- **Schema:** Drizzle `sqliteTable()` in `src/db/schema.ts`
- **IDs:** Text, generated via `generateId()` from `@webiny/stdlib`
- **Timestamps:** Integer columns, Unix epoch milliseconds
- **JSON storage:** Serialized in `text` columns
- **Migrations:** `drizzle-kit generate` → SQL files in `src/db/migrations/`
- **Default path:** `.webiny/data-mock.db`
- **Startup:** `createDatabaseClient(path)` → `runMigrations(db)` → seed defaults → register in container

---

## Agents

| Agent | Layer | Responsibility |
|---|---|---|
| `api-developer` | `src/api/`, `src/db/`, `src/shared/`, `src/graphql/`, `src/generators/` | Backend: API routes, SQLite, GraphQL client, generator system |
| `ui-developer` | `src/ui/` | Frontend: Gateway → Repository → UseCase → Presenter → React |
| `ui-designer` | `src/ui/theme/`, `src/ui/components/`, `*.tsx` | Visual: tokens, theme, component styles, page composition |

All agents reference this file. All follow `project-architecture` skill patterns.

---

## Skills

| Skill | When to Use |
|---|---|
| `project-architecture` | Before writing any feature code in any layer |
| `cli-developer` | Before writing CLI commands |
| `api-developer` | Before writing API routes or server code |
| `ui-developer` | Before writing UI features |
| `ui-design` | Before making visual/style changes |
| `handoff` | End of session — writes handoff doc for next agent |
| `review-fix-loop` | Iterative review + fix cycles |

---

## Refactoring Phases

### Phase 1: Foundation
1. Add new dependencies (`@webiny/di`, `@webiny/stdlib`, `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `zod`)
2. Create `src/db/` — schema, client, migrations, DatabaseClient abstraction
3. Create `src/shared/` — move types, errors, shared abstractions
4. Create root feature composition (`AppFeature`)

### Phase 2: Extract Core Services
1. Extract `GraphQLApplication` → `src/graphql/` with abstraction + DI
2. Port generators to `src/generators/` — wire registry through DI (not global singleton)
3. Port cache system — register via DI
4. Replace logger with `PinoLoggerFeature`

### Phase 3: CLI Refactor
1. Create `src/cli/` with proper command structure
2. Port existing commands (create-data, fetch-data, create-tenants, create-data-per-tenant)
3. Add new commands: add-project, list-projects, remove-project
4. Wire all through DI container

### Phase 4: API Layer
1. Create `src/api/` — local server for UI backend
2. Project CRUD routes
3. Model listing (proxy to Webiny CMS)
4. Seeding job trigger/status routes

### Phase 5: UI
1. Create `src/ui/` with React + DI
2. Project management pages
3. Model selection + seeding configuration
4. Seeding dashboard with progress

---

## Tooling

```bash
yarn lint          # oxlint check
yarn lint:check    # oxlint check (alias)
yarn lint:fix      # oxlint auto-fix
yarn format        # oxfmt format
yarn format:check  # oxfmt check
yarn format:fix    # oxfmt format (alias)
yarn compile       # tsc build
```

**Before every commit:** `yarn lint && yarn format:check && yarn compile`

---

## Research Documents

- `documentation/research/01-current-architecture.md` — full analysis of current codebase
- `documentation/research/02-sqlite-patterns-reference.md` — SQLite patterns from dependency-upgrader
- `documentation/research/03-webiny-di-and-stdlib.md` — @webiny/di and @webiny/stdlib API reference
- `documentation/research/04-skills-inventory.md` — skills copied and adaptations made
- `documentation/research/05-agents-inventory.md` — agents copied and adaptations made
