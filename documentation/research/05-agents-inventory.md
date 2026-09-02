# Agents Inventory

Agents copied from `/Users/brunozoric/private/prijevodi-online-2010/.claude/agents/` and adapted for the webiny-mock-data project.

## Source → Target

| Source Agent | Target Agent | Key Modifications |
|---|---|---|
| `api-developer.md` | `api-developer.md` | Replaced routeFactory/route pattern with Application + GraphQL + SQLite architecture; replaced `~/shared/routes` references with project-specific paths; updated DI from `@webiny/stdlib` only to `@webiny/di` + `@webiny/stdlib`; added generator/validator subsystem docs; changed tooling from eslint/prettier to oxlint/oxfmt; added "Preserve These Subsystems" section for battle-tested code |
| `ui-designer.md` | `ui-designer.md` | Replaced Mantine v9 references with generic component library; replaced Croatian UI language with English; adapted file map from prijevodi-online domain (Series, Auth) to data-mock domain (Projects, Models, Seeding); replaced MobX references with generic "observable"; updated "Must NOT Touch" list for data-mock file patterns |
| `ui-developer.md` | `ui-developer.md` | Kept layered architecture (Gateway → Repository → UseCase → Presenter → React) intact; replaced MobX-specific references with generic "observable"; updated DI references to `@webiny/di`; adapted domain examples to data-mock context; updated tooling to oxlint/oxfmt; replaced Croatian text rule with English |

## Common Adaptations Across All Agents

1. **DI library**: `@webiny/di` for container + `@webiny/stdlib` for utilities (Result, BaseError)
2. **Tooling**: oxlint/oxfmt instead of eslint/prettier; `yarn compile` for TypeScript build
3. **Package manager**: yarn 4 (Berry)
4. **Language**: English code and UI text (source project used Croatian for UI)
5. **Persistence**: SQLite for project configuration (source project had its own DB layer)
6. **External API**: Webiny CMS via GraphQL (source project had its own API routes)
7. **All agents reference AGENTS.md** at project root for full architectural conventions
