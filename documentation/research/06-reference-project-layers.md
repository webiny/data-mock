# Reference Project Layers — prijevodi-online-2010

Full architecture deep-dive across all four layers: `shared/`, `api/`, `cli/`, `ui/`.

---

## 1. Shared Layer (`src/shared/`)

The shared layer holds code consumed by all three runtime layers (API, CLI, UI). It has no dependencies on any specific layer.

### Contents

| Directory/File | Purpose |
|---|---|
| `errors.ts` | `BaseError` subclasses shared across layers (DatabaseError, CacheError, etc.) |
| `statuses.ts` | Named status constants (series, episodes, movies) stored as DB varchars |
| `CacheKey.ts` | Typed cache key with name + Zod schema for type-safe cache values |
| `db/schema/` | All Drizzle table definitions (~25 tables). One file per entity domain. |
| `db/schema/columns.ts` | Reusable column builders (e.g., `uuidColumn()`) |
| `db/buildUpdates.ts` | Maps input object fields → DB column updates with optional transforms |
| `db/deleteById.ts` | Generic "check exists → delete → wrap errors" helper using Result pattern |
| `db/whereBuilder/` | Full DI feature: abstraction + implementation for building WHERE clauses |
| `routing/` | **Type-safe route definitions** — shared between API (route registration) and UI (HTTP client) |
| `routes/` | All route definitions (one file per domain: `genres.ts`, `series.ts`, etc.) |
| `responses/` | Zod response schemas (one file per domain: `genres.ts`, `statistics.ts`, etc.) |
| `utils/` | Pure utility functions (date formatting, slugify, HTML parsing, etc.) |
| `node/loadEnv.ts` | dotenv wrapper used by both API and CLI entry points |
| `images/` | Allowed image size constants |
| `types/` | Shared type definitions |

### Key Pattern: Typed Route Definitions

The routing system is the centerpiece of the shared layer. A route definition in `shared/routes/` is consumed by:
1. **API** — `routeFactory()` registers it with Fastify (validation, authorization, typed handler)
2. **UI** — `httpClient.request()` uses it to build the fetch URL and type the response

```ts
// shared/routes/genres.ts
export const listGenresRoute = defineListRoute("genres", {
  path: "/api/v1/genres",
  description: "List all genres",
  params: z.object({}),
  item: genreSchema,
});
```

Three typed route constructors:
- `defineListRoute(key, config)` → response: `{ [key]: { items: T[], total: number } }`
- `defineOneRoute(key, config)` → response: `{ [key]: T }`
- `defineVoidRoute(config)` → 204 No Content

Each route carries: `method`, `path`, `params` (Zod), optional `body` (Zod), optional `querystring` (Zod), optional `response` (Zod), `responseType`, `responseKey`.

### Key Pattern: Shared Response Schemas

```ts
// shared/responses/genres.ts
export const genreSchema = z.object({
  id: z.number(),
  name: z.string(),
  uri: z.string(),
  count: z.number(),
});
export type Genre = z.infer<typeof genreSchema>;
```

These schemas serve as the contract between API and UI — the API serializes data matching the schema, the UI validates received data against it.

---

## 2. API Layer (`src/api/`)

### Entry Point: `start.ts` → `server.ts`

```ts
// start.ts
loadEnv();                      // Load .env
const app = await createServer();
await app.listen({ port: 3001, host: "0.0.0.0" });
```

```ts
// server.ts — createServer()
const container = new Container();
ApiFeature.register(container);           // Register ALL features into DI

// Migrations
const dbClient = container.resolve(DatabaseClient);
await migrate(dbClient.db, { migrationsFolder: "./migrations" });

// Per-request: child container + auth
createRequestContext(app, container);     // Attaches container + logger per request
createAuthHook(app, container);          // Auth middleware

// Error handlers
app.setErrorHandler(/* BaseError → typed JSON, validation → 400, unknown → 500 */);
app.setNotFoundHandler(/* 404 */);

// Routes
await registerApiRoutes(app);            // Register all Fastify routes
```

### Feature Composition: `feature.ts`

The root `ApiFeature` composes **all** sub-features in order:

