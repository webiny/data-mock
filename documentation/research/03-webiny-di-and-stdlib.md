# Webiny DI and Stdlib — Research

## Packages

### @webiny/di (v1.0.2)

A professional-grade dependency injection container for TypeScript. Uses `reflect-metadata` and is built around SOLID principles. Published as a standalone npm package (not part of the webiny-js monorepo source tree, though consumed there from v6.4 onwards).

**Dependencies:** `reflect-metadata ^0.2.2`

### @webiny/stdlib (v0.0.17)

Standard library for Webiny — platform-agnostic, Node.js, and browser utilities. Depends on `@webiny/di` and re-exports `createAbstraction` (a convenience wrapper around `new Abstraction<T>()`).

**Sub-entry points:**
- `@webiny/stdlib` — common (platform-agnostic) utilities
- `@webiny/stdlib/node` — Node.js-specific features (file tools, Pino logger, etc.)
- `@webiny/stdlib/browser` — browser-specific features (LocalStorage cache, etc.)
- `@webiny/stdlib/mcp` — MCP server features

---

## @webiny/di API

### Abstraction

The core token type. Unifies the DI token and the TypeScript interface — resolving always returns the correct type.

```typescript
import { Abstraction } from "@webiny/di";

interface IUserRepository {
    getById(id: string): Promise<User>;
}

const UserRepository = new Abstraction<IUserRepository>("UserRepository");

// Convenience namespace pattern (used in reference project):
export namespace UserRepository {
    export type Interface = IUserRepository;
}
```

`Abstraction` also has helper methods:
- `createImplementation(params)` — binds an implementation class to this abstraction
- `createDecorator(params)` — binds a decorator class to this abstraction
- `createComposite(params)` — binds a composite class to this abstraction

### createAbstraction (from @webiny/stdlib)

Convenience wrapper:
```typescript
import { createAbstraction } from "@webiny/stdlib";
export const UserRepository = createAbstraction<IUserRepository>("UserRepository");
```
This is equivalent to `new Abstraction<IUserRepository>("UserRepository")`.

### Container

```typescript
import { Container } from "@webiny/di";

const container = new Container();

// Register an implementation (transient by default)
container.register(UserRepositoryImpl);

// Register as singleton
container.register(UserRepositoryImpl).inSingletonScope();

// Register a pre-created instance
container.registerInstance(UserRepository, myInstance);

// Register a factory function
container.registerFactory(UserRepository, () => new CustomImpl());

// Register a decorator
container.registerDecorator(CachingDecorator);

// Register a composite
container.registerComposite(PluginCompositeImpl);

// Resolve
const repo = container.resolve(UserRepository); // typed as IUserRepository
const allHandlers = container.resolveAll(EventHandler); // typed as IEventHandler[]

// Hierarchical containers
const child = container.createChildContainer();
```

### createImplementation

Binds an implementation class to an abstraction with explicit dependencies:

```typescript
import { createImplementation } from "@webiny/di";

class UserRepositoryImpl implements IUserRepository {
    constructor(private gateway: IUserGateway) {}
    // ...
}

const UserRepositoryImplementation = createImplementation({
    abstraction: UserRepository,
    implementation: UserRepositoryImpl,
    dependencies: [UserGateway]
});

// Or via the Abstraction helper method (preferred in reference project):
const UserRepositoryImplementation = UserRepository.createImplementation({
    implementation: UserRepositoryImpl,
    dependencies: [UserGateway]
});
```

### createDecorator

Wraps an existing implementation. The **last** constructor parameter is the decoratee (injected automatically):

```typescript
class CachedUserRepository implements IUserRepository {
    constructor(
        private cache: ICache,
        private decoratee: IUserRepository  // last param = decoratee
    ) {}
}

const CachedDecorator = createDecorator({
    abstraction: UserRepository,
    decorator: CachedUserRepository,
    dependencies: [Cache]  // only non-decoratee deps listed
});

container.registerDecorator(CachedDecorator);
```

### createComposite

Collects all implementations and exposes them as one:

```typescript
const PluginCompositeImpl = createComposite({
    abstraction: Plugin,
    implementation: PluginComposite,
    dependencies: [[Plugin, { multiple: true }]]
});
container.registerComposite(PluginCompositeImpl);
```

### Dependency Options

