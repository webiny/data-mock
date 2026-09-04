# AGENTS.md — webiny-mock-data

Single source of truth. Every agent and skill references this file.

## Overview

A multi-project tool for generating and seeding mock data into Webiny CMS projects. Manages project connections (encrypted), syncs models/groups/tenants from live Webiny instances, generates realistic fake data respecting CMS field validation rules, and sends entries via GraphQL. Includes a CLI, REST API (Fastify), and web UI (React + Mantine).

---

## Quick Start

```bash
yarn install
yarn cli init            # generate .env (encryption key + ports)
yarn cli add-project     # add a Webiny project connection
yarn cli sync-models     # pull models from Webiny
yarn cli seed            # generate + send mock data
yarn dev                 # start API (port 4000) + UI (port 4001)
```

---

## Directory Structure

```
src/
├── shared/                              # Platform-agnostic (CLI, API, UI can all import)
│   ├── types.ts                         # Domain types (Project, SeedJob, ProjectModel, etc.)
│   ├── errors.ts                        # BaseError subclasses with statusCode
│   ├── abstractions/
│   │   └── HttpClient.ts               # HTTP client interface
│   ├── responses/                       # Zod response schemas (projects, tenants, models, seeding, entries, files, templates)
│   ├── routes/                          # Typed route definitions (shared by API + UI)
│   └── routing/                         # defineRoute, defineTypedRoutes, interpolatePath
│
│   └── node/                            # Node.js only — shared by CLI + API. UI must NEVER import.
│       ├── feature.ts                   # AppFeature — root bootstrap
│       ├── FetchHttpClient.ts           # fetch()-based HttpClient
│       ├── db/                          # SQLite (better-sqlite3 + drizzle-orm)
│       │   ├── schema.ts               # 8 tables
│       │   ├── client.ts               # createDatabaseClient()
│       │   ├── migrate.ts              # runMigrations()
│       │   └── migrations/             # SQL migrations (drizzle-kit)
│       ├── cache/                       # FileCache + MemoryCache + CacheKey
│       ├── encryption/                  # AES-256-GCM EncryptionService + KeyRotationService
│       ├── graphql/                     # GraphQLClient (retry, batching)
│       │   ├── endpoints/              # DI endpoint clients (CmsManage, CmsRead, CmsPreview, GraphQL)
│       │   └── operations/             # Operation registry + parseOperationResponse + defineOperation
│       │       └── base/               # All operations (strict Zod schemas, Zod-inferred types)
│       ├── generators/                  # 11 field generators + 5 validators + DI registry
│       │   ├── fields/                 # Text, Number, Boolean, DateTime, LongText, Json, File, RichText, Ref, Object, DynamicZone
│       │   ├── validators/             # MinLength, MaxLength, Pattern, DateGte, DateLte
│       │   └── createEntryVariables.ts # Generator→entry bridge
│       ├── fields/                      # GraphQL field-selection builders (per CMS field type)
│       ├── testing/
│       │   └── createTestContainer.ts  # Fully-wired DI container for tests
│       └── features/
│           ├── projects/               # CRUD (create/get/list/remove — 1 use case + 1 repo each)
│           ├── tenants/                # Sync + list + verify access
│           ├── models/                 # Sync + list + get + push + compare
│           ├── seeding/                # Seed service + job CRUD + entry audit log + dependency resolver
│           ├── templates/              # Seed template CRUD
│           └── files/                  # File upload + list + delete
│
├── cli/                                 # CLI layer (@clack/prompts)
│   ├── entry.ts                        # Bootstrap + command dispatch
│   ├── feature.ts                      # CliFeature
│   ├── abstractions/                   # Prompts, UI, Command
│   └── commands/                       # 9 commands (see below)
│
├── api/                                 # Fastify API server (localhost:4000)
│   ├── entry.ts                        # Bootstrap + listen
│   ├── server.ts                       # createServer()
│   ├── feature.ts                      # ApiFeature
│   ├── routing/                        # routeFactory, sendTyped, sendError, createRequestContext
│   └── routes/                         # 21 route handlers (see below)
│
└── ui/                                  # React + Mantine + MobX (port 4001)
    ├── App.tsx, main.tsx               # Entry + DI container setup
    ├── di/                             # DiContainerProvider, useFeature, createFeature
    ├── features/
    │   ├── router/                     # Route registry, RouterView, defineRoute, navigate()
    │   ├── notifications/              # Mantine notifications service
    │   ├── projects/                   # Gateway + Repository
    │   ├── tenants/                    # Gateway + Repository
    │   ├── models/                     # Gateway + Repository
    │   ├── seeding/                    # Gateway + Repository
    │   ├── jobs/                       # Gateway + Repository (MobX-observable)
    │   └── templates/                  # Gateway + Repository
    ├── infrastructure/httpClient/      # FetchHTTPClient for browser
    ├── presentation/
    │   ├── Projects/
    │   │   ├── ProjectList/            # List page + use cases (load, delete, sync tenants/models)
    │   │   ├── ProjectDetail/          # Detail page (sidebar: tenants, models, history, templates)
    │   │   └── AddProject/             # Modal form + use case
    │   └── Seeding/
    │       ├── SeedConfig/             # Seed configuration page
    │       └── SeedHistory/            # Seed history page
    ├── components/                     # AppLayout
    └── theme/                          # Mantine theme tokens
```

