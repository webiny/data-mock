# Build & Dev Setup — Reference from prijevodi-online-2010

## Dev Mode (`yarn dev`)

Uses `concurrently` to run two processes:
- `yarn api:dev` → `tsx --watch src/api/start.ts` — API on port 3001 with file watching
- `yarn ui:dev` → `vite dev` — Vite dev server on port 5173

Vite proxies `/api` requests to `http://localhost:3001` so the UI fetches from the same origin.

## Production Build (`yarn build`)

Two sequential steps:
1. `yarn build:ui` → `vite build` → output to `dist/ui/`
2. `yarn build:api` → `esbuild` bundles `src/api/start.ts` → single `dist/api/start.mjs`

Production API: `node dist/api/start.mjs`

## Vite Config

- **Path aliases:** `~/shared`, `~/cli`, `~/api`, `~/ui` → `src/` subdirectories
- **Proxy:** `"/api" → http://localhost:3001` (dev only)
- **optimizeDeps:** Pre-bundles react, mantine, mobx, @webiny/di, @webiny/stdlib, zod
- **Manual chunks:** framework (react+mobx+webiny), mantine, icons
- **PostCSS:** `postcss-preset-mantine` for Mantine CSS

## TypeScript Config

- `noEmit: true` — tsc is typecheck-only, Vite/esbuild handle builds
- `allowImportingTsExtensions: true`
- `verbatimModuleSyntax: true`
- Strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`
- JSX: `react-jsx` (automatic runtime)

## Scripts to Replicate

| Script | Command | Purpose |
|---|---|---|
| `dev` | `concurrently "api:dev" "ui:dev"` | Both servers in parallel |
| `api:dev` | `tsx --watch src/api/start.ts` | API with hot reload |
| `ui:dev` | `vite dev` | UI with HMR |
| `build` | `vite build && esbuild` | Prod build |
| `api:start` | `node dist/api/start.mjs` | Prod API |
| `typecheck` | `tsc --noEmit` | Type checking only |
| `test` | `vitest run` | Tests |
| `cli` | `tsx src/cli/entry.ts` | CLI tool |
| `db:generate` | `drizzle-kit generate` | Generate migration |
| `db:migrate` | `drizzle-kit migrate` | Run migrations |

## Dependencies to Add

```
concurrently (dev)
vite, @vitejs/plugin-react (dev)
postcss, postcss-preset-mantine (dev)
esbuild (dev — for API prod bundle)
```
