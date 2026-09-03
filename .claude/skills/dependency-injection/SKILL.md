---
name: dependency-injection
description: Use when creating abstractions, implementations, features, repositories, use cases, or any DI-wired service. Defines mandatory file separation — abstractions, implementations, null objects, and features MUST each be in their own file. Invoke BEFORE writing any DI-related code.
---

# Dependency Injection — @webiny/di Conventions

Every service lives behind an abstraction token. Implementations are classes bound to an abstraction. Consumers resolve the abstraction, never the implementation. Each concern gets its own file.

## The Iron Rule

**Every DI concern lives in its own file. No exceptions.**

| Concern                                       | File                            | Directory                             |
| --------------------------------------------- | ------------------------------- | ------------------------------------- |
| Abstraction (interface + token + namespace)   | `abstractions/XxxRepository.ts` | `abstractions/`                       |
| Implementation (class + createImplementation) | `XxxRepository.ts`              | feature root                          |
| Null/default implementation                   | `NullXxxContext.ts`             | alongside abstraction or feature root |
| Feature (createFeature + registrations)       | `feature.ts` or `XxxFeature.ts` | feature root                          |

Never combine these in one file. A file with `createAbstraction()` must not contain `createImplementation()`, a class, or `createFeature()`.

## Naming Conventions

### Class Names vs Export Names

The `Impl` suffix exists **only on the class declaration**, never on anything exported or imported.

```ts
// INSIDE the implementation file:
class ProjectRepositoryImpl implements Abstraction.Interface { ... }  // Impl on class — OK

export const ProjectRepository = Abstraction.createImplementation({   // NO Impl on const
    implementation: ProjectRepositoryImpl,
    dependencies: [DatabaseClient]
});
```

When the same short name (`ProjectRepository`) is used by both the abstraction token and the implementation const, they live in different files — the import path distinguishes them. The `as Abstraction` alias inside the implementation file resolves the local clash:

```ts
import { ProjectRepository as Abstraction } from "./abstractions/ProjectRepository.js";
```

### General Naming Rules

- Never abbreviate: `projectRepository` not `projRepo`, `authorizationService` not `authSvc`
- Never use shorthand: `Project` not `Proj`
- Constructor deps are always `private readonly` with full names
- All class methods and properties MUST have explicit access modifiers (`public`, `private`, `protected`) or use JS private `#` fields — implicit public is forbidden

## Abstraction File

**Abstractions MUST live in an `abstractions/` directory — never a flat `abstractions.ts` file.** Each abstraction gets its own file inside `abstractions/`, plus a barrel `abstractions/index.ts` that re-exports all tokens and interfaces. One file per abstraction, one `createAbstraction()` call per file.

Each file contains: interface, `createAbstraction()` call, namespace with type exports. **Nothing else — no classes, no implementations, no features.**

