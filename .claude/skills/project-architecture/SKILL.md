---
name: project-architecture
description: >
  Shared architecture across CLI and UI layers. DI patterns (createAbstraction, createFeature, Result, BaseError),
  file separation, feature structure, naming, scoping. Invoke BEFORE writing any feature code in any layer.
---

# Project Architecture — Clean DI with @webiny/stdlib

All layers (CLI, UI) share the same DI architecture. Commands and components are thin — business logic lives in use cases, persistence in repositories, external calls in gateways/services.

## Project Layout

```
src/
  shared/     — TypeScript code shared between CLI and UI (types, errors, domain models, utilities)
  cli/        — CLI commands (yargs-based)
  ui/         — Web UI for project management and data seeding
  db/         — SQLite database layer (project configs, seed history)
  generators/ — Field value generators (ported from apps/tenants/helpers/generators)
  graphql/    — Webiny CMS GraphQL client (ported from apps/GraphQLApplication)
```

`src/shared/` holds everything reusable across layers: domain types, BaseError subclasses, Zod schemas, utility functions, shared abstractions. CLI-only abstractions stay in `src/cli/`. UI-only abstractions (gateways, presenters) stay in `src/ui/`.

## Imports

```ts
// DI container
import { Container } from "@webiny/di";

// Abstractions, features, error handling
import { createAbstraction, createFeature, Result, BaseError } from "@webiny/stdlib";

// Filesystem (Node.js only — CLI and server)
import { FileTool, DirectoryTool, JsonFileTool } from "@webiny/stdlib/node";

// Validation
import { z } from "zod";
```

## Iron Rule

**Abstractions and implementations live in separate files, in separate directories.**

| Concern | File | Directory |
|---------|------|-----------|
| Abstraction (interface + token + namespace) | `abstractions/Xxx.ts` | `abstractions/` |
| Implementation (class + createImplementation) | `Xxx.ts` | feature root |
| Feature registration | `feature.ts` | feature root |
| Barrel export | `index.ts` | feature root + `abstractions/` |

A file with `createAbstraction()` must not contain `createImplementation()` or `createFeature()`.

## Feature Structure

Every feature follows this layout, in every layer:

```
features/{featureName}/
├── abstractions/
│   ├── XxxUseCase.ts       # createAbstraction + interface + namespace
│   ├── XxxRepository.ts    # createAbstraction + interface + namespace
│   └── index.ts            # barrel — exports ONLY abstraction tokens
├── __tests__/
│   └── XxxUseCase.test.ts
├── XxxUseCase.ts           # createImplementation (SEPARATE file)
├── XxxRepository.ts        # createImplementation (SEPARATE file)
├── errors.ts               # BaseError subclasses
├── feature.ts              # createFeature
└── index.ts                # barrel — exports abstractions + feature
```

## Abstraction Pattern

One abstraction per file. Interface is `export interface`. All types accessed via namespace only.

```ts
// abstractions/ProjectRepository.ts
import { createAbstraction } from "@webiny/stdlib";

export interface IProject {
  id: string;
  name: string;
  apiUrl: string;
  token: string;
}

export interface IProjectRepository {
  findById(id: string): Promise<Result<IProject, ProjectRepository.Error>>;
  create(data: ProjectRepository.CreateInput): Promise<Result<IProject, ProjectRepository.Error>>;
}

export const ProjectRepository = createAbstraction<IProjectRepository>("Feature/ProjectRepository");

export namespace ProjectRepository {
  export type Interface = IProjectRepository;
  export type Record = IProject;
  export type CreateInput = { name: string; apiUrl: string; token: string };
  export type Error = import("../errors.ts").ProjectNotFoundError | import("../errors.ts").ProjectPersistenceError;
}
```

Barrel (`abstractions/index.ts`) exports only tokens:

```ts
export { ProjectRepository } from "./ProjectRepository.ts";
export { CreateProjectUseCase } from "./CreateProjectUseCase.ts";
```

## Implementation Pattern

Separate file at feature root. Import alias avoids name clash. Class gets `Impl` suffix, exported const does NOT.

```ts
// CreateProjectUseCase.ts
import { Result } from "@webiny/stdlib";
import { CreateProjectUseCase as Abstraction } from "./abstractions/CreateProjectUseCase.ts";
import { ProjectRepository } from "./abstractions/ProjectRepository.ts";

class CreateProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly projectRepository: ProjectRepository.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const result = await this.projectRepository.create(input);
    if (result.isFail()) {
      return Result.fail(result.error);
    }
    return Result.ok(result.value);
  }
}

export const CreateProjectUseCase = Abstraction.createImplementation({
  implementation: CreateProjectUseCaseImpl,
  dependencies: [ProjectRepository],
});
```

## Feature Registration

