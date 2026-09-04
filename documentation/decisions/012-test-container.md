# ADR-012: Test Container Pattern

**Date:** 2026-09-03
**Status:** Accepted

## Decision

Use a shared `createTestContainer()` factory for all tests. It creates a fully-wired DI container with all real registrations. Individual tests only mock what they need.

## How It Works

```ts
import { createTestContainer } from "~/testing/createTestContainer.js";

const mockHttpClient = { post: vi.fn() };
const tc = createTestContainer({ httpClient: mockHttpClient });

// Resolve real services — DB, generators, cache are all real
const client = tc.container.resolve(GraphQLClient);

// Only HttpClient is mocked — everything else is production code
```

## What `createTestContainer()` Provides

- Fresh SQLite database (unique per test, temp directory)
- Migrations applied
- All features registered: Database, Cache, Generators, GraphQL, Logger, Env
- Default no-op HttpClient that throws if called unmocked (prevents accidental real HTTP)
- `cleanup()` method to remove test DB files

## Mock Points

| Abstraction | Default | Override |
|---|---|---|
| HttpClient | No-op (throws) | Pass `httpClient` option |
| DatabaseClient | Real SQLite (temp file) | Override via `container.registerInstance()` after creation |
| GeneratorRegistry | Real (all generators) | Override via `container.registerInstance()` |
| FileCache / MemoryCache | Real | Override via `container.registerInstance()` |

## Rationale

- Tests run against real DI wiring — catches registration bugs
- Only mock external boundaries (HTTP)
- Each test gets an isolated database — no shared state
- Consistent setup across all test files
