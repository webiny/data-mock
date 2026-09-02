# ADR-008: Clean Break Migration

**Date:** 2026-09-02
**Status:** Accepted

## Decision

Remove old CLI entry points (`index.js`, current yargs setup) when building new ones. No backwards compatibility period.

## Rationale

Single user (Bruno). No external consumers. Old entry points can be deleted as soon as their functionality is ported to the new DI-based CLI in `src/cli/`.
