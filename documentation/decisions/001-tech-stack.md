# ADR-001: Technology Stack

**Date:** 2026-09-02
**Status:** Accepted

## Context

The project is being refactored from a single-project CLI tool into a multi-project tool with a web UI. We need to choose the core technology stack.

## Decisions

| Concern | Choice | Rationale |
|---|---|---|
| DI container | `@webiny/di` ^1.0.2 | Company standard. Used across all Webiny projects. |
| Standard library | `@webiny/stdlib` ^0.0.17 | Provides Result, BaseError, createAbstraction, createFeature, Logger, Cache, filesystem tools |
| Database | SQLite via `better-sqlite3` + `drizzle-orm` | Same pattern as dependency-upgrader reference project. Synchronous, no server needed, WAL mode. |
| Migrations | `drizzle-kit` | Declarative schema diffing → SQL migration files |
| UI framework | React 19 + Mantine 7 | Mantine has good form/table/modal components. Same pattern as prijevodi-online reference. |
| API server | Fastify 5 | Same as reference project. Fast, schema-based validation, good plugin ecosystem. |
| Testing | vitest | Fast, Vite-based, ESM-native, great TypeScript support |
| Validation | Zod | Used by both API (request validation) and shared layer (response schemas, route contracts) |
| CLI prompts | `@clack/prompts` | Same as reference project. Wrapped as Prompts + UI DI abstractions. |
| Linting | oxlint | Fast, Rust-based. Already configured in project. |
| Formatting | oxfmt | Fast, Rust-based. Already configured in project. |
| Package manager | yarn 4 (Berry) | Already configured in project. |
| TypeScript | 7.x | Already configured in project. |

## Dependencies to Add

```
@webiny/di, @webiny/stdlib
better-sqlite3, @types/better-sqlite3, drizzle-orm, drizzle-kit
zod
fastify
react, react-dom, @mantine/core, @mantine/hooks
@clack/prompts
vitest (dev)
```

## Dependencies to Remove (after migration)

- `pino`, `pino-pretty` → `PinoLoggerFeature` from `@webiny/stdlib/node`
- `nanoid` → `generateId` from `@webiny/stdlib`
- `write-json-file` → `JsonFileToolFeature` from `@webiny/stdlib/node`
- `fs-extra` → `DirectoryToolFeature` + `FileToolFeature`
- `dotenv` → `ProcessEnvFeature` from `@webiny/stdlib/node`