---

## Database Schema (10 tables)

| Table | Key columns | Purpose |
|---|---|---|
| `projects` | id, name, api_url, api_token (encrypted), tenant, webiny_version | Project connections |
| `project_tenants` | project_id FK, tenant_id, name | Discovered tenants per project |
| `project_groups` | project_id FK, slug, name, remote_id | CMS content model groups |
| `project_models` | project_id FK, model_id, singular_api_name, plural_api_name, group_slug, plugin, fields (JSON) | CMS models + field definitions + API names + plugin flag from Webiny |
| `jobs` | project_id FK, type, status, config (JSON), logs, progress, progress_label, parent_job_id | Background job execution (seed, sync-tenants, sync-models, cleanup, import) |
| `seed_jobs` | project_id FK, status, config (JSON), result (JSON) | Legacy seeding job tracking |
| `seed_templates` | project_id FK, name, config (JSON) | Saved seed configurations |
| `seed_entries` | job_id FK (nullable), project_id FK, tenant, model_id, entry_data (JSON), request_data (JSON), response_data (raw), status | Per-entry audit log with full request/response |
| `project_files` | project_id FK, tenant, file_key, file_url, file_type | Uploaded file references |
| `sync_logs` | project_id FK, type, status, message, request (JSON), response (JSON) | Sync operation logs with GraphQL request + response stored separately |

---

## CLI Commands (9)

| Command | Description |
|---|---|
| `yarn cli init` | Generate .env with encryption key + port config |
| `yarn cli add-project` | Add a Webiny project (prompts for name, URL, token, version, tenant) |
| `yarn cli list-projects` | Show all configured projects |
| `yarn cli remove-project` | Select + confirm + remove a project |
| `yarn cli sync-models` | Pull models/groups from a Webiny project into local DB |
| `yarn cli seed` | Generate + send mock entries (select project → tenants → models → amounts) |
| `yarn cli rotate-key` | Rotate the API token encryption key |
| `yarn cli upload-files` | Upload files to a Webiny project's file manager |

---

## API Routes (34)

All long-running operations (seed, sync-tenants, sync-models, import, cleanup) return a `Job` object with HTTP 202 — work runs in the background. Progress is pushed via WebSocket.

### Projects
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project (Zod-validated) |
| GET | `/api/projects/:id` | Get project by ID |
| PUT | `/api/projects/:id` | Update project (partial, at least one field) |
| DELETE | `/api/projects/:id` | Remove project |
| POST | `/api/projects/:id/health` | Check if project's Webiny API is reachable |

### Tenants
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/tenants` | List project tenants |
| POST | `/api/projects/:projectId/tenants/sync` | Sync tenants from Webiny (logs to sync_logs) |

### Models
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/models` | List local models |
| POST | `/api/projects/:projectId/models/sync` | Pull models from Webiny (logs to sync_logs) |

### Seeding
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/projects/:projectId/seed` | Trigger seeding (revisions, publish strategy, dry-run) |
| GET | `/api/projects/:projectId/seed-jobs` | Seed job history |
| POST | `/api/projects/:projectId/import` | Import existing entries from Webiny |
| POST | `/api/projects/:projectId/cleanup` | Delete seeded entries from Webiny (optional jobId filter) |

### Seed Entries (Audit Log)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/entries` | List seeded entries (paginated, filterable) |
| GET | `/api/projects/:projectId/entries/:entryId` | Get single entry |
| DELETE | `/api/projects/:projectId/entries` | Clear audit log |