```typescript
// Multiple: resolves as array
[EventHandler, { multiple: true }]

// Optional: returns undefined if not registered
[Logger, { optional: true }]
```

### Lifetime Scopes

- **Transient** (default) — new instance per resolution
- **Singleton** — one instance, cached after first resolution

```typescript
container.register(Implementation);                    // transient
container.register(Implementation).inSingletonScope(); // singleton
```

---

## @webiny/stdlib API

### Core Utilities (platform-agnostic)

| Export | Description |
|--------|-------------|
| `Result<TValue, TError>` | Functional result type (ok/fail) with `map`, `mapError`, `flatMap`, `match` |
| `ResultAsync<TValue, TError>` | Async version with `mapAsync`, `flatMapAsync`, `match` |
| `BaseError<TData>` | Abstract error class with `code` and typed `data` |
| `createAbstraction<T>(name)` | Convenience wrapper for `new Abstraction<T>(name)` |
| `createFeature(def)` | Creates a feature module that registers implementations into a Container |
| `Logger` / `ILogger` | Logger abstraction with `debug`, `info`, `warn`, `error`, `fatal`, `child` |
| `ConsoleLoggerFeature` | Feature that registers a console-based Logger implementation |
| `Cache` / `ICache` | Synchronous cache abstraction |
| `AsyncCache` / `IAsyncCache` | Asynchronous cache abstraction |
| `MemoryCacheFeature` | Feature that registers an in-memory ICache |
| `AsyncMemoryCacheFeature` | Feature that registers an async in-memory IAsyncCache |
| `Env` | Environment variable abstraction |
| `toBoolean`, `isTruthy`, `isFalsy` | Boolean coercion utilities |
| `immutableGet`, `immutableSet`, `immutableDelete`, `mutableSet`, `mutableDelete` | Dot-prop utilities |
| `uuid`, `mdbid`, `generateId`, `generateAlphaNumericId`, etc. | ID generation utilities |

### Node.js Utilities (`@webiny/stdlib/node`)

| Export | Description |
|--------|-------------|
| `DirectoryTool` / `DirectoryToolFeature` | Directory operations (read, ensure, etc.) |
| `FileTool` / `FileToolFeature` | File read/write operations |
| `GlobTool` / `GlobToolFeature` | Glob pattern matching |
| `JsonFileTool` / `JsonFileToolFeature` | Read/write JSON files with schema validation |
| `PinoLoggerFeature` / `createPinoLogger` | Pino-based Logger implementation |
| `PathTool` / `PathToolFeature` | Path resolution utilities |
| `NdJsonReaderTool` / `NdJsonReaderToolFeature` | Newline-delimited JSON reader |
| `ReadStreamFactory` / `ReadStreamFactoryFeature` | Create read streams |
| `PackageJsonFileTool` / `PackageJsonFileToolFeature` | package.json operations |
| `ProcessEnvFeature` / `createProcessEnv` | Process environment variable access via DI |
| `HashFolderTool` / `HashFolderToolFeature` | Folder content hashing |
| `WorkspaceTool` / `WorkspaceToolFeature` | Monorepo workspace discovery |

---

## Feature Pattern

Features are the composition units. A feature is a named registration function that wires up abstractions + implementations into a Container.

```typescript
import { createFeature } from "@webiny/stdlib";
import { MyImplementation } from "./MyImplementation.ts";

export const MyFeature = createFeature({
    name: "MyFeature",
    register(container) {
        container.register(MyImplementation).inSingletonScope();
    }
});
```

Features compose by calling each other:

```typescript
export const AppFeature = createFeature({
    name: "AppFeature",
    register(container) {
        ConsoleLoggerFeature.register(container);
        ProcessEnvFeature.register(container);
        MyFeature.register(container);
    }
});
```

### Bootstrapping

```typescript
import { Container } from "@webiny/di";
import { AppFeature } from "./feature.ts";

const container = new Container();
AppFeature.register(container);

const service = container.resolve(MyAbstraction);
await service.execute();
```

---

## How the Reference Project Uses DI

The reference project (`prijevodi-online-2010`) follows a clean architecture pattern:

