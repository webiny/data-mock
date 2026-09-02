# Skills Inventory

Skills copied from `/Users/brunozoric/private/prijevodi-online-2010/.claude/skills/` and adapted for the `webiny-mock-data` project.

## Skills Summary

| Skill | Source | Key Modifications |
|-------|--------|-------------------|
| `project-architecture` | Adapted | DI imports changed to `@webiny/di` + `@webiny/stdlib`. Layout restructured for CLI+UI (no PHP). Domain examples use Project/Seeding instead of Patient/Series. Added SQLite and GraphQL service references. |
| `cli-developer` | Adapted | Entry point changed from `yarn po` to `yarn cli`. Services adapted: `DatabaseExecutor` → `DatabaseService` (SQLite), added `GraphQLService`. Removed mysql-specific references. Pre-commit uses oxlint/oxfmt. |
| `api-developer` | Rewritten | Original was Fastify-focused with `routeFactory`. Rewritten for local server serving UI, managing project configs in SQLite, orchestrating seeding jobs, and proxying to Webiny CMS GraphQL. Kept DI patterns and directory structure conventions. |
| `ui-developer` | Adapted | Nearly identical architecture (Gateway→Repository→UseCase→Presenter→React). Domain examples changed from Patient/Series to Project/Seeding. Import paths updated. Feature registration notes adapted. Removed Croatian language requirement. |
| `ui-design` | Adapted | Same token-based design system approach. Removed Croatian language requirement. Theme structure kept generic (will be defined during UI implementation). |
| `handoff` | Adapted | Changed `origin/master` → `origin/main`. Updated check commands to `yarn lint && yarn format:check && yarn compile`. Handoff file path changed to `documentation/handoff/`. Removed PHP tooling references. |
| `review-fix-loop` | Unchanged | Generic enough to work as-is. Not tied to any specific project structure. |

## What Was NOT Changed

- The core DI patterns (`createAbstraction`, `createImplementation`, `createFeature`, `Result<T, E>`, `BaseError`) are identical — these come from `@webiny/stdlib` which both projects share.
- The iron rule (abstractions and implementations in separate files/directories) is preserved verbatim.
- The scoping rules (transient vs singleton) are identical.
- The review-fix-loop skill is project-agnostic and copied as-is.

## What Was Added

- References to SQLite as the persistence layer (replacing .env for project configs)
- `GraphQLService` as a core service (wrapping Webiny CMS API)
- `GeneratorRegistry` / `GeneratorService` references (the existing field generators)
- oxlint/oxfmt as the lint/format toolchain (replacing eslint/prettier)
