# ADR-015: Versioned API Operations

**Date:** 2026-09-03
**Status:** Implemented

## Context

Different Webiny versions have slightly different GraphQL APIs. A project running 6.1.0 may need different queries than 6.4.9. Most operations (~99%) are identical across versions, but a few change.

## Decision

1. Projects store a `webinyVersion` field (semver string, e.g., "6.4.9")
2. All GraphQL operations are versioned and registered in an operation registry
3. A base version (e.g., "6.0.0") defines the default set of operations
4. Specific versions can override individual operations
5. Resolution: exact version match → nearest lower version → base version

## Design

### Operation Definition

Each operation is a typed object — a GraphQL query/mutation string + a result extractor:

```ts
interface IGraphQLOperation<TInput, TOutput> {
  readonly name: string;
  readonly query: string;
  readonly path: "/cms/manage" | "/graphql";
  getResult(json: ApiGraphQLResultJson): ApiGraphQLResult<TOutput>;
  getVariables?(input: TInput): GenericRecord;
}
```

### Operation Registry

```ts
interface IOperationRegistry {
  register(version: string, operation: IGraphQLOperation<unknown, unknown>): void;
  resolve<TInput, TOutput>(name: string, version: string): IGraphQLOperation<TInput, TOutput>;
}
```

Resolution logic:
1. Look for exact version match (e.g., "6.4.9")
2. Walk down to nearest lower version (e.g., "6.4.0" → "6.0.0")
3. Fall back to base version ("6.0.0")

### Directory Structure

```
src/shared/node/graphql/operations/
├── abstractions/
│   ├── OperationRegistry.ts
│   └── GraphQLOperation.ts    # IGraphQLOperation interface
├── registry.ts                 # OperationRegistry implementation
├── feature.ts                  # Registers all operations
├── base/                       # Default operations (base version)
│   ├── listModels.ts
│   ├── createEntry.ts
│   ├── listTenants.ts
│   ├── listContentModelGroups.ts
│   └── ...
└── overrides/
    └── 6.4.9/                  # Version-specific overrides
        └── listModels.ts       # Different query for 6.4.9
```

### Usage

```ts
class SeedEntriesUseCaseImpl {
  constructor(
    private readonly graphqlClient: GraphQLClient.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
  ) {}

  async execute(project: Project) {
    const listModels = this.operationRegistry.resolve("listModels", project.webinyVersion);
    const result = await this.graphqlClient.query({
      query: listModels.query,
      path: listModels.path,
      getResult: listModels.getResult,
    });
  }
}
```

### Schema Change

Add `webiny_version TEXT NOT NULL DEFAULT '6.0.0'` to `projects` table.

### Version Input

- CLI: prompt for Webiny version during `add-project`
- UI: text field in Add Project form
- Validated as semver

## Why This Approach

- Most operations are shared — no duplication for the common case
- Version-specific overrides are isolated in their own files
- Adding support for a new version = add override files, register them
- The registry handles resolution — callers don't think about versions
- Semver-aware fallback means minor version bumps don't need new overrides unless something changed
