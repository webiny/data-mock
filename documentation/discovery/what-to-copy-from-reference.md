# What to Copy from reference project

Based on `documentation/research/06-reference-project-layers.md`.

## Must Copy (infrastructure)

### Shared Routing System
| Source | Target | Purpose |
|---|---|---|
| `src/shared/routing/defineRoute.ts` | `src/shared/routing/defineRoute.ts` | Base route definition factory |
| `src/shared/routing/defineTypedRoutes.ts` | `src/shared/routing/defineTypedRoutes.ts` | List/One/Void typed route factories |
| `src/shared/routing/interpolatePath.ts` | `src/shared/routing/interpolatePath.ts` | Path param interpolation (:id → value) |
| `src/shared/routing/types.ts` | `src/shared/routing/types.ts` | IRequestArgs type |

### API Routing Infrastructure
| Source | Target | Purpose |
|---|---|---|
| `src/api/routing/routeFactory.ts` | `src/api/routing/routeFactory.ts` | Fastify route ↔ DI bridge |
| `src/api/routing/registerRoute.ts` | `src/api/routing/registerRoute.ts` | Route registration with Zod validation |
| `src/api/routing/sendTyped.ts` | `src/api/routing/sendTyped.ts` | Typed response sender (list/one/none) |
| `src/api/routing/sendError.ts` | `src/api/routing/sendError.ts` | Error → JSON serialization |
| `src/api/routing/createRequestContext.ts` | `src/api/routing/createRequestContext.ts` | Per-request child container |
| `src/api/routing/types.ts` | `src/api/routing/types.ts` | Fastify request type augmentation |

### UI DI Bridge
| Source | Target | Purpose |
|---|---|---|
| `src/ui/di/createFeature.ts` | `src/ui/di/createFeature.ts` | UI feature factory (dependencies + resolve) |
| `src/ui/di/DiContainerProvider.tsx` | `src/ui/di/DiContainerProvider.tsx` | React context for Container |
| `src/ui/di/useFeature.ts` | `src/ui/di/useFeature.ts` | Hook to resolve feature exports |
| `src/ui/di/registerFeatures.ts` | `src/ui/di/registerFeatures.ts` | Topological sort registration |
| `src/ui/di/RegisterFeature.tsx` | `src/ui/di/RegisterFeature.tsx` | Lazy registration component |

### UI HTTP Client
| Source | Target | Purpose |
|---|---|---|
| `src/ui/infrastructure/httpClient/` (all files) | `src/ui/infrastructure/httpClient/` | FetchHTTPClient + abstractions + HTTPError |

### CLI Services
| Source | Target | Purpose |
|---|---|---|
| `src/cli/features/prompts/` | `src/cli/features/prompts/` | @clack/prompts wrapper as DI abstraction |
| `src/cli/features/ui/` | `src/cli/features/ui/` | CLI UI (intro/outro/spinner) as DI abstraction |

## Adapt (same pattern, different details)

| Source | What to Change |
|---|---|
| `src/api/features/database/` | MySQL → SQLite (better-sqlite3 + drizzle-orm/better-sqlite3) |
| `src/shared/db/schema/` | Write project + seed_jobs tables instead of genre/series tables |
| `src/shared/db/deleteById.ts` | Change MySQL types to SQLite types |
| `src/shared/errors.ts` | Write data-mock specific BaseError subclasses |

## Skip (domain-specific)

- All domain features (series, genres, movies, episodes, translators, etc.)
- Auth/RBAC system (SMF integration, permissions)
- File management, image serving
- Migration/import CLI commands
- All domain-specific response schemas and route definitions