**Every abstraction MUST have a sibling namespace with exported types. No exceptions.** At minimum the namespace exports `Interface` (the abstraction's own interface). If the abstraction consumes external types, those are re-exported through the namespace too. An abstraction without a namespace is incomplete.

```ts
// abstractions/ProjectRepository.ts
import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectNotFoundError, ProjectPersistenceError } from "../errors.js";

export interface ProjectRecord {
  id: string;
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant: string;
  createdAt: number;
  updatedAt: number;
}

interface ProjectCreateInput {
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant?: string;
}

export interface IProjectRepository {
  list(): Promise<Result<ProjectRecord[], ProjectPersistenceError>>;
  getById(id: string): Promise<Result<ProjectRecord, ProjectNotFoundError | ProjectPersistenceError>>;
  create(input: ProjectCreateInput): Promise<Result<ProjectRecord, ProjectPersistenceError>>;
  remove(id: string): Promise<Result<void, ProjectNotFoundError | ProjectPersistenceError>>;
}

export const ProjectRepository = createAbstraction<IProjectRepository>("Shared/ProjectRepository");

export namespace ProjectRepository {
  export type Interface = IProjectRepository;
  export type Record = ProjectRecord;
  export type CreateInput = ProjectCreateInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
```

**Rules:**

- Interface is `export interface` (required for strict declaration emit)
- All types accessed via namespace only (`ProjectRepository.Interface`, `ProjectRepository.Record`)
- Every param type gets its own named interface — never inline structural types
- No `Parameters<>`, `ReturnType<>`, or indexed access types — export explicit named types
- The namespace must contain ALL types — no top-level type exports scattered outside it
- **The namespace re-exports every type the implementation needs** — implementations import only the abstraction alias and reference types as `Abstraction.Record`, `Abstraction.CreateInput`, etc.

## Implementation File

Separate file at the feature root. Uses a local rename alias (`as Abstraction`) to avoid name clash.

```ts
// ProjectRepository.ts (at feature root, NOT in abstractions/)
import { Result } from "@webiny/stdlib";
import { DatabaseClient } from "~/db/abstractions/DatabaseClient.js";
import { ProjectRepository as Abstraction } from "./abstractions/ProjectRepository.js";
import { projects } from "~/db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { ProjectNotFoundError, ProjectPersistenceError } from "./errors.js";

class ProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface
  ) {}

  public async list(): Promise<Result<Abstraction.Record[], ProjectPersistenceError>> {
    try {
      const rows = this.databaseClient.db.select().from(projects).all();
      return Result.ok(rows);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(error as Error));
    }
  }

  // ... other methods
}

export const ProjectRepository = Abstraction.createImplementation({
  implementation: ProjectRepositoryImpl,
  dependencies: [DatabaseClient]
});
```

**Key points:**
- Uses `Abstraction.createImplementation()` — the abstraction token's own method
- `dependencies` array is positional — matches constructor parameters in order
- Class is NOT exported — only the createImplementation const is
- Uses `Abstraction.Record`, `Abstraction.CreateInput` — never imports types from other files directly

## Null/Default Implementations

When a service needs a fallback, the null object gets **its own file**.

```ts
// NullGraphQLClient.ts (own file, NOT in the abstraction file)
import { GraphQLClient } from "./abstractions/GraphQLClient.js";

class NullGraphQLClientImpl implements GraphQLClient.Interface {
  // ... stub methods
}

export const NullGraphQLClient = NullGraphQLClientImpl;
```

**Never** put a class in an abstraction file.

## Feature File

Container registrations live in `feature.ts`. Imports the implementation (not the abstraction) for registration. The `register()` function must be **synchronous**.

```ts
// feature.ts
import { createFeature } from "@webiny/stdlib";
import { ProjectRepository } from "./ProjectRepository.js"; // the createImplementation export

export const ProjectsFeature = createFeature({
  name: "Shared/ProjectsFeature",
  register(container) {
    container.register(ProjectRepository).inSingletonScope();
  }
});
```

Features compose — a parent feature calls child features in its `register`:

```ts
register(container) {
    DatabaseFeature.register(container, { databaseClient });
    CacheFeature.register(container, { cacheDir });
    GeneratorFeature.register(container);
}
```

## Barrel Exports (index.ts)

Export **abstractions** (tokens + types) and **features**. Never export implementations.

```ts
// index.ts
export { ProjectRepository } from "./abstractions/index.js"; // abstraction token
export { ProjectsFeature } from "./feature.js"; // feature registration
// NEVER: export { ProjectRepository } from "./ProjectRepository.js"  // implementation
```

## Lifetime Scopes

```ts
container.register(Impl); // Transient — new instance per resolve
container.register(Impl).inSingletonScope(); // Singleton — one instance per container
container.registerInstance(Abstraction, value); // Pre-built instance (always singleton)
container.registerFactory(Abstraction, () => v); // Lazy factory
```

**House rule:** Singletons for stateless services (repositories, clients, gateways, loggers). Transient for per-request state (use cases, presenters used standalone). Presenters injected as DI deps of other presenters must be singleton.

## Dependencies

The `dependencies` array is positional — matches constructor parameters in order:

```ts
export const ProjectRepository = Abstraction.createImplementation({
  implementation: ProjectRepositoryImpl,
  dependencies: [DatabaseClient] // matches constructor(client: DatabaseClient.Interface)
});
```

Options: `[Dep, { optional: true }]` for optional, `[Dep, { multiple: true }]` for resolveAll.

Every constructor dep is `private readonly` with the full type from the abstraction namespace:

```ts
public constructor(
    private readonly projectRepository: ProjectRepository.Interface,
    private readonly graphqlClient: GraphQLClient.Interface
) {}
```

## Testing

Use `createTestContainer()` for all tests. It creates a fully-wired container with real SQLite, real generators, and a mock HttpClient (for external API calls). Resolve via container, never construct directly:

```ts
const tc = createTestContainer({ httpClient: mockHttpClient });
const repository = tc.container.resolve(ProjectRepository);
// or for API tests:
const app = await createServer(tc.container, [registerApiRoutes]);
const response = await app.inject({ method: "GET", url: "/api/projects" });
```

**Rules:**

- Never `new ProjectRepositoryImpl(dep)` — always resolve through DI
- Only external HTTP calls may be mocked (via HttpClient abstraction)
- Build a fresh container per test to avoid singleton state bleeding
- Use `tc.cleanup()` in afterEach to remove temp DB files

## Common Mistakes

| Mistake                                          | Fix                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Class in abstraction file                        | Extract to own file (`NullXxx.ts` or `Xxx.ts`)                   |
| Feature + impl in same file                      | Split into `feature.ts` and `Xxx.ts`                             |
| Multiple concerns in one file                    | One responsibility per file — split immediately                  |
| `Impl` suffix on exported const                  | Only the class gets `Impl`; const uses short name                |
| Exporting implementation from index.ts           | Only export abstractions and features from barrels               |
| Bare interface export (`export interface IFoo`)   | Access via namespace: `Foo.Interface`                            |
| Inline structural types in signatures            | Extract to named interface/type in namespace                     |
| Flat `abstractions.ts` file                      | Always use `abstractions/` directory with one file per token     |
| Multiple `createAbstraction()` in one file       | Split into separate files inside `abstractions/`                 |
| Abstraction without sibling namespace            | Every abstraction MUST have a namespace (at minimum `Interface`) |
| `vi.fn()` mocks for repos/services               | Use real implementations via test container                      |
| `new ImplClass(dep)` in tests                    | Resolve through DI container                                     |
| Async `register()` in features                   | `register()` is sync; async work in startup functions            |
| `registerInstance()` for code that should use `createImplementation()` | Use `createImplementation()` with `dependencies` array when possible |