```ts
export const ApiFeature = createFeature({
  name: "ApiFeature",
  register(container) {
    // Infrastructure
    ProcessEnvFeature.register(container);
    ConsoleLoggerFeature.register(container);
    DirectoryToolFeature.register(container);
    FileToolFeature.register(container);
    DatabaseFeature.register(container);
    CacheFeature.register(container);
    HttpClientFeature.register(container);

    // Domain features (40+ features)
    AuthFeature.register(container);
    SeriesFeature.register(container);
    GenresFeature.register(container);
    // ... etc
  },
});
```

Note: `createFeature` from `@webiny/stdlib` provides idempotency — safe to call multiple times.

### Route Registration: `routes.ts`

Separate from feature registration. Each feature exports a `registerXxxRoutes(app)` function:

```ts
export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  await createHealthRoute(app);
  await registerAuthRoutes(app);
  await registerGenresRoutes(app);
  // ... 30+ more
}
```

### Per-Feature Structure (Genres example)

```
features/genres/
├── abstractions/index.ts           # Barrel for all genre abstractions
├── errors.ts                       # GenreRepositoryError, GenreNotFoundError, GenreInUseError
├── feature.ts                      # GenresFeature — registers all use cases + repositories
├── mapRow.ts                       # DB row → DTO mapper
├── permissions.ts                  # Permission declarations
├── routes.ts                       # registerGenresRoutes() — delegates to sub-routes
├── list/
│   ├── abstractions/
│   │   ├── ListGenresUseCase.ts    # createAbstraction + interface + namespace
│   │   └── ListGenresRepository.ts # createAbstraction + interface + namespace
│   ├── ListGenresUseCase.ts        # createImplementation (delegates to repository)
│   ├── ListGenresRepository.ts     # createImplementation (Drizzle queries)
│   └── route.ts                    # routeFactory(listGenresRoute, handler)
├── create/  (same pattern)
├── update/  (same pattern)
└── delete/  (same pattern)
```

### routeFactory — The Route→Handler Bridge

```ts
// api/routing/routeFactory.ts
export function routeFactory(route, handler, options) {
  return async (app) => {
    registerRoute(app, route, {}, async (request, reply) => {
      const send = createSend(route, reply, request);  // Typed send based on responseType
      return handler({
        params: request.params,
        body: request.body,
        query: request.query,
        container: request.container,  // Child container from createRequestContext
        reply,
        send,
      });
    }, options);
  };
}
```

The `registerRoute()` function:
1. Adds Zod validation as `preValidation` hook (params, body, querystring)
2. Adds authorization check via `CurrentUser.hasPermission()`
3. Registers the Fastify route

The `createSend()` function:
- `"list"` → `{ [key]: { items, total }, ...includes }` with 200
- `"one"` → `{ [key]: value, ...includes }` with 200
- `"none"` → 204 No Content
- On failure: delegates to `sendError()` which serializes BaseError

### createRequestContext — Per-Request DI

```ts
app.addHook("onRequest", async (request) => {
  request.logger = logger;
  request.container = container.createChildContainer();
});
```

Every request gets a **child container** — inherits all singletons from the root, but per-request services can be registered without affecting other requests.

### Database Feature

```ts
// abstractions/DatabaseClient.ts
export interface IDatabaseClient {
  db: MySql2Database<typeof schema>;
  close(): Promise<void>;
}
export const DatabaseClient = createAbstraction<IDatabaseClient>("Api/DatabaseClient");

// DatabaseClient.ts (implementation)
class DatabaseClientImpl {
  constructor(env: Env.Interface) {
    this.pool = mysql.createPool({ host, port, user, password, database });
    this.db = drizzle(this.pool, { schema, mode: "default" });
  }
}
export const DatabaseClient = Abstraction.createImplementation({
  implementation: DatabaseClientImpl,
  dependencies: [Env],
});

// feature.ts
container.register(DatabaseClient).inSingletonScope();
```

**For data-mock:** Replace MySQL with SQLite (`better-sqlite3` + `drizzle-orm/better-sqlite3`). Same pattern, different driver.

---

## 3. CLI Layer (`src/cli/`)

### Entry Point: `po.ts`

```ts
loadEnv();
const container = new Container();
CliFeature.register(container);

const commands: Record<string, () => Promise<void>> = {
  init: async () => {
    const command = container.resolve(InitCommand);
    await command.execute();
  },
  "migrate:data": async () => { ... },
  deploy: async () => { ... },
};

const commandName = process.argv[2];
await commands[commandName]();
```

