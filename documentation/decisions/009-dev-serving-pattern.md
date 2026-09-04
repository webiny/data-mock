# ADR-009: Dev & Serving Pattern (same as dependency-upgrader)

**Date:** 2026-09-02
**Status:** Accepted

## Decision

Use the same dev and serving pattern as the dependency-upgrader (reference project) project:

### Development
- `yarn dev` → `concurrently` runs API + UI in parallel
- API: `tsx --watch src/api/start.ts` on port 3001
- UI: `vite dev` on port 5173, proxies `/api` → `http://localhost:3001`
- CLI: separate, `yarn cli` → `tsx src/cli/entry.ts`

### Production
- UI: `vite build` → `dist/ui/`
- API: `esbuild` → `dist/api/start.mjs`
- API serves static UI files from `dist/ui/` in production (single process)

### Key Config
- Path aliases in both `tsconfig.json` and `vite.config.ts`: `~/shared`, `~/cli`, `~/api`, `~/ui`, `~/db`
- `postcss-preset-mantine` for Mantine CSS
- `tsc --noEmit` for typecheck (Vite/esbuild handle actual builds)
- Fastify bound to `127.0.0.1` only (localhost, no auth — see ADR-006)

## Dependencies
- `concurrently`, `vite`, `@vitejs/plugin-react`, `postcss`, `postcss-preset-mantine`, `esbuild` (all dev)
- `@clack/prompts` for CLI interactive prompts