### Templates
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/templates` | List seed templates |
| POST | `/api/projects/:projectId/templates` | Save template |
| DELETE | `/api/projects/:projectId/templates/:templateId` | Delete template |

### Files
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/files` | List uploaded files |
| POST | `/api/projects/:projectId/files/upload` | Upload a file |
| DELETE | `/api/projects/:projectId/files/:fileId` | Delete file reference |
| POST | `/api/projects/:projectId/files/sync` | Sync files from a project's file manager |
| POST | `/api/projects/:projectId/files/upload-global` | Upload all unlinked global pool images to a project's file manager |
| POST | `/api/files/picsum/pull` | Pull placeholder images from picsum.photos into the local image pool |
| GET | `/api/files/local` | List local files in `.webiny/images/` with per-project upload status |
| POST | `/api/files/local/upload` | Save a dropped file to `.webiny/images/` |
| DELETE | `/api/files/local/:fileName` | Delete a file from `.webiny/images/` |
| GET | `/api/files/local/:fileName/content` | Serve raw file bytes for thumbnail display (raw Fastify route, not typed) |

### Jobs
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/projects/:projectId/jobs` | Enqueue a new job (type + config) |
| GET | `/api/projects/:projectId/jobs` | List jobs for a project |
| GET | `/api/projects/:projectId/jobs/:jobId` | Get a single job |
| POST | `/api/projects/:projectId/jobs/:jobId/cancel` | Cancel a running or pending job |

### WebSocket
| Protocol | Path | Purpose |
|---|---|---|
| WS | `/ws` | Real-time job status, progress, and log events |

### Sync Logs
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/sync-logs` | List sync operation logs |
| DELETE | `/api/projects/:projectId/sync-logs/:logId` | Delete a sync log entry |

---

## UI Routes

| URL | Page | Layout |
|---|---|---|
| `/` | Project list | Contained |
| `/projects/:projectId/*` | Project detail shell (sidebar + content) | Full width |

The project detail route uses a `/*` wildcard — `subPath` determines the active view:

| Sub-path | View |
|---|---|
| (empty) / `tenants` | Tenants tab |
| `models` | Models & Groups tab |
| `files` | Files tab |
| `entries` | Audit Log tab |
| `history` | Seed History tab |
| `templates` | Templates tab |
| `sync-tenants` | Sync Tenants (log table + run button) |
| `sync-models` | Sync Models (log table + run button) |
| `seed` | Seed Config (embedded, group accordion) |
| `import` | Import Entries |
| `jobs` | Background Jobs |

URL is the source of truth for tab selection — no presenter state for active tab.

Sidebar sections: **Data** (7 tabs), **Sync** (2 tabs), **Actions** (Seed Data, Import, Cleanup, Edit Project).

---

## Technology Stack

| Concern | Package | Version |
|---|---|---|
| DI container | `@webiny/di` | ^1.0.2 |
| Stdlib | `@webiny/stdlib` | ^0.0.17 |
| SQLite | `better-sqlite3` | ^13.0.3 |
| Query builder | `drizzle-orm` | ^0.45.2 |
| Migrations | `drizzle-kit` | ^0.31.10 |
| Fake data | `@faker-js/faker` | ^10.6.0 |
| HTTP retry | `p-retry` | ^8.0.0 |
| CLI prompts | `@clack/prompts` | ^1.7.0 |
| UI framework | `react` + `@mantine/core` | ^19.2.8 + ^9.5.2 |
| UI state | `mobx` + `mobx-react-lite` | ^7.0.3 + ^5.0.3 |
| Notifications | `@mantine/notifications` | ^9.5.2 |
| API server | `fastify` | ^5.12.1 |
| Validation | `zod` | ^4.5.4 |
| Code viewer | `@monaco-editor/react` | ^4.7.0 |
| Testing | `vitest` | ^4.1.11 |
| Coverage | `@vitest/coverage-v8` | latest |
| Linting | `oxlint` | ^1.80.0 |
| Formatting | `oxfmt` | ^0.65.0 |
| Dep checker | `adio` | ^3.0.1 |
| TypeScript | `typescript` | 7.0.2 |
| Dev runner | `concurrently` | ^10.0.5 |
| UI bundler | `vite` + `@vitejs/plugin-react` | ^8.2.2 + ^6.1.1 |
| Package manager | `yarn` | 4.18.0 |

