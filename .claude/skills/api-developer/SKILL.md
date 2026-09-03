---
name: api-developer
description: >
  Use when building the local API/server layer that serves the UI. Handles project CRUD,
  seed job orchestration, and proxies to Webiny CMS GraphQL. Uses DI patterns from project-architecture.
  Invoke BEFORE writing any server/API code.
---

# API Developer Guide

API lives in `src/api/`. Serves the local UI — manages Webiny project configs (SQLite), orchestrates data seeding jobs, and proxies GraphQL calls to Webiny CMS instances. All logic in use cases, all persistence in repositories.

## Architecture

```
Route (thin) → UseCase (logic) → Repository (persistence) → SQLite / Webiny GraphQL
                                       ↑
                              GraphQLService (Webiny CMS client)
```

- **Route handler**: thin dispatcher. Receives request, resolves use case from container, calls execute, sends result.
- **UseCase**: single `execute()` method. Orchestrates repositories and services. Returns `Result<T, E>`. Transient scope.
- **Repository**: data access (SQLite for project configs, seed history). Singleton scope. Returns `Result<T, E>`.
- **GraphQLService**: wraps Webiny CMS GraphQL API calls. Singleton scope. Handles auth tokens per-project.
- **GeneratorService**: orchestrates field value generation using the generator registry.

## Directory Structure

```
src/api/
├── server.ts                     # HTTP server setup
├── routes.ts                     # Route registration
├── feature.ts                    # Root ApiFeature
├── features/
│   └── {domain}/                 # e.g. projects, seeding, models
│       ├── {operation}/          # e.g. list, create, seed
│       │   ├── abstractions/
│       │   │   ├── {Name}UseCase.ts
│       │   │   └── {Name}Repository.ts
│       │   └── {Name}UseCase.ts
│       ├── abstractions/
│       │   └── index.ts
│       ├── errors.ts
│       ├── routes.ts
│       └── feature.ts

src/shared/
├── db/
│   └── schema.ts                 # SQLite table schemas
├── errors.ts
└── types.ts
```

## Key Domains

### Projects
- CRUD for Webiny project configurations (name, API URL, auth token, tenant ID)
- Stored in SQLite via `ProjectRepository`
- Replaces the current `.env`-based configuration

### Seeding
- Orchestrates creating mock entries in a Webiny CMS instance
- User selects: project → models → entry count per model
- Uses `GeneratorRegistry` to create field-appropriate fake data
- Tracks seed history (what was seeded, when, how many)

### Models
- Fetches available CMS models from a Webiny project via GraphQL
- Caches model definitions locally for offline field introspection

## GraphQL Service

Wraps the existing GraphQL application logic. Per-project auth.

```ts
// abstractions/GraphQLService.ts
export interface IGraphQLService {
  listModels(project: Project): Promise<Result<Model[], GraphQLService.Error>>;
  createEntry(project: Project, modelId: string, data: Record<string, unknown>): Promise<Result<Entry, GraphQLService.Error>>;
  listEntries(project: Project, modelId: string): Promise<Result<Entry[], GraphQLService.Error>>;
}
```

## SQLite Database

Project configs and seed history stored in SQLite (replaces .env).

```ts
// Tables: projects, seed_runs, seed_run_entries
const project = {
  id: "uuid",
  name: "My Webiny Project",
  apiUrl: "https://xxx.cloudfront.net/cms/manage/en-US",
  token: "pat_xxx",
  tenantId: "root",
  createdAt: "2024-01-01T00:00:00Z",
};
```

## Commands

- `yarn dev` — start API + UI with file watching
- `yarn lint` — oxlint (src/)
- `yarn format:check` — oxfmt (src/)
- `yarn compile` — TypeScript strict mode

## Key Rules

- ALL input validated via Zod
- Routes are thin — resolve use case, call execute, send result
- Use cases return `Result<T, E>` — never throw for expected failures
- API errors extend `BaseError`
- One use case per operation, one repository per operation — single `execute()` method each
- No multi-method repositories — split into ListXxxRepository, CreateXxxRepository, etc.
- Use cases are transient, repositories and services are singleton
- Child container per request — no singleton spill between requests
