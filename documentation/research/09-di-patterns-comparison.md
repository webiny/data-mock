# DI Patterns Comparison — Reference Projects vs data-mock

## 1. Abstraction Definition

Both projects use the same pattern — identical across reference project and dependency-upgrader:

```ts
// abstractions/XxxService.ts
import { createAbstraction } from "@webiny/stdlib";

export interface IXxxService { ... }

export const XxxService = createAbstraction<IXxxService>("Layer/XxxService");

export namespace XxxService {
  export type Interface = IXxxService;
  // Additional type aliases as needed
}
```

**Key rules:**
- One abstraction per file, in an `abstractions/` directory
- Interface is `export interface`, token is `export const`, namespace is `export namespace`
- Abstraction name is `Layer/Name` (e.g., `"Api/ListGenresUseCase"`, `"Ui/StatisticsGateway"`)

## 2. Implementation Binding

Both projects use `Abstraction.createImplementation()`:

```ts
// XxxService.ts (at feature root, NOT in abstractions/)
import { XxxService as Abstraction } from "./abstractions/XxxService.ts";

class XxxServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly dep1: Dep1.Interface,
    private readonly dep2: Dep2.Interface,
  ) {}
  // ...
}

export const XxxService = Abstraction.createImplementation({
  implementation: XxxServiceImpl,
  dependencies: [Dep1, Dep2],
});
```

**Critical:** `dependencies` array declares constructor injection order. The container resolves each dependency and passes it to the constructor in that order. No decorators, no reflection beyond what `@webiny/di` handles internally.

**Multiple instances:** `[InitStep, { multiple: true }]` resolves all registered implementations of `InitStep` as an array.

## 3. Feature Registration

Both projects use `container.register(Implementation)` — NOT `registerInstance`:

```ts
// feature.ts
import { createFeature } from "@webiny/stdlib";
import { ListGenresRepository } from "./list/ListGenresRepository.ts";
import { ListGenresUseCase } from "./list/ListGenresUseCase.ts";

export const GenresFeature = createFeature({
  name: "Api/GenresFeature",
  register(container) {
    container.register(ListGenresRepository);  // ← register, not registerInstance
    container.register(ListGenresUseCase);     // ← register, not registerInstance
  },
});
```

**`container.register(Impl)`** — the container instantiates the class itself, resolving `dependencies` automatically.

**`container.registerInstance(Token, instance)`** — only for eagerly-created instances (e.g., DatabaseClient created before the container, or pre-built config objects).

**`container.register(Impl).inSingletonScope()`** — one instance, cached after first resolution.

## 4. When `registerInstance` IS Used

Only for infrastructure that must be created before DI resolution:

```ts
// Database client — created eagerly with pragmas, before container
const databaseClient = createDatabaseClient(DB_PATH);
container.registerInstance(DatabaseClient, databaseClient);

// Base URL — a literal value
container.registerInstance(BaseUrl, { value: "" });

// Pre-built callback
container.registerInstance(OnUnauthorized, { execute() { navigate("/login"); } });
```

## 5. Singleton vs Transient

| Type | Scope | Pattern |
|------|-------|---------|
| Repository (API) | Transient (default) | `container.register(Impl)` |
| UseCase (API) | Transient (default) | `container.register(Impl)` |
| Service (API) | Singleton | `container.register(Impl).inSingletonScope()` |
| Command (CLI) | Singleton | `container.register(Impl).inSingletonScope()` |
| Gateway (UI) | Singleton | `container.register(Impl).inSingletonScope()` |
| Repository (UI) | Singleton | `container.register(Impl).inSingletonScope()` |
| UseCase (UI) | Transient (default) | `container.register(Impl)` |
| Presenter (UI) | Transient (default) | `container.register(Impl)` |

## 6. UI Presentation Feature Pattern

```ts
export const XxxPresentationFeature = createFeature<void, XxxExports>({
  name: "Ui/XxxPresentationFeature",
  dependencies: [HeadlessFeature],
  register(container) {
    container.register(XxxPresenter);        // transient
    container.register(LoadXxxUseCase);      // transient
  },
  resolve(container) {
    return { presenter: container.resolve(XxxPresenterAbstraction) };
  },
});
```

## 7. What data-mock MUST Match

1. **Every implementation** must use `Abstraction.createImplementation({ implementation, dependencies })` — NOT manual `new Impl()` + `registerInstance`
2. **`container.register(Impl)`** in features, NOT `container.registerInstance(Token, new Impl(deps))`
3. **`registerInstance` only** for pre-built infrastructure (DatabaseClient, BaseUrl, HttpClient configs)
4. **Dependencies declared in array**, matching constructor parameter order
5. **Class name has `Impl` suffix**, exported const does NOT
6. **Abstraction and implementation in separate files**, separate directories