---

## DI Conventions

### Abstraction (one per file, in `abstractions/` directory)
```ts
import { createAbstraction } from "@webiny/stdlib";

interface IListProjectsRepository {
  execute(input: ListProjectsRepository.Input): Promise<Result<ListProjectsRepository.Output, ListProjectsRepository.Error>>;
}

export const ListProjectsRepository = createAbstraction<IListProjectsRepository>("Projects/ListProjectsRepository");

export namespace ListProjectsRepository {
  export type Interface = IListProjectsRepository;
  export type Input = { /* ... */ };
  export type Output = { projects: Project[] };
  export type Error = ProjectPersistenceError;
}
```

### Implementation (separate file, same directory as feature — NOT in `abstractions/`)
```ts
import { ListProjectsRepository as Abstraction } from "./abstractions/ListProjectsRepository.js";

class ListProjectsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}
  public async execute(input: Abstraction.Input): Promise<Result<Abstraction.Output, Abstraction.Error>> { /* ... */ }
}

export const ListProjectsRepository = Abstraction.createImplementation({
  implementation: ListProjectsRepositoryImpl,
  dependencies: [DatabaseClient],
});
```

### Feature (registers implementations into DI container)
```ts
export const ProjectsFeature = createFeature({
  name: "Projects/ProjectsFeature",
  register(container) {
    container.register(ListProjectsRepository).inSingletonScope();
    container.register(CreateProjectRepository).inSingletonScope();
    // ...
  },
});
```

### Import convention
- Abstraction imported as `Abstraction`: `import { Xxx as Abstraction } from "./abstractions/Xxx.js"`
- Implementation imported unaliased: `import { Xxx } from "./Xxx.js"`

---

## Seeding Behavior

- **Ref field shape**: `{ modelId, id }` only — never send `entryId` in mutation input variables
- **Dependency ordering**: models are topologically sorted by ref dependencies before seeding — referenced models seed first
- **Available refs**: before seeding, all existing entries (both `created` and `imported`) are preloaded into the `availableRefs` map so ref generators can pick from them
- **Batch size**: configurable (1–50 concurrent mutations per batch), set on the confirmation dialog
- **Fail fast**: seeding stops for a model on first error
- **Retry**: HTTP 429 (rate limit) retries up to 3 times with exponential backoff
- **Confirmation dialog**: shows tenant, model count, entries per model, revisions, batch size (editable), publish strategy, publish percent, and include-unpublish-cycles before confirming

---

## Key Rules

1. **Single responsibility** — one `execute()` per use case and repository. No multi-method classes.
2. **Folder boundaries** — `src/shared/` is platform-agnostic. `src/shared/node/` is CLI+API only. UI must NEVER import from `src/shared/node/`, `src/api/`, or `src/cli/`.
3. **Abstractions separate from implementations** — always in `abstractions/` subdirectory, separate file.
4. **Never export Impl classes** — only the `createImplementation` result is exported.
5. **Result pattern** — all operations return `Result<T, E>`, never throw for expected failures.
6. **Errors extend BaseError** — with namespaced `code` and `statusCode`.
7. **All user input validated with Zod** — at every boundary (CLI, API, UI, repository).
8. **No `as` casts** — fix types at source. Only acceptable at JSON parse boundaries.
9. **Thin routes** — resolve use case, call execute, send result. No business logic.
10. **Routes as DI instances** — features register their own routes. No centralized if/switch.
11. **`registerInstance` only for pre-built infrastructure** — DatabaseClient, GraphQLConfig, EncryptionKey, BaseUrl. Everything else via `createImplementation`.
12. **Constructor deps are `private readonly`** with explicit access modifiers on all methods.

### Scoping
| Type | Scope |
|---|---|
| UseCase | Transient (default) |
| Repository / Service / Gateway | `.inSingletonScope()` |
| Presenter | Transient |
| Command (CLI) | `.inSingletonScope()` |

---

## Tooling