### Directory Structure Pattern
```
src/
├── cli/
│   ├── feature.ts          ← root CLI feature, composes sub-features
│   ├── po.ts               ← CLI entry: new Container() + CliFeature.register()
│   └── features/
│       ├── cache/feature.ts
│       ├── init/feature.ts
│       └── ...
├── api/
│   ├── feature.ts          ← root API feature, composes sub-features
│   ├── server.ts           ← API entry: new Container() + ApiFeature.register()
│   └── features/
│       ├── database/feature.ts
│       ├── series/feature.ts
│       └── ...
└── ui/
    ├── App.tsx              ← UI entry: new Container()
    └── features/
        └── statistics/
            ├── abstractions/
            │   ├── StatisticsGateway.ts    ← interface + createAbstraction
            │   └── StatisticsRepository.ts ← interface + createAbstraction
            ├── StatisticsGateway.ts         ← implementation + .createImplementation()
            └── feature.ts                   ← createFeature with container registrations
```

### Key Patterns Used

1. **Abstractions in `abstractions/` folders** — define interface + `createAbstraction<T>()` + namespace
2. **Implementations alongside** — implement the interface, export via `Abstraction.createImplementation()`
3. **Features compose** — root feature registers stdlib features + domain features
4. **Result type everywhere** — gateway methods return `Promise<Result<T, HTTPError>>`
5. **Singleton scope** for caches, repositories; transient for use cases
6. **Container.resolve()** at entry points (CLI commands, API route handlers)

---

## Recommendations for data-mock Adoption

### Direct Replacements

| Current data-mock | Replace with |
|-------------------|-------------|
| `pino` + `pino-pretty` (manual setup in `src/logger.ts`) | `PinoLoggerFeature` from `@webiny/stdlib/node` or `ConsoleLoggerFeature` — resolve via `Logger` abstraction |
| `src/cache/FileCache.ts` + `src/cache/MemoryCache.ts` (custom) | Keep as custom implementations but register via DI as `ICache` / `IAsyncCache` abstractions |
| `dotenv` + manual `process.env` access | `ProcessEnvFeature` from `@webiny/stdlib/node` + `Env` abstraction |
| `write-json-file` (manual JSON file ops) | `JsonFileToolFeature` from `@webiny/stdlib/node` |
| `fs-extra` (directory/file ops) | `DirectoryToolFeature` + `FileToolFeature` from `@webiny/stdlib/node` |
| `nanoid` (ID generation) | `generateId` utilities from `@webiny/stdlib` |

### Architecture Refactor

1. **Define abstractions** for core services:
   - `GraphQLClient` — wrapping the current GraphQL operations
   - `EntryGenerator` — the mock data generation pipeline
   - `ModelRepository` — model definition storage
   - `ProjectConfig` — replacing `.env` with a database-backed config (future UI)

2. **Create features** to compose:
   - `InfrastructureFeature` — logger, cache, file tools, env
   - `GraphQLFeature` — GraphQL client, query builders
   - `GeneratorFeature` — field generators, model generators
   - `CmsFeature` — CMS-specific entry/model/group creation

3. **Entry point** becomes:
   ```typescript
   const container = new Container();
   AppFeature.register(container);
   const app = container.resolve(Application);
   await app.run();
   ```

### Dependencies to Add

```json
{
    "@webiny/di": "^1.0.2",
    "@webiny/stdlib": "^0.0.17"
}
```

These will replace or complement: `pino`, `pino-pretty`, `nanoid`, `write-json-file`, `fs-extra`, `dotenv`.

### Dependencies to Potentially Remove After Migration

- `pino` + `pino-pretty` — replaced by `PinoLoggerFeature` (stdlib already depends on pino)
- `nanoid` — replaced by `generateId` from stdlib (stdlib already depends on nanoid)
- `write-json-file` — replaced by `JsonFileToolFeature`
- `fs-extra` — replaced by `DirectoryToolFeature` + `FileToolFeature`
- `dotenv` — replaced by `ProcessEnvFeature` (or kept if ProcessEnvFeature doesn't load .env)

### What to Keep

- `@faker-js/faker` — no stdlib equivalent, essential for mock data
- `graphql-tag` — needed for GQL query definitions
- `lodash` — utility belt (stdlib has some overlap but not full replacement)
- `slugify` — no stdlib equivalent
- `yargs` — CLI argument parsing (unless switching to a DI-based CLI pattern)
- `p-retry` — retry logic for API calls
