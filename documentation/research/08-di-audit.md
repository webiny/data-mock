# DI Architecture Audit

Audit of all new code against the dependency-injection skill conventions.

---

## VIOLATION (must fix)

### V1. `src/shared/ProjectRepository.ts:101` — Implementation class is exported
```ts
export { ProjectRepositoryImpl };
```
The DI skill says: "Class is NOT exported — only the createImplementation const is." The implementation should use `Abstraction.createImplementation()` and export the result. Currently the class is exported directly and manually instantiated in `ProjectRepositoryFeature`.

**What the skill says:** Use `Abstraction.createImplementation({ implementation, dependencies })`.
**What the code does:** Exports the raw class and manually constructs it in feature.ts.

### V2. `src/shared/features/ProjectRepositoryFeature.ts:9-11` — Manual construction instead of createImplementation
```ts
const databaseClient = container.resolve(DatabaseClient);
const repository = new ProjectRepositoryImpl(databaseClient);
container.registerInstance(ProjectRepository, repository);
```
This manually resolves deps and calls `new`. The DI skill requires using `createImplementation()` with a `dependencies` array, then `container.register(Impl).inSingletonScope()`. Manual `new` bypasses DI wiring.

### V3. `src/shared/abstractions/ProjectRepository.ts:17` — Inline structural type in namespace
```ts
export type CreateInput = {
    name: string;
    apiUrl: string;
    apiToken: string;
    tenant?: string;
};
```
The DI skill says: "Every param type gets its own named interface — never inline structural types." This should be a named `interface ProjectCreateInput`.

### V4. `src/shared/abstractions/ProjectRepository.ts:3-4` — External types not re-exported through namespace
```ts
import type { Project } from "../types.js";
```
The interface uses `Project` directly. The DI skill says: "The namespace re-exports every type the implementation needs." `Project` should be `ProjectRepository.Record` in the namespace, and the implementation should reference `Abstraction.Record`.

### V5. `src/shared/FetchHttpClient.ts:17` — Implementation exported as raw class, not via createImplementation
```ts
export const FetchHttpClient = FetchHttpClientImpl;
```
This exports the class directly as a const. Should use `HttpClient.createImplementation()`. However, since FetchHttpClient has no DI dependencies (no constructor args), `registerInstance` in the feature is acceptable per the skill's `registerInstance` pattern. Still, the export aliases a class to a non-Impl const without going through `createImplementation`.

### V6. `src/graphql/GraphQLClient.ts:167` — Implementation class exported
```ts
export { GraphQLClientImpl };
```
Same as V1. The class is exported and manually constructed in `GraphQLFeature`. Should use `createImplementation()`.

### V7. `src/graphql/feature.ts:21-23` — Manual construction instead of createImplementation
```ts
const httpClient = new FetchHttpClient();
const client = new GraphQLClientImpl(httpClient, config);
container.registerInstance(GraphQLClient, client);
```
Should use `createImplementation()` with `dependencies: [HttpClient]` and inject config via feature context.

### V8. `src/cli/Prompts.ts:45` — Implementation class exported directly
```ts
export { PromptsImpl };
```
Same pattern — exported class, manually instantiated in CliFeature.

### V9. `src/cli/UI.ts:36` — Implementation class exported directly
```ts
export { UIImpl };
```
Same as V8.

### V10. `src/cli/feature.ts:14-15` — Manual construction
```ts
container.registerInstance(Prompts, new PromptsImpl());
container.registerInstance(UI, new UIImpl());
```
PromptsImpl and UIImpl have no DI dependencies, so `registerInstance` with `new` is pragmatically acceptable. However, the skill prefers `createImplementation()` + `container.register()` even for zero-dep classes.

### V11. `src/cli/commands/addProject/feature.ts:12-14` — Manual resolve + new
```ts
const prompts = container.resolve(Prompts);
const ui = container.resolve(UI);
const projectRepository = container.resolve(ProjectRepository);
container.registerInstance(Command, new AddProjectCommandImpl(prompts, ui, projectRepository));
```
Should use `createImplementation({ dependencies: [Prompts, UI, ProjectRepository] })` and register via `container.register()`.

### V12. `src/cli/commands/listProjects/feature.ts:10-12` — Same manual resolve + new pattern

### V13. `src/cli/commands/removeProject/feature.ts:12-16` — Same manual resolve + new pattern

### V14. `src/cli/commands/addProject/AddProjectCommand.ts:83` — Exports class directly
```ts
export { AddProjectCommandImpl };
```

### V15. `src/ui/features/projects/ProjectsRepository.ts:29` — Exports class directly
```ts
export { ProjectsRepositoryImpl };
```
Should use `createImplementation()`. Currently manually instantiated in ProjectsFeature.

### V16. `src/ui/features/projects/feature.ts:12` — Manual instance
```ts
container.registerInstance(ProjectsRepositoryAbstraction, new ProjectsRepositoryImpl());
```

### V17. `src/ui/infrastructure/httpClient/FetchHTTPClient.ts:90` — Exports class directly
```ts
export { FetchHTTPClientImpl };
```

### V18. `src/ui/infrastructure/httpClient/feature.ts:15-16` — Manual construction
```ts
const client = new FetchHTTPClientImpl(baseUrl);
container.registerInstance(HTTPClient, client);
```