| Script | Command | Purpose |
|---|---|---|
| `yarn cli` | `tsx src/cli/entry.ts` | CLI tool |
| `yarn api:dev` | `tsx --watch src/api/entry.ts` | API server (port 4000) |
| `yarn ui:dev` | `vite dev` | UI dev server (port 4001) |
| `yarn dev` | `concurrently` | API + UI together |
| `yarn build:ui` | `vite build` | Production UI build |
| `yarn typecheck` | `tsc --noEmit` | Type checking |
| `yarn test` | `vitest run` | Run tests |
| `yarn test:watch` | `vitest` | Watch mode |
| `yarn lint` | `oxlint --deny-warnings src/` | Lint check |
| `yarn lint:fix` | `oxlint --fix` | Lint auto-fix |
| `yarn format:check` | `oxfmt --check src/` | Format check |
| `yarn format:fix` | `oxfmt src/` | Format fix |
| `yarn db:generate` | `drizzle-kit generate` | Generate migration |
| `yarn db:migrate` | `drizzle-kit migrate` | Run migrations |
| `yarn deps:check` | `adio` | Check unused/missing deps |

**Before every commit:** `yarn lint && yarn format:check && yarn typecheck && yarn test`

---

## Agents

| Agent | Model | Scope |
|---|---|---|
| `api-developer` | sonnet | `src/api/`, `src/shared/`, `src/shared/node/` |
| `ui-developer` | sonnet | `src/ui/` |
| `ui-designer` | sonnet | `src/ui/theme/`, `src/ui/components/`, `*.tsx` visual only |

## Skills

| Skill | When to use |
|---|---|
| `project-architecture` | Before writing any feature code |
| `dependency-injection` | Before writing any DI-related code |
| `cli-developer` | Before writing CLI commands |
| `api-developer` | Before writing API routes |
| `ui-developer` | Before writing UI features |
| `ui-design` | Before visual/style changes |
| `handoff` | End of session |
| `review-fix-loop` | Iterative review + fix cycles |

---

## Testing

- **275 tests** across 24 files (vitest)
- **Coverage**: v8 provider, ~53% statements, ~37% branches, ~56% functions. Thresholds enforced via `vitest.config.ts`.
- **Coverage excludes**: abstractions, feature.ts, index.ts, types, schemas, UI, routing — only business logic is measured.
- **`createTestContainer()`** — fully-wired DI container for tests. In-memory SQLite (`:memory:`), real generators, real cache. Mock only HttpClient.
- Pass `{ httpClient: mockHttpClient }` to override HTTP. Everything else is production code.
- API integration tests use `app.inject()` (Fastify's built-in).
- Run with coverage: `yarn test --coverage`

---

## Architecture Decision Records (19)

| # | Title | Status |
|---|---|---|
| 001 | Technology Stack | Accepted |
| 002 | Runtime Data Directory (.webiny/) | Accepted |
| 003 | Single Central Database | Accepted |
| 004 | DI Package (@webiny/di) | Accepted |
| 005 | MobX for UI State | Accepted |
| 006 | No Auth, Localhost Only | Accepted |
| 007 | Single Package with Path Aliases | Accepted |
| 008 | Clean Break Migration | Accepted |
| 009 | Dev Serving Pattern | Accepted |
| 010 | Generators Reuse + DI Rewrite | Accepted |
| 011 | Thin Routes | Accepted |
| 012 | Test Container Pattern | Accepted |
| 013 | API Token Encryption (AES-256-GCM) | Implemented |
| 014 | Multi-Tenant Discovery | Implemented |
| 015 | Versioned API Operations | Implemented |
| 016 | Model & Group Sync | Implemented |
| 017 | Project Detail Page | Implemented |
| 018 | File Uploads | Implemented |
| 019 | Seed Data Audit Log | Implemented |

---

## Runtime Data

All runtime data in `.webiny/` (gitignored):
```
.webiny/
├── data-mock.db    # SQLite database
├── cache/          # File cache
└── logs/           # Log files
```

Default DB path: `.webiny/data-mock.db`. Override via `DB_PATH` in `.env`.

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ENCRYPTION_KEY` | Yes (except for `init`) | — | 64-char hex string for AES-256-GCM |
| `API_PORT` | No | 4000 | Fastify server port |
| `UI_PORT` | No | 4001 | Vite dev server port |
| `DB_PATH` | No | .webiny/data-mock.db | SQLite database path |
