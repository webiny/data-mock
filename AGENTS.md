# AGENTS.md — Refactoring Guide for webiny-mock-data

This document is the single source of truth for agents refactoring this project. Every agent and skill references it. Read it before writing any code.

## Vision

Transform `webiny-mock-data` from a single-project CLI tool into a multi-project tool with:
- **SQLite database** for project configuration (replacing `.env`)
- **Web UI** for managing projects, selecting models, configuring seeding, and monitoring progress
- **Webiny DI** (`@webiny/di` + `@webiny/stdlib`) replacing manual wiring
- **Clean architecture** with abstractions, features, and the Result pattern

## Current State

The legacy single-project CLI (`src/apps/`, `src/base/`, `src/errors/`, `src/index.ts`,
`src/logger.ts`, `index.js`) has been fully removed. Everything now runs on the DI
architecture described below. See `documentation/research/01-current-architecture.md` for
historical context on the code that was migrated away from.

**What was ported (and where it lives now):**
- Field generator registry (11 types + recursive object/dynamicZone) → `src/shared/node/generators/`
- Validation-aware generation → `src/shared/node/generators/validators/`
- GraphQL field selection builders → `src/shared/node/fields/`
- `createEntryVariables` (generator registry → CMS entry values bridge) → `src/shared/node/generators/createEntryVariables.ts`
- FileCache + MemoryCache → `src/shared/node/cache/` (FileCache, Node-only) and `src/shared/MemoryCache.ts` (platform-agnostic)
- GraphQL HTTP client with retry/batching → `src/shared/node/graphql/GraphQLClient.ts`

**What was replaced (not ported — superseded by the new architecture):**
- `.env` for project config → SQLite database (`src/shared/node/db/`)
- Manual constructor wiring in `Application.ts` → DI container (`@webiny/di`)
- Boolean-flag CLI routing → proper commands via DI (`src/cli/commands/`)
- Hardcoded model definitions (`src/apps/cms/` blog/cars demo data) → dynamic model fetching
  from the connected Webiny project (not yet built — CRUD for project configs exists today)
- Global singleton generator registry → DI-scoped `GeneratorRegistry` (`src/shared/node/generators/feature.ts`)
- The `logger` singleton (`pino`) → the `Logger` abstraction from `@webiny/stdlib`, injected as
  a constructor dependency and registered via `PinoLoggerFeature` in `AppFeature`

---

## Target Architecture

### Directory Structure

This is the actual, current structure (not aspirational). Folder boundaries are enforced:
`src/shared/` is platform-agnostic (importable by CLI, API, and UI). `src/shared/node/` is
Node.js-only, shared between CLI and API — **UI must never import from `src/shared/node/`**.
`src/api/`, `src/cli/`, `src/ui/` hold layer-only code.