Simple command dispatch via object lookup. Commands are resolved from the DI container.

### Feature Composition: `feature.ts`

```ts
export const CliFeature = createFeature({
  name: "Cli/CliFeature",
  register(container) {
    // Stdlib infrastructure
    ConsoleLoggerFeature.register(container);
    DirectoryToolFeature.register(container);
    FileToolFeature.register(container);
    GlobToolFeature.register(container);
    JsonFileToolFeature.register(container);
    ProcessEnvFeature.register(container);
    ReadStreamFactoryFeature.register(container);

    // CLI-specific services
    CliCacheFeature.register(container);
    PromptsFeature.register(container);   // @clack/prompts wrapper
    UIFeature.register(container);         // @clack/prompts UI wrapper (intro/outro/spinner)

    // Service features
    DatabaseExecutorFeature.register(container);
    FileScannerFeature.register(container);

    // Command features
    InitFeature.register(container);
    ImportTablesFeature.register(container);
    MigrateFeature.register(container);
    DeployFeature.register(container);
    // ... etc
  },
});
```

### CLI Service Abstractions

| Service | Purpose |
|---|---|
| `Prompts` | Interactive prompts (text, select, multiselect, confirm) via @clack/prompts |
| `UI` | CLI UI (intro, outro, note, cancel, spinner) via @clack/prompts |
| `DatabaseExecutor` | MySQL query execution for CLI-specific DB operations |
| `FileScanner` | Filesystem scanning with glob patterns |
| `CliCache` | CLI-specific caching (different from API cache) |

### Command Structure

Each command is a feature with the standard pattern:

```
features/{commandName}/
├── abstractions/
│   ├── {CommandName}Command.ts    # createAbstraction
│   └── index.ts
├── {CommandName}Command.ts        # createImplementation
├── feature.ts                     # createFeature
└── index.ts                       # barrel
```

Commands receive services through DI constructor injection.

---

## 4. UI Layer (`src/ui/`)

### Entry Point: `main.tsx` → `App.tsx`

```tsx
// main.tsx
createRoot(document.getElementById("root")!).render(<App />);

// App.tsx
function createAppContainer(): Container {
  const container = new Container();

  // Infrastructure instances
  container.registerInstance(BaseUrl, { value: "" });
  container.registerInstance(OnUnauthorized, { execute() { navigate("/login"); } });

  // Infrastructure singletons
  container.register(ErrorNotifierImpl).inSingletonScope();
  container.register(SuccessNotifierImpl).inSingletonScope();
  container.register(RouterRepository).inSingletonScope();

  // All features (dependency-ordered)
  registerFeatures(container, [
    RouterFeature,
    AppAuthFeature,
    SeriesListFeature,
    StatisticsPresentationFeature,
    // ... 50+ features
  ]);

  // Route instances (multiple instances of same abstraction)
  container.registerInstance(Route, seriesRoute);
  container.registerInstance(Route, statisticsRoute);
  // ... 30+ routes

  return container;
}

export function App() {
  const container = useMemo(() => createAppContainer(), []);
  return (
    <DiContainerProvider container={container}>
      <MantineProvider theme={theme}>
        <RouterComponent />
      </MantineProvider>
    </DiContainerProvider>
  );
}
```

### UI DI Infrastructure (`src/ui/di/`)

Six files that bridge React and the DI container:

**`createFeature.ts`** — UI-specific feature factory (adds `dependencies`, `routes`, `resolve`):
```ts
export function createFeature<TRegister = void, TExports = undefined>(
  def: FeatureDefinition<TRegister, TExports>
) {
  // Adds Reflect metadata marker and default empty dependencies array
  return { name, dependencies, register, routes, resolve };
}
```

**`DiContainerProvider.tsx`** — React context that holds the Container:
```tsx
const ContainerContext = createContext<Container | null>(null);
export function DiContainerProvider({ container, children }) { ... }
export function useContainer(): Container { ... }
```

**`useFeature.ts`** — Hook to resolve a feature's exports:
```ts
export function useFeature<TExports>(feature: Resolvable<TExports>): TExports {
  const container = useContainer();
  return useMemo(() => feature.resolve(container), [container, feature]);
}
```

**`RegisterFeature.tsx`** — Component that registers a feature on first render (used for lazy registration).

