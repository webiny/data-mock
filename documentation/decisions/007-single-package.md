# ADR-007: Single Package with Path Aliases

**Date:** 2026-09-02
**Status:** Accepted

## Decision

Keep a single `package.json` (no yarn workspaces). Use TypeScript path aliases and Vite aliases to separate layers:

```
~/shared → src/shared/
~/cli    → src/cli/
~/api    → src/api/
~/ui     → src/ui/
~/db     → src/db/
```

## Rationale

Same approach as the reference project. Simpler setup, no workspace overhead. Layer boundaries enforced by convention and import rules, not package boundaries.

Aliases configured in both `tsconfig.json` (for tsc/IDE) and `vite.config.ts` (for bundler).