```
src/
├── shared/                          # Platform-agnostic cross-layer code (UI-safe)
│   ├── types.ts                     # Domain types (Project, SeedJob, ApiCmsModel, GenericRecord, ...)
│   ├── errors.ts                    # BaseError subclasses (namespaced codes)
│   ├── MemoryCache.ts               # In-memory ICache implementation
│   ├── abstractions/                # Interfaces only — no Node.js deps
│   │   ├── HttpClient.ts            # HTTP client abstraction (impl differs per layer)
│   │   └── MemoryCache.ts
│   ├── responses/                   # Zod response schemas (projects, ...)
│   ├── routes/                      # Typed route definitions shared by API + UI gateways
│   ├── routing/                     # defineRoute/defineTypedRoutes helpers
│   │
│   └── node/                        # Node.js-only — shared by CLI + API, NOT UI
│       ├── feature.ts               # AppFeature — root bootstrap for CLI + API (registers
│       │                             # PinoLoggerFeature, so `Logger` from `@webiny/stdlib`
│       │                             # can be injected as a constructor dependency anywhere)
│       ├── FetchHttpClient.ts       # fetch()-based HttpClient implementation
│       ├── db/                      # SQLite database layer (Drizzle + better-sqlite3)
│       │   ├── schema.ts
│       │   ├── client.ts            # createDatabaseClient()
│       │   ├── migrate.ts           # runMigrations()
│       │   ├── migrations/          # SQL migration files (drizzle-kit generate)
│       │   ├── abstractions/DatabaseClient.ts
│       │   └── feature.ts           # DatabaseFeature
│       ├── cache/                   # File-backed cache (Node fs)
│       │   ├── FileCache.ts
│       │   ├── CacheKey.ts
│       │   ├── types.ts
│       │   ├── abstractions/FileCache.ts
│       │   └── feature.ts           # CacheFeature — registers FileCache + MemoryCache
│       ├── graphql/                 # Webiny CMS GraphQL client (retry/batching via p-retry)
│       │   ├── GraphQLClient.ts
│       │   ├── abstractions/{GraphQLClient,GraphQLConfig}.ts
│       │   └── feature.ts           # GraphQLFeature
│       ├── generators/              # Field value generators (DI-scoped registry, not a singleton)
│       │   ├── fields/               # Per-type generators
│       │   ├── validators/           # Per-rule validators
│       │   ├── registry.ts           # GeneratorRegistry implementation
│       │   ├── createEntryVariables.ts # Bridges GeneratorRegistry → CMS entry values
│       │   ├── abstractions/GeneratorRegistry.ts
│       │   └── feature.ts           # GeneratorFeature
│       ├── fields/                  # GraphQL field-selection builders (per CMS field type)
│       │   ├── createField.ts
│       │   ├── createModelFields.ts # Builds a GraphQL selection set from model fields
│       │   └── {text,number,boolean,datetime,json,file,ref,richText,longText}.ts
│       ├── testing/
│       │   └── createTestContainer.ts # Fully-wired DI container for tests
│       └── features/
│           └── projects/            # Shared "projects" feature — used by CLI + API
│               ├── create/          # CreateProjectUseCase + CreateProjectRepository
│               ├── get/             # GetProjectUseCase + GetProjectRepository
│               ├── list/            # ListProjectsUseCase + ListProjectsRepository
│               ├── remove/          # RemoveProjectUseCase + RemoveProjectRepository
│               └── feature.ts       # ProjectsFeature — registers all of the above
│                                     # (each use case / repository has ONE method: execute())
│
├── cli/                             # CLI layer
│   ├── entry.ts                     # Container → AppFeature → CliFeature → dispatch command
│   ├── feature.ts                   # CliFeature — composes command features + services
│   ├── abstractions/                # CLI-specific abstractions (Prompts, UI, Command)
│   └── commands/
│       ├── addProject/              # Resolves CreateProjectUseCase (shared/node)
│       ├── listProjects/            # Resolves ListProjectsUseCase (shared/node)
│       └── removeProject/           # Resolves ListProjectsUseCase + RemoveProjectUseCase
│
├── api/                             # Local API server (backend for UI)
│   ├── entry.ts                     # Container → AppFeature → ApiFeature → listen()
│   ├── server.ts                    # createServer() — Fastify instance + route registration
│   ├── feature.ts                   # ApiFeature — API-only bindings (cross-layer bindings
│   │                                 # live in AppFeature / ProjectsFeature instead)
│   ├── routing/                     # routeFactory, sendTyped, sendError, request context
│   └── routes/
│       └── projects/                # Thin route handlers resolving use cases from shared/node
│
└── ui/                              # Web UI (must not import from src/shared/node/)
    ├── App.tsx / main.tsx           # UI entry: Container + DI providers + render
    ├── di/                          # DI utilities (DiContainerProvider, createFeature, useFeature)
    ├── infrastructure/httpClient/   # Browser fetch()-based HTTPClient implementation
    ├── features/                    # Headless (Gateway + Repository), e.g. projects/
    ├── presentation/                # Presentation (Presenter + useCases + React), e.g. Projects/
    ├── components/                  # Shared components + wrappers
    └── theme/                       # Design tokens + theme builder
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

`AppFeature` (`src/shared/node/feature.ts`) is the shared bootstrap composed by both CLI and
API entry points. It registers logging, env, the database, the file/memory cache, and the
`projects` feature (use cases + repositories) — anything both layers need. `GraphQLFeature` and
`GeneratorFeature` exist and are fully wired (see `src/shared/node/testing/createTestContainer.ts`
for an example), but are not yet composed into `AppFeature` — they'll be added once the seeding
feature (Phase 4/5) needs them.

```
CLI entry (src/cli/entry.ts):
  Container → AppFeature (Logger, Env, Database, Cache, Projects) → CliFeature → resolve(Command)