Use `createFeature` from `@webiny/stdlib`. It adds idempotency — safe to call `register()` multiple times.

```ts
// feature.ts
import { createFeature } from "@webiny/stdlib";
import { CreateProjectUseCase } from "./CreateProjectUseCase.ts";
import { ProjectRepository } from "./ProjectRepository.ts";

export const ProjectsFeature = createFeature({
  name: "Projects/ProjectsFeature",
  register(container) {
    container.register(ProjectRepository).inSingletonScope();
    container.register(CreateProjectUseCase); // transient (default)
  },
});
```

Features compose — a parent feature registers child features:

```ts
register(container) {
  ProjectsFeature.register(container);
  SeedingFeature.register(container);
}
```

## Result Pattern

All operations that can fail return `Result<T, E>`. Never throw for expected failures.

```ts
import { Result, BaseError } from "@webiny/stdlib";

// Success
return Result.ok(value);

// Failure
return Result.fail(new ProjectNotFoundError(id));

// Check result
const result = await repository.findById(id);
if (result.isFail()) {
  return Result.fail(result.error);
}
const project = result.value;
```

## Error Handling

Domain-specific errors extend `BaseError`:

```ts
// errors.ts
import { BaseError } from "@webiny/stdlib";

export class ProjectNotFoundError extends BaseError {
  override readonly code = "Project/NotFound" as const;

  constructor(id: string) {
    super({ message: `Project "${id}" not found` });
  }
}

export class SeedingError extends BaseError<{ error: Error }> {
  override readonly code = "Seeding/Failed" as const;

  constructor(error: Error) {
    super({ message: error.message, data: { error } });
  }
}
```

Rules:
- `override readonly code` with namespaced string and `as const`
- Wrap infrastructure errors in domain errors
- Never use generic `Error` for domain failures

## Naming Conventions

| Artifact | Pattern | Example |
|----------|---------|---------|
| Feature directory | `{businessCapability}` (camelCase) | `createProject`, `seedEntries` |
| UseCase | `{Action}{Entity}UseCase` | `CreateProjectUseCase` |
| Service | `{Domain}Service` | `GraphQLService` |
| Repository | `{Action}{Entity}Repository` | `ListProjectsRepository` |
| Gateway | `{Feature}Gateway` | `ProjectsGateway` |
| Presenter | `{Page}Presenter` | `ProjectListPresenter` |
| Error | `{Entity}{Problem}Error` | `ProjectNotFoundError` |
| Feature | `{Name}Feature` | `ProjectsFeature` |
| Implementation class | `{Name}Impl` (class only, NOT exported) | `ProjectRepositoryImpl` |
| Implementation file | Same as abstraction file (NO `Impl`/`Implementation` suffix) | `ProjectRepository.ts` |
| Exported const | Same as abstraction name (NO suffix) | `ProjectRepository` |

## Scoping Rules

| Layer | Scope | Rationale |
|-------|-------|-----------|
| UseCase | Transient (default) | Fresh per invocation |
| Service | `.inSingletonScope()` | Stateful or expensive |
| Repository | `.inSingletonScope()` | One instance, holds state |
| Gateway | `.inSingletonScope()` | Stateless but expensive |
| Presenter | Transient (default) | Fresh per component |
| Command | `.inSingletonScope()` | One per CLI invocation |

## Single Responsibility

- Every use case has one `execute()` method — one operation per class
- Every repository has one `execute()` method — one operation per class
- No multi-method repositories or use cases — split by operation (ListXxx, CreateXxx, RemoveXxx)
- Services may have multiple methods when they represent a single external concern (e.g., GraphQLClient)

## Code Style

- One class per file, one abstraction per file
- No complex single-line ternaries — break into multi-line if/else
- No inline type assertions or annotations in expressions
- Use static `create()` methods or factories — avoid bare `new`
- Abstraction files export ONLY the abstraction
- Constructor deps are `private readonly` with full names
- All class methods have explicit access modifiers (`public`, `private`)

## Validation

All user input validated with Zod. No `!` guards for validation.

```ts
const result = schema.safeParse(input);
if (!result.success) {
  return Result.fail(new ValidationError(result.error.issues[0]?.message ?? "Invalid input"));
}
const validated = result.data;
```

Internal code that receives already-validated data does not need re-validation.

## Barrel Exports

Export abstractions and features. Never export implementations.

Implementation classes (`*Impl`) are private to their module — never add `export` to the class declaration. Consumers get implementations through the DI container, not by instantiating classes directly.

```ts
// index.ts
export { CreateProjectUseCase } from "./abstractions/index.ts";
export { ProjectsFeature } from "./feature.ts";
```

## Layer-Specific Skills

- **cli-developer** — CLI commands, services, prompts
- **ui-developer** — gateways, repositories, presenters, React components
- **ui-design** — visual layer, theme, component styling