### V19. `src/ui/infrastructure/httpClient/abstractions/HTTPClient.ts:19-31` — Class in abstraction file
```ts
export class HTTPError extends Error { ... }
```
The DI skill says: "Never put a class in an abstraction file." `HTTPError` should be in its own file (e.g., `HTTPError.ts`).

### V20. `src/ui/features/projects/abstractions/ProjectsGateway.ts:17` — Inline structural type in namespace
```ts
export type CreateInput = {
    name: string;
    ...
};
```
Should be a named interface.

---

## WARNING (should fix)

### W1. `src/graphql/abstractions/GraphQLClient.ts:5-60` — Many top-level types outside namespace
Types like `GenericRecord`, `ApiPath`, `ApiCmsMeta`, `ApiGraphQLSuccessResult`, `ApiGraphQLErrorResult`, `ApiGraphQLResult`, `ApiGraphQLResultJson`, `ResultExtractor`, `QueryParams`, `MutationParams`, `BatchMutationParams` are exported at the top level. The DI skill says: "The namespace must contain ALL types — no top-level type exports scattered outside it." The namespace does alias some but the top-level exports remain.

### W2. `src/shared/index.ts:13-14` — Barrel exports implementation + feature
```ts
export { FetchHttpClient } from "./FetchHttpClient.js";
export { ProjectRepositoryFeature } from "./features/ProjectRepositoryFeature.js";
```
The DI skill says barrel exports should be "abstractions and features only — never implementations." `FetchHttpClient` is an implementation export. `ProjectRepositoryFeature` as a feature is fine.

### W3. `src/generators/registry.ts:16-17` — Public fields without access modifiers
```ts
public generators: IGenerator<unknown>[] = [];
public validators: IValidatorConstructor<unknown>[] = [];
```
These should probably be `private` with accessor methods, or at minimum confirm the `public` is intentional (it is explicit, so marginally OK, but exposing mutable arrays is a design issue).

### W4. `src/testing/createTestContainer.ts:53` — Manual `new GraphQLClientImpl()`
```ts
const graphqlClient = new GraphQLClientImpl(httpClient, { ... });
```
The DI skill says: "Never `new ImplClass(dep)` in tests — always resolve through DI container." However, this is the test container setup itself, not a test. Pragmatically acceptable but worth noting.

### W5. `src/feature.ts:17-18` — Async work (migrations) inside synchronous register()
```ts
const databaseClient = createDatabaseClient(dbPath);
runMigrations(databaseClient.db);
```
The DI skill says: "register() is sync; async work in startup functions." `better-sqlite3` is synchronous so this doesn't actually block, but the migration logic is conceptually startup work that should live outside `register()`.

---

## NOTE (minor)

### N1. `src/shared/types.ts` — Types defined outside abstractions
Domain types (`Project`, `SeedJob`, etc.) live in a standalone `types.ts` file. The DI skill doesn't strictly require these to be in abstraction namespaces since they're pure domain models, not DI-related. Fine as-is.

### N2. `src/db/client.ts:6` — Uses `import type { DatabaseClient }` correctly
Good — type-only import.

### N3. `src/graphql/GraphQLClient.ts:152` — `as` cast on JSON parse
```ts
const json = (await response.json()) as ApiGraphQLResultJson;
```
This is a boundary cast (external data) which is an acceptable documented last resort. The alternative would be Zod validation.

### N4. `src/api/routing/routeFactory.ts:19,35` — `as` casts for params/body
```ts
let body: InferBody<TRoute> = request.body as InferBody<TRoute>;
let params: InferParams<TRoute> = request.params as InferParams<TRoute>;
```
These are at the Fastify boundary and are validated by Zod before use. Documented acceptable location.

### N5. `src/ui/di/createFeature.ts:39` — `as` cast on context
```ts
def.register(container, context as TRegister);
```
Internal to the DI bridge, not user-facing. Acceptable.

---

## Summary

| Severity | Count | Main Pattern |
|---|---|---|
| VIOLATION | 20 | Manual `new Impl()` + `registerInstance()` instead of `createImplementation()` + `register()` |
| WARNING | 5 | Top-level type exports, barrel hygiene, test container construction |
| NOTE | 5 | Boundary casts, domain types location |

**The dominant violation pattern is: implementations export raw classes and features manually construct them with `new`, instead of using `Abstraction.createImplementation({ implementation, dependencies })` and `container.register(Impl).inSingletonScope()`.** This bypasses the DI dependency resolution and makes it impossible to decorate or swap implementations through the container.

### Files needing the most work:
1. `src/shared/ProjectRepository.ts` + `ProjectRepositoryFeature.ts` — convert to createImplementation
2. `src/graphql/GraphQLClient.ts` + `feature.ts` — convert to createImplementation
3. `src/cli/Prompts.ts`, `UI.ts`, all command features — convert to createImplementation
4. `src/ui/features/projects/ProjectsRepository.ts` + feature — convert to createImplementation
5. `src/ui/infrastructure/httpClient/FetchHTTPClient.ts` + feature — convert to createImplementation
6. `src/ui/infrastructure/httpClient/abstractions/HTTPClient.ts` — extract HTTPError class to own file