API entry (src/api/entry.ts):
  Container → AppFeature (Logger, Env, Database, Cache, Projects) → ApiFeature → start server

UI entry (src/ui/main.tsx):
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

### Dependencies to Replace
- `slugify` → `transliteration` (supports transliteration + slugify in one package)

### Dependencies to Keep
- `@faker-js/faker`, `graphql-tag`, `lodash`, `p-retry`

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
- **Schema:** Drizzle `sqliteTable()` in `src/shared/node/db/schema.ts`
- **IDs:** Text, generated via `generateId()` from `@webiny/stdlib`
- **Timestamps:** Integer columns, Unix epoch milliseconds
- **JSON storage:** Serialized in `text` columns
- **Migrations:** `drizzle-kit generate` → SQL files in `src/shared/node/db/migrations/`
- **Default path:** `.webiny/data-mock.db`
- **Startup:** `createDatabaseClient(path)` → `runMigrations(db)` → seed defaults → register in container

---

## Agents

| Agent | Layer | Responsibility |
|---|---|---|
| `api-developer` | `src/api/`, `src/shared/`, `src/shared/node/` (db, graphql, generators, cache, fields) | Backend: API routes, SQLite, GraphQL client, generator system |
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

### Phase 1: Foundation — done
1. Added new dependencies (`@webiny/di`, `@webiny/stdlib`, `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `zod`)
2. Created `src/shared/node/db/` — schema, client, migrations, DatabaseClient abstraction
3. Created `src/shared/` — types, errors, shared abstractions (platform-agnostic)
4. Created root feature composition (`AppFeature` in `src/shared/node/feature.ts`)

### Phase 2: Extract Core Services — done
1. Extracted `GraphQLApplication` → `src/shared/node/graphql/` with abstraction + DI
2. Ported generators to `src/shared/node/generators/` — wired registry through DI (not a global singleton)
3. Ported cache system — `src/shared/node/cache/` (FileCache) + `src/shared/MemoryCache.ts`, registered via DI
4. Replaced the `logger` singleton with the `Logger` abstraction from `@webiny/stdlib`
   (`PinoLoggerFeature`, registered in `AppFeature`, injected as a constructor dependency)
5. Ported GraphQL field-selection builders → `src/shared/node/fields/`
6. Ported the generator-registry → CMS-entry bridge → `src/shared/node/generators/createEntryVariables.ts`
7. Deleted all legacy code (`src/apps/`, `src/base/`, `src/errors/`, `src/types.ts`, `src/index.ts`,
   `src/logger.ts`, `index.js`) — the hardcoded demo model/group/entry definitions in
   `src/apps/cms/` were **not** ported; they're superseded by the (not yet built) dynamic
   model-fetching feature described in the Vision section

### Phase 3: CLI Refactor — mostly done
1. Created `src/cli/` with proper command structure
2. Added commands: `add-project`, `list-projects`, `remove-project` — each resolves the
   corresponding use case from `src/shared/node/features/projects/` (never the repository
   directly)
3. Wired all through the DI container
4. Not yet done: `seed-entries` / `fetch-entries` commands (depend on the not-yet-wired
   GraphQL + Generator features and the not-yet-built model-fetching feature)

### Phase 4: API Layer — projects CRUD done
1. Created `src/api/` — local server for UI backend
2. Project CRUD routes (`src/api/routes/projects/`) — thin handlers resolving use cases from
   `src/shared/node/features/projects/`
3. Not yet done: model listing (proxy to Webiny CMS), seeding job trigger/status routes

### Phase 5: UI — projects CRUD done
1. Created `src/ui/` with React + DI
2. Project management pages (list, add)
3. Not yet done: model selection + seeding configuration, seeding dashboard
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
yarn typecheck     # tsc --noEmit
yarn test          # vitest run
```

**Before every commit:** `yarn lint && yarn format:check && yarn typecheck && yarn test`

---

## Research Documents

- `documentation/research/01-current-architecture.md` — full analysis of current codebase
- `documentation/research/02-sqlite-patterns-reference.md` — SQLite patterns from dependency-upgrader
- `documentation/research/03-webiny-di-and-stdlib.md` — @webiny/di and @webiny/stdlib API reference
- `documentation/research/04-skills-inventory.md` — skills copied and adaptations made
- `documentation/research/05-agents-inventory.md` — agents copied and adaptations made