**`registerFeatures.ts`** — Topological sort that registers features respecting dependency order:
```ts
export function registerFeatures(container, features) {
  // Topological sort with cycle detection
  // Registers dependencies before dependents
}
```

### UI Architecture: Two-Tier Features

**Tier 1: Headless Features** (`src/ui/features/{domain}/`)
- **Gateway** — HTTP client wrapper, calls API routes
- **Repository** — In-memory state store (singleton)

```
features/statistics/
├── abstractions/
│   ├── StatisticsGateway.ts     # Interface + createAbstraction
│   └── StatisticsRepository.ts  # Interface + createAbstraction
├── StatisticsGateway.ts         # Implementation: httpClient.request(route) → Result
├── StatisticsRepository.ts      # Implementation: get/set methods on private fields
└── feature.ts                   # Both registered as singletons
```

**Tier 2: Presentation Features** (`src/ui/presentation/{Domain}/{Page}/`)
- **UseCase** — Orchestrates gateway calls + repository updates
- **Presenter** — MobX observable with computed `vm` getter
- **Provider** — Resolves feature exports, passes presenter to children
- **React components** — Dumb display, observer-wrapped

```
presentation/Statistics/
├── abstractions/
│   └── StatisticsPresenter.ts    # Interface + ViewModel type + createAbstraction
├── useCases/
│   └── LoadStatistics/
│       ├── abstractions/LoadStatisticsUseCase.ts
│       └── LoadStatisticsUseCase.ts   # gateway.fetch() → repository.set()
├── StatisticsPresenter.ts        # MobX: makeAutoObservable, computed vm, load action
├── StatisticsProvider.tsx        # useFeature(StatisticsPresentationFeature)
├── feature.ts                    # createFeature<void, { presenter }>
├── route.tsx                     # defineUiRoute with render()
└── components/
    └── StatisticsPage.tsx        # observer(function({ presenter }) { ... })
```

### Feature Resolution Pattern

Presentation features declare typed exports:

```ts
export const StatisticsPresentationFeature = createFeature<void, StatisticsExports>({
  name: "Ui/StatisticsPresentationFeature",
  dependencies: [StatisticsFeature],   // Headless feature dependency
  register(container) {
    container.register(StatisticsPresenter);
    container.register(LoadStatisticsUseCase);
  },
  resolve(container) {
    return { presenter: container.resolve(StatisticsPresenterAbstraction) };
  },
});
```

Usage in React:
```tsx
const { presenter } = useFeature(StatisticsPresentationFeature);
```

### HTTP Client Infrastructure

```
ui/infrastructure/httpClient/
├── abstractions/
│   ├── HTTPClient.ts       # IHTTPClient with get/post/put/patch/delete/request methods
│   ├── BaseUrl.ts          # Base URL for all API calls
│   └── OnUnauthorized.ts   # Callback for 401/403 responses
├── FetchHTTPClient.ts      # Implementation using fetch(), interpolatePath(), error handling
├── HTTPError.ts            # Error class with code, statusCode, data
└── feature.ts              # HTTPClientFeature
```

The `request()` method uses shared route definitions:
```ts
async request(route, args) {
  const interpolatedPath = interpolatePath(route.path, args.params);
  return this.executeRequest(route.method, interpolatedPath, body, {
    responseSchema: route.response,
    params: query,
  });
}
```

---

## 5. Data Flow: API Route → DB → UI Display

Complete flow for "List Genres":

```
1. UI: StatisticsPage.tsx
   ↓ presenter.load()
2. Presenter: StatisticsPresenter.ts
   ↓ loadStatisticsUseCase.execute()
3. UseCase: LoadStatisticsUseCase.ts
   ↓ gateway.getTranslators() / getSummary() / getDownloads()
4. Gateway: StatisticsGateway.ts
   ↓ httpClient.request(translatorStatsRoute, { params: {} })
5. HTTPClient: FetchHTTPClient.ts
   ↓ fetch("/api/v1/statistics/translators") → JSON → Result.ok(data)
6. --- network boundary ---
7. Fastify: registerRoute(translatorStatsRoute, handler, { permission })
   ↓ Zod validation (params, body, query) → authorization check
8. Route handler: route.ts
   ↓ container.resolve(ListTranslatorStatsUseCase).execute()
9. UseCase: ListTranslatorStatsUseCase.ts
   ↓ repository.list()
10. Repository: ListTranslatorStatsRepository.ts
    ↓ databaseClient.db.select().from(users).where(...).all()
11. Back up the chain → Result.ok(data) → send(result) → JSON response
12. UI: Gateway → Repository.set() → Presenter.vm (computed) → React re-render
```

---

## 6. What to Copy for data-mock

### Must Copy (infrastructure that bootstraps everything else)

| Source | Target | What it does |
|---|---|---|
| `src/ui/di/createFeature.ts` | `src/ui/di/createFeature.ts` | UI feature factory with dependencies + resolve |
| `src/ui/di/DiContainerProvider.tsx` | `src/ui/di/DiContainerProvider.tsx` | React context for DI container |
| `src/ui/di/useFeature.ts` | `src/ui/di/useFeature.ts` | Hook to resolve feature exports |
| `src/ui/di/registerFeatures.ts` | `src/ui/di/registerFeatures.ts` | Topological sort feature registration |
| `src/ui/di/RegisterFeature.tsx` | `src/ui/di/RegisterFeature.tsx` | Lazy feature registration component |
| `src/shared/routing/defineRoute.ts` | `src/shared/routing/defineRoute.ts` | Route definition factory |
| `src/shared/routing/defineTypedRoutes.ts` | `src/shared/routing/defineTypedRoutes.ts` | List/One/Void typed route factories |
| `src/shared/routing/interpolatePath.ts` | `src/shared/routing/interpolatePath.ts` | Path param interpolation |
| `src/shared/routing/types.ts` | `src/shared/routing/types.ts` | IRequestArgs type |
| `src/api/routing/routeFactory.ts` | `src/api/routing/routeFactory.ts` | Fastify route↔DI bridge |
| `src/api/routing/registerRoute.ts` | `src/api/routing/registerRoute.ts` | Fastify route registration with Zod validation |
| `src/api/routing/sendTyped.ts` | `src/api/routing/sendTyped.ts` | Typed response sender (list/one/none) |
| `src/api/routing/sendError.ts` | `src/api/routing/sendError.ts` | Error response serialization |
| `src/api/routing/createRequestContext.ts` | `src/api/routing/createRequestContext.ts` | Per-request child container |
| `src/api/routing/types.ts` | `src/api/routing/types.ts` | Fastify request augmentation |
| `src/ui/infrastructure/httpClient/` | `src/ui/infrastructure/httpClient/` | Full HTTP client (FetchHTTPClient + abstractions) |

### Adapt (same pattern, different domain)

| Source | Adaptation for data-mock |
|---|---|
| `src/api/features/database/` | Replace MySQL with SQLite (`better-sqlite3`) |
| `src/shared/db/schema/` | Write project + seed_jobs tables instead |
| `src/shared/db/deleteById.ts` | Change MySQL types to SQLite types |
| `src/shared/errors.ts` | Write data-mock specific errors |
| `src/shared/node/loadEnv.ts` | Keep as-is (or use ProcessEnvFeature) |
| `src/cli/features/prompts/` | Copy for CLI interactive prompts |
| `src/cli/features/ui/` | Copy for CLI spinner/intro/outro |

### Skip (domain-specific, not applicable)

- All domain features (series, genres, movies, etc.)
- Auth system (SMF integration)
- File management, image serving
- All migration/import commands
- RBAC/permissions system (data-mock has no users initially)

---

## 7. Architecture Patterns Summary

| Pattern | Where | How |
|---|---|---|
| Feature composition | All layers | `createFeature()` → root feature calls `.register()` on children |
| Abstraction separation | All layers | `abstractions/` directory, one file per abstraction, never with implementation |
| Result everywhere | All layers | `Result<T, E>` for all fallible operations, never throw |
| Typed routes (shared contract) | API ↔ UI | Route definitions in `shared/routes/`, Zod schemas in `shared/responses/` |
| Child container per request | API | `container.createChildContainer()` per Fastify request |
| Feature exports with resolve() | UI | `createFeature<void, TExports>({ resolve(container) { ... } })` |
| Topological feature ordering | UI | `registerFeatures()` does dependency-first traversal |
| Gateway → Repository → UseCase → Presenter → React | UI | Strict layer boundaries, React is dumb |
| MobX computed vm | UI | Presenter exposes `get vm()` computed from repository state |
| Route factory | API | `routeFactory(route, handler, { permission })` — validation + auth + typed send |
